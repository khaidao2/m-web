"""Scan bill D-day: programs, shifts, bill capture → OCR draft → PG confirm → checks, results."""
import asyncio
import csv
import hashlib
import io
from datetime import date, datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_supervisor, current_user
from app.db.database import get_db
from app.models.models import (
    Bill, BillEvent, BillImage, BillStatus, DdayProgram, DdayShift, User, UserRole,
)
from app.services import bills as engine
from app.services.passport import now

router = APIRouter()
IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 6 * 1024 * 1024
ACTIVITIES = ["D-day", "Double Day", "Hoạt náo", "Khai trương"]


# ── schemas ────────────────────────────────────────────────────────────────

class ProgramIn(BaseModel):
    name: str = Field(min_length=3, max_length=200)
    activity: str = Field(min_length=2, max_length=40)
    day: date
    store_name: str = Field(min_length=2, max_length=200)


class ShiftIn(BaseModel):
    program_id: str
    hours: float = Field(gt=0, le=16)


class LineIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    qty: int = Field(ge=1, le=500)
    unit_price: int = Field(ge=0, le=100_000_000)
    amount: int = Field(ge=0, le=1_000_000_000)


class BillEdit(BaseModel):
    bill_no: str | None = Field(None, max_length=60)
    store_name: str | None = Field(None, max_length=200)
    purchased_at: datetime | None = None
    total_vnd: int | None = Field(None, ge=0, le=1_000_000_000)
    lines: list[LineIn] = Field(max_length=80)


class VoidIn(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class DecisionIn(BaseModel):
    decision: BillStatus
    note: str | None = Field(None, max_length=500)


# ── views ──────────────────────────────────────────────────────────────────

def program_view(p: DdayProgram) -> dict:
    return {"id": p.id, "name": p.name, "activity": p.activity, "day": p.day, "store_name": p.store_name, "is_open": p.is_open}


def bill_view(b: Bill, program: DdayProgram | None = None, pg: User | None = None) -> dict:
    mch = [ln for ln in b.lines if ln["mch"]]
    return {
        "id": b.id, "status": b.status.value, "program_id": b.program_id, "shift_id": b.shift_id,
        "flags": [{"code": f, "label": engine.FLAGS[f][1], "severity": engine.FLAGS[f][0]} for f in b.flags],
        "bill_no": b.bill_no, "store_name": b.store_name, "purchased_at": b.purchased_at, "total_vnd": b.total_vnd,
        "lines": b.lines, "mch_value_vnd": sum(ln["amount"] for ln in mch),
        "mch_categories": sorted({ln["category"] for ln in mch}),
        "created_at": b.created_at, "confirmed_at": b.confirmed_at,
        **({"program": program_view(program)} if program else {}),
        **({"pg": {"id": pg.id, "name": pg.full_name}} if pg else {}),
    }


def _log(db: AsyncSession, bill: Bill, actor: User, action: str, detail: dict | None = None) -> None:
    db.add(BillEvent(bill_id=bill.id, actor_id=actor.id, action=action, detail=detail or {}))


async def _own_bill(db: AsyncSession, bill_id: str, user: User, lock: bool = False) -> Bill:
    bill = await db.get(Bill, bill_id, with_for_update=lock)
    if bill is None or (bill.user_id != user.id and user.role is not UserRole.SUPERVISOR):
        raise HTTPException(404, "Không tìm thấy bill")
    return bill


# ── programs & shifts ──────────────────────────────────────────────────────

@router.get("/dday/programs")
async def list_programs(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    q = select(DdayProgram).order_by(DdayProgram.day.desc())
    if user.role is UserRole.PG:
        q = q.where(DdayProgram.is_open.is_(True))
    return {"activities": ACTIVITIES, "programs": [program_view(p) for p in (await db.scalars(q)).all()]}


@router.post("/sup/dday/programs")
async def create_program(body: ProgramIn, sup: User = Depends(current_supervisor), db: AsyncSession = Depends(get_db)):
    p = DdayProgram(**body.model_dump(), created_by=sup.id)
    db.add(p)
    await db.flush()
    return program_view(p)


@router.post("/sup/dday/programs/{program_id}/close")
async def close_program(program_id: str, sup: User = Depends(current_supervisor), db: AsyncSession = Depends(get_db)):
    p = await db.get(DdayProgram, program_id)
    if p is None:
        raise HTTPException(404, "Không tìm thấy chương trình")
    p.is_open = False
    return program_view(p)


@router.get("/dday/shifts")
async def my_shifts(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(DdayShift, DdayProgram).join(DdayProgram, DdayProgram.id == DdayShift.program_id)
        .where(DdayShift.user_id == user.id).order_by(DdayProgram.day.desc())
    )).all()
    return [{"id": s.id, "hours": s.hours, "program": program_view(p)} for s, p in rows]


@router.post("/dday/shifts")
async def join_program(body: ShiftIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    program = await db.get(DdayProgram, body.program_id)
    if program is None or not program.is_open:
        raise HTTPException(400, "Chương trình không mở")
    if await db.scalar(select(DdayShift.id).where(DdayShift.user_id == user.id, DdayShift.program_id == program.id)):
        raise HTTPException(409, "Bạn đã có ca trong chương trình này")
    shift = DdayShift(user_id=user.id, program_id=program.id, hours=body.hours)
    db.add(shift)
    try:
        await db.flush()
    except IntegrityError as exc:  # concurrent double-tap
        raise HTTPException(409, "Bạn đã có ca trong chương trình này") from exc
    return {"id": shift.id, "hours": shift.hours, "program": program_view(program)}


# ── bills ──────────────────────────────────────────────────────────────────

@router.post("/bills")
async def scan_bill(
    shift_id: str = Form(...),
    image: UploadFile = File(...),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stores the photo and returns an OCR draft for the PG to check; nothing counts until confirmed."""
    shift = await db.get(DdayShift, shift_id)
    if shift is None or shift.user_id != user.id:
        raise HTTPException(400, "Ca D-day không hợp lệ")
    program = await db.get(DdayProgram, shift.program_id)
    if not program.is_open:
        raise HTTPException(400, "Chương trình đã đóng")
    mime = (image.content_type or "").split(";")[0]
    if mime not in IMAGE_TYPES:
        raise HTTPException(415, "Chỉ nhận ảnh JPG, PNG hoặc WebP")
    data = await image.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Ảnh quá lớn (tối đa 6 MB)")

    text = await asyncio.to_thread(engine.ocr, data)
    parsed = engine.parse(text)
    bill = Bill(user_id=user.id, shift_id=shift.id, program_id=program.id,
                image_sha256=hashlib.sha256(data).hexdigest(), ocr_text=text, **parsed)
    db.add(bill)
    await db.flush()
    db.add(BillImage(bill_id=bill.id, mime=mime, data=data))
    _log(db, bill, user, "ocr", {"lines": len(parsed["lines"]), "chars": len(text)})
    return bill_view(bill, program)


@router.patch("/bills/{bill_id}")
async def edit_bill(bill_id: str, body: BillEdit, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    bill = await _own_bill(db, bill_id, user, lock=True)
    if bill.user_id != user.id or bill.status is not BillStatus.DRAFT:
        raise HTTPException(409, "Chỉ sửa được bill nháp của bạn")
    before = {"bill_no": bill.bill_no, "store_name": bill.store_name, "total_vnd": bill.total_vnd,
              "purchased_at": bill.purchased_at.isoformat() if bill.purchased_at else None, "lines": bill.lines}
    bill.bill_no = (body.bill_no or "").strip().upper() or None
    bill.store_name = (body.store_name or "").strip() or None
    bill.purchased_at = body.purchased_at.astimezone(engine.VN) if body.purchased_at else None
    bill.total_vnd = body.total_vnd
    bill.lines = [engine.make_line(ln.name, ln.qty, ln.unit_price, ln.amount) for ln in body.lines]
    after = {"bill_no": bill.bill_no, "store_name": bill.store_name, "total_vnd": bill.total_vnd,
             "purchased_at": bill.purchased_at.isoformat() if bill.purchased_at else None, "lines": bill.lines}
    changed = {k: {"from": before[k], "to": after[k]} for k in after if before[k] != after[k]}
    if changed:
        _log(db, bill, user, "edit", changed)
    return bill_view(bill, await db.get(DdayProgram, bill.program_id))


@router.post("/bills/{bill_id}/confirm")
async def confirm_bill(bill_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    bill = await _own_bill(db, bill_id, user, lock=True)
    if bill.user_id != user.id or bill.status is not BillStatus.DRAFT:
        raise HTTPException(409, "Bill đã được xác nhận")
    program = await db.get(DdayProgram, bill.program_id)
    active = select(Bill.id).where(Bill.id != bill.id, Bill.status.notin_([BillStatus.DRAFT, BillStatus.VOID]))
    dups = set()
    if await db.scalar(active.where(Bill.image_sha256 == bill.image_sha256).limit(1)):
        dups.add("duplicate_image")
    if bill.bill_no and await db.scalar(active.where(Bill.bill_no == bill.bill_no,
                                                     Bill.store_name == bill.store_name).limit(1)):
        dups.add("duplicate_bill_no")
    status, flags = engine.evaluate(
        {"bill_no": bill.bill_no, "store_name": bill.store_name, "purchased_at": bill.purchased_at,
         "total_vnd": bill.total_vnd, "lines": bill.lines},
        {"day": program.day, "store_name": program.store_name}, dups,
    )
    bill.status, bill.flags, bill.confirmed_at = BillStatus(status), flags, now()
    _log(db, bill, user, "confirm", {"status": status, "flags": flags})
    return bill_view(bill, program)


@router.post("/bills/{bill_id}/void")
async def void_bill(bill_id: str, body: VoidIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    bill = await _own_bill(db, bill_id, user, lock=True)
    if bill.status is BillStatus.VOID:
        raise HTTPException(409, "Bill đã bị vô hiệu")
    _log(db, bill, user, "void", {"reason": body.reason, "previous": bill.status.value})
    bill.status = BillStatus.VOID
    return bill_view(bill)


@router.get("/bills/{bill_id}/image")
async def bill_image(bill_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    await _own_bill(db, bill_id, user)
    img = await db.get(BillImage, bill_id)
    if img is None:
        raise HTTPException(404, "Không có ảnh")
    return Response(img.data, media_type=img.mime, headers={"Cache-Control": "private, max-age=86400"})


@router.get("/bills/{bill_id}/events")
async def bill_events(bill_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    await _own_bill(db, bill_id, user)
    rows = (await db.execute(
        select(BillEvent, User.full_name).join(User, User.id == BillEvent.actor_id)
        .where(BillEvent.bill_id == bill_id).order_by(BillEvent.created_at)
    )).all()
    return [{"action": e.action, "detail": e.detail, "by": name, "at": e.created_at} for e, name in rows]


# ── listing, results, export (PG: own bills · SUP: everyone) ───────────────

def _filtered(user: User, program_id: str | None, day: date | None, store: str | None):
    q = (select(Bill, DdayProgram, User).join(DdayProgram, DdayProgram.id == Bill.program_id)
         .join(User, User.id == Bill.user_id))
    if user.role is UserRole.PG:
        q = q.where(Bill.user_id == user.id)
    if program_id:
        q = q.where(Bill.program_id == program_id)
    if day:
        q = q.where(DdayProgram.day == day)
    if store:
        q = q.where(DdayProgram.store_name == store)
    return q


@router.get("/bills")
async def list_bills(
    program_id: str | None = None, day: date | None = None, store: str | None = None,
    status: BillStatus | None = None, user: User = Depends(current_user), db: AsyncSession = Depends(get_db),
):
    q = _filtered(user, program_id, day, store).where(Bill.status != BillStatus.DRAFT)
    if status:
        q = q.where(Bill.status == status)
    rows = (await db.execute(q.order_by(Bill.created_at.desc()).limit(200))).all()
    return [bill_view(b, p, pg) for b, p, pg in rows]


@router.get("/bills/results")
async def bill_results(
    program_id: str | None = None, day: date | None = None, store: str | None = None,
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(_filtered(user, program_id, day, store))).all()
    valid = [{"lines": b.lines} for b, _, _ in rows if b.status is BillStatus.VALID]
    shifts_q = select(func.count(DdayShift.id), func.coalesce(func.sum(DdayShift.hours), 0)).join(
        DdayProgram, DdayProgram.id == DdayShift.program_id)
    if user.role is UserRole.PG:
        shifts_q = shifts_q.where(DdayShift.user_id == user.id)
    if program_id:
        shifts_q = shifts_q.where(DdayShift.program_id == program_id)
    if day:
        shifts_q = shifts_q.where(DdayProgram.day == day)
    if store:
        shifts_q = shifts_q.where(DdayProgram.store_name == store)
    shifts, hours = (await db.execute(shifts_q)).one()
    return {**engine.results(valid, float(hours), shifts),
            "needs_review": sum(1 for b, _, _ in rows if b.status is BillStatus.REVIEW),
            "rejected": sum(1 for b, _, _ in rows if b.status is BillStatus.REJECTED)}


@router.get("/bills/export.csv")
async def export_csv(
    program_id: str | None = None, day: date | None = None, store: str | None = None,
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(_filtered(user, program_id, day, store).where(Bill.status != BillStatus.DRAFT)
                             .order_by(Bill.created_at))).all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["bill_id", "trang_thai", "co", "pg", "chuong_trinh", "ngay_ct", "cua_hang_ct", "so_bill",
                "cua_hang_bill", "thoi_gian_bill", "tong_bill", "san_pham", "nhan_hang", "nganh_hang",
                "so_luong", "don_gia", "thanh_tien", "mch"])
    for b, p, pg in rows:
        for ln in b.lines or [{}]:
            w.writerow([b.id, b.status.value, "|".join(b.flags), pg.full_name, p.name, p.day, p.store_name,
                        b.bill_no or "", b.store_name or "", b.purchased_at.isoformat() if b.purchased_at else "",
                        b.total_vnd or "", ln.get("name", ""), ln.get("brand") or "", ln.get("category") or "",
                        ln.get("qty", ""), ln.get("unit_price", ""), ln.get("amount", ""), ln.get("mch", "")])
    return Response("﻿" + buf.getvalue(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": 'attachment; filename="pgnexus-bills.csv"'})


# ── SUP review ─────────────────────────────────────────────────────────────

@router.post("/sup/bills/{bill_id}/decide")
async def decide(bill_id: str, body: DecisionIn, sup: User = Depends(current_supervisor), db: AsyncSession = Depends(get_db)):
    if body.decision not in (BillStatus.VALID, BillStatus.REJECTED):
        raise HTTPException(400, "Chỉ chọn Hợp lệ hoặc Loại")
    bill = await db.get(Bill, bill_id, with_for_update=True)
    if bill is None or bill.status in (BillStatus.DRAFT, BillStatus.VOID):
        raise HTTPException(404, "Không có bill để duyệt")
    _log(db, bill, sup, "decide", {"from": bill.status.value, "to": body.decision.value, "note": body.note})
    bill.status = body.decision
    return bill_view(bill, await db.get(DdayProgram, bill.program_id), await db.get(User, bill.user_id))
