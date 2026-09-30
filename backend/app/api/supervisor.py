"""Sales Sup workspace: Red Flag queue, stamp, AI-vs-SUP review, field audit, pilot KPIs."""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.users import onboarding_status
from app.api.voice import session_summary, session_view
from app.core.auth import current_supervisor
from app.db.database import get_db
from app.models.models import (
    AssessmentSource, FieldAudit, FlagStatus, Quest, RedFlag, User, UserRole, VoiceSession,
)
from app.services.content import COMPETENCIES, level_of
from app.services.passport import (
    competency_scores, flag_view, now, overall, passport_view, record_assessments, stamp_flag,
)

router = APIRouter(prefix="/sup")
Score = Field(ge=0, le=10)


class StampIn(BaseModel):
    score: float = Score
    note: str | None = Field(None, max_length=1000)


class ReviewIn(BaseModel):
    scores: dict[str, float]
    note: str | None = Field(None, max_length=1000)


class AuditIn(BaseModel):
    period: date
    revenue_vnd: int | None = Field(None, ge=0)
    dday_units: int | None = Field(None, ge=0)
    activations: int | None = Field(None, ge=0)
    extra_displays: int | None = Field(None, ge=0)
    c7_score: float | None = Score
    note: str | None = Field(None, max_length=1000)


async def _pg(db: AsyncSession, user_id: str) -> User:
    pg = await db.get(User, user_id)
    if pg is None or pg.role is not UserRole.PG:
        raise HTTPException(404, "Không tìm thấy PG")
    return pg


@router.get("/overview")
async def overview(sup: User = Depends(current_supervisor), db: AsyncSession = Depends(get_db)):
    pgs = (await db.scalars(select(User).where(User.role == UserRole.PG, User.is_demo.is_(False)))).all()
    ids = [p.id for p in pgs]
    week_ago = now() - timedelta(days=7)

    flags = (await db.scalars(select(RedFlag).where(RedFlag.user_id.in_(ids)))).all() if ids else []
    active = [f for f in flags if f.status is not FlagStatus.CLOSED]
    closed = [f for f in flags if f.status is FlagStatus.CLOSED]
    quests_total, quests_done = (await db.execute(
        select(func.count(Quest.id), func.count(Quest.completed_at))
        .where(Quest.user_id.in_(ids), Quest.day >= week_ago.date())
    )).one() if ids else (0, 0)
    sessions_started, sessions_done = (await db.execute(
        select(func.count(VoiceSession.id), func.count(VoiceSession.completed_at))
        .where(VoiceSession.user_id.in_(ids), VoiceSession.started_at >= week_ago)
    )).one() if ids else (0, 0)
    weekly = dict((await db.execute(
        select(Quest.user_id, func.count(Quest.completed_at)).where(
            Quest.user_id.in_(ids), Quest.completed_at >= week_ago).group_by(Quest.user_id)
    )).all()) if ids else {}

    team = []
    onboarded = 0
    for p in pgs:
        ob = await onboarding_status(db, p)
        onboarded += ob["complete"]
        scores = await competency_scores(db, p.id)
        team.append({
            "id": p.id, "name": p.full_name, "store": p.store_name, "overall": overall(scores),
            "level": level_of(overall(scores)), "onboarded": ob["complete"],
            "open_flags": sum(1 for f in active if f.user_id == p.id and f.status is FlagStatus.OPEN),
            "ready_flags": sum(1 for f in active if f.user_id == p.id and f.status is FlagStatus.READY),
            "quests_week": weekly.get(p.id, 0),
        })

    reviewed = (await db.scalars(select(VoiceSession).where(
        VoiceSession.user_id.in_(ids), VoiceSession.report["sup_review"].is_not(None)
    ))).all() if ids else []
    gaps = [abs(s.report["sup_review"]["scores"][c] - s.scores[c])
            for s in reviewed for c in s.report["sup_review"]["scores"] if s.scores.get(c) is not None]
    close_days = [(f.closed_at - f.opened_at).days for f in closed if f.closed_at]
    n = len(pgs) or 1

    def pct(a: int, b: int) -> int | None:
        return round(100 * a / b) if b else None

    return {
        "kpis": [
            {"code": "1.1", "name": "Onboarding completion", "value": pct(onboarded, len(pgs)), "unit": "%", "target": "100%"},
            {"code": "1.2", "name": "Quest completion (7 ngày)", "value": pct(quests_done, quests_total), "unit": "%", "target": "≥ 75%"},
            {"code": "1.3", "name": "Weekly active PG (≥ 8 quest)", "value": pct(sum(1 for v in weekly.values() if v >= 8), len(pgs)), "unit": "%", "target": "≥ 70%"},
            {"code": "1.5", "name": "Voice completion", "value": pct(sessions_done, sessions_started), "unit": "%", "target": "≥ 90%"},
            {"code": "2.4", "name": "Red Flag rate", "value": pct(len({f.user_id for f in active}), n), "unit": "%", "target": "Giảm ≥ 50%"},
            {"code": "2.5", "name": "Red Flag closure", "value": pct(len(closed), len(flags)), "unit": "%", "target": "≥ 60%"},
            {"code": "2.6", "name": "Time-to-close Red Flag", "value": round(sum(close_days) / len(close_days), 1) if close_days else None, "unit": "ngày", "target": "≤ 7 ngày"},
            {"code": "AI", "name": "Lệch điểm AI vs SUP", "value": round(sum(gaps) / len(gaps), 1) if gaps else None, "unit": "điểm", "target": "≤ 1,0"},
        ],
        "team": sorted(team, key=lambda t: (-(t["open_flags"] + t["ready_flags"]), t["name"])),
    }


@router.get("/flags")
async def flags(status: FlagStatus | None = None, sup: User = Depends(current_supervisor),
                db: AsyncSession = Depends(get_db)):
    q = select(RedFlag, User).join(User, User.id == RedFlag.user_id).where(User.is_demo.is_(False))
    q = q.where(RedFlag.status == status) if status else q.where(RedFlag.status != FlagStatus.CLOSED)
    rows = (await db.execute(q.order_by(RedFlag.status.desc(), RedFlag.opened_at))).all()
    out = []
    for flag, pg in rows:
        latest = await db.scalar(select(VoiceSession).where(
            VoiceSession.user_id == pg.id, VoiceSession.completed_at.is_not(None),
            VoiceSession.scores[flag.competency].as_float().is_not(None),
        ).order_by(VoiceSession.completed_at.desc()).limit(1))
        out.append({**flag_view(flag), "pg": {"id": pg.id, "name": pg.full_name, "store": pg.store_name},
                    "current_score": (await competency_scores(db, pg.id))[flag.competency],
                    "latest_session": session_summary(latest) if latest else None})
    return out


@router.post("/flags/{flag_id}/stamp")
async def stamp(flag_id: str, body: StampIn, sup: User = Depends(current_supervisor),
                db: AsyncSession = Depends(get_db)):
    flag = await db.get(RedFlag, flag_id, with_for_update=True)
    if flag is None:
        raise HTTPException(404, "Không tìm thấy Red Flag")
    if flag.status is FlagStatus.CLOSED:
        raise HTTPException(409, "Red Flag đã được đóng")
    await stamp_flag(db, flag, sup, body.score, body.note)
    return flag_view(flag)


@router.get("/pgs/{user_id}")
async def pg_detail(user_id: str, sup: User = Depends(current_supervisor), db: AsyncSession = Depends(get_db)):
    pg = await _pg(db, user_id)
    sessions = (await db.scalars(select(VoiceSession).where(
        VoiceSession.user_id == pg.id, VoiceSession.completed_at.is_not(None)
    ).order_by(VoiceSession.completed_at.desc()).limit(20))).all()
    audits = (await db.scalars(select(FieldAudit).where(FieldAudit.user_id == pg.id)
                               .order_by(FieldAudit.period.desc()).limit(10))).all()
    return {
        "pg": {"id": pg.id, "name": pg.full_name, "store": pg.store_name},
        "onboarding": await onboarding_status(db, pg),
        "passport": await passport_view(db, pg),
        "sessions": [session_summary(s) for s in sessions],
        "audits": [{k: getattr(a, k) for k in ("id", "period", "revenue_vnd", "dday_units", "activations",
                                              "extra_displays", "c7_score", "note", "created_at")} for a in audits],
    }


@router.get("/sessions/{session_id}")
async def review_detail(session_id: str, sup: User = Depends(current_supervisor), db: AsyncSession = Depends(get_db)):
    s = await db.get(VoiceSession, session_id)
    if s is None:
        raise HTTPException(404, "Không tìm thấy phiên luyện")
    pg = await db.get(User, s.user_id)
    return {**session_view(s), "pg": {"id": pg.id, "name": pg.full_name, "store": pg.store_name}}


@router.post("/sessions/{session_id}/review")
async def review(session_id: str, body: ReviewIn, sup: User = Depends(current_supervisor),
                 db: AsyncSession = Depends(get_db)):
    """SUP scores the same recording; stored beside the AI score to calibrate the rubric."""
    s = await db.get(VoiceSession, session_id, with_for_update=True)
    if s is None or s.completed_at is None:
        raise HTTPException(404, "Không tìm thấy phiên luyện đã hoàn thành")
    bad = [c for c, v in body.scores.items() if c not in s.scores or not 0 <= v <= 10]
    if bad or not body.scores:
        raise HTTPException(400, "Điểm năng lực không hợp lệ")
    s.report = {**s.report, "sup_review": {"scores": body.scores, "note": body.note, "by": sup.full_name,
                                           "at": now().isoformat()}}
    await record_assessments(db, await _pg(db, s.user_id), body.scores, AssessmentSource.SUP,
                             ref_id=s.id, created_by=sup.id)
    return session_view(s)


@router.post("/pgs/{user_id}/audit")
async def add_audit(user_id: str, body: AuditIn, sup: User = Depends(current_supervisor),
                    db: AsyncSession = Depends(get_db)):
    pg = await _pg(db, user_id)
    audit = FieldAudit(user_id=pg.id, sup_id=sup.id, **body.model_dump())
    db.add(audit)
    await db.flush()
    if body.c7_score is not None:
        await record_assessments(db, pg, {"c7": body.c7_score}, AssessmentSource.SUP, ref_id=audit.id,
                                 created_by=sup.id)
    return {"id": audit.id}


@router.get("/competencies")
async def competencies(sup: User = Depends(current_supervisor)):
    return [{"key": c, "name": vi, "name_en": en} for c, (vi, en) in COMPETENCIES.items()]
