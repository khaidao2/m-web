from datetime import date, datetime

import pytest

from app.services import bills as engine
from tests.conftest import as_user

PG, PG2, SUP = as_user("pg01"), as_user("pg02"), as_user("sup01")

RECEIPT = """BACH HOA XANH
Q7 - Huynh Tan Phat
So HD: HD2610010123
Ngay: 01/10/2026 18:42
Nuoc mam Nam Ngu 500ml   2   45.000   90.000
Mi Omachi suon heo 80g   5   8.500   42.500
Rau muong 1kg            1   25.000
Tong cong                    157.500
Tien mat                     200.000
"""
JPEG = b"\xff\xd8\xff\xe0" + b"0" * 64


def test_parse_receipt_and_match_mch():
    r = engine.parse(RECEIPT)
    assert r["bill_no"] == "HD2610010123" and r["total_vnd"] == 157500
    assert r["purchased_at"] == datetime(2026, 10, 1, 18, 42, tzinfo=engine.VN)
    assert [(ln["brand"], ln["qty"], ln["amount"]) for ln in r["lines"]] == [
        ("Nam Ngư", 2, 90000), ("Omachi", 5, 42500), (None, 1, 25000)]
    assert engine.match_mch("Nước tăng lực Wake-Up 247")["category"] == "Đồ uống"
    assert engine.match_mch("Cà phê Wake up café")["brand"] == "Vinacafé"


def test_evaluate_flags():
    r = engine.parse(RECEIPT)
    program = {"day": date(2026, 10, 1), "store_name": "BHX Q7 - Huỳnh Tấn Phát"}
    assert engine.evaluate(r, program, set()) == ("valid", [])
    assert engine.evaluate(r, {**program, "day": date(2026, 10, 2)}, set())[0] == "review"
    assert engine.evaluate(r, {**program, "store_name": "BHX Gò Vấp"}, set())[1] == ["store_mismatch"]
    assert engine.evaluate({**r, "total_vnd": 999_000}, program, set())[1] == ["total_mismatch"]
    assert engine.evaluate(r, program, {"duplicate_image"})[0] == "rejected"
    no_mch = {**r, "lines": [ln for ln in r["lines"] if not ln["mch"]], "total_vnd": 25000}
    assert engine.evaluate(no_mch, program, set()) == ("rejected", ["no_mch"])


@pytest.fixture
def fake_ocr(monkeypatch):
    monkeypatch.setattr(engine, "ocr", lambda data: RECEIPT)


async def setup_shift(client, headers=PG, hours=8):
    prog = (await client.post("/api/v1/sup/dday/programs", json={
        "name": "D-day 01/10 Q7", "activity": "D-day", "day": "2026-10-01", "store_name": "BHX Q7 - Huỳnh Tấn Phát"},
        headers=SUP)).json()
    assert (await client.post("/api/v1/sup/dday/programs", json={
        "name": "x", "activity": "D-day", "day": "2026-10-01", "store_name": "BHX"}, headers=PG)).status_code == 403
    shift = (await client.post("/api/v1/dday/shifts", json={"program_id": prog["id"], "hours": hours}, headers=headers)).json()
    return prog, shift


async def scan(client, shift_id, headers=PG, image=JPEG):
    r = await client.post("/api/v1/bills", data={"shift_id": shift_id},
                          files={"image": ("bill.jpg", image, "image/jpeg")}, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


async def test_bill_flow_results_and_audit(client, fake_ocr):
    prog, shift = await setup_shift(client)
    again = await client.post("/api/v1/dday/shifts", json={"program_id": prog["id"], "hours": 4}, headers=PG)
    assert again.status_code == 409  # one shift per PG per program

    draft = await scan(client, shift["id"])
    assert draft["status"] == "draft" and len(draft["lines"]) == 3
    assert (await client.get("/api/v1/bills", headers=PG)).json() == []  # drafts are not listed

    # PG corrects an OCR line; the change is logged
    lines = [{k: ln[k] for k in ("name", "qty", "unit_price", "amount")} for ln in draft["lines"]]
    lines.append({"name": "Tuong ot Chinsu 250g", "qty": 1, "unit_price": 18000, "amount": 18000})
    edit = {"bill_no": draft["bill_no"], "store_name": draft["store_name"], "purchased_at": draft["purchased_at"],
            "total_vnd": 175500, "lines": lines}
    edited = (await client.patch(f"/api/v1/bills/{draft['id']}", json=edit, headers=PG)).json()
    assert edited["mch_categories"] == ["Gia vị", "Mì ăn liền"]

    done = (await client.post(f"/api/v1/bills/{draft['id']}/confirm", headers=PG)).json()
    assert done["status"] == "valid" and done["flags"] == []
    assert (await client.patch(f"/api/v1/bills/{draft['id']}", json=edit, headers=PG)).status_code == 409

    events = [e["action"] for e in (await client.get(f"/api/v1/bills/{draft['id']}/events", headers=PG)).json()]
    assert events == ["ocr", "edit", "confirm"]

    # the same photo again is rejected as a duplicate
    dup = await scan(client, shift["id"])
    dup = (await client.post(f"/api/v1/bills/{dup['id']}/confirm", headers=PG)).json()
    assert dup["status"] == "rejected" and {f["code"] for f in dup["flags"]} >= {"duplicate_image", "duplicate_bill_no"}

    res = (await client.get(f"/api/v1/bills/results?program_id={prog['id']}", headers=PG)).json()
    assert res["mch_value_vnd"] == 150500 and res["bills"] == 1 and res["hours"] == 8
    assert res["value_per_hour"] == round(150500 / 8) and res["multi_category_rate"] == 100 and res["rejected"] == 1
    assert res["skus"][0]["brand"] == "Nam Ngư"

    csv = await client.get("/api/v1/bills/export.csv", headers=PG)
    assert csv.headers["content-type"].startswith("text/csv") and "Nam Ngu" in csv.text

    # privacy: another PG sees neither the bill nor its photo
    assert (await client.get(f"/api/v1/bills/{draft['id']}/image", headers=PG2)).status_code == 404
    assert (await client.get("/api/v1/bills", headers=PG2)).json() == []
    assert (await client.get(f"/api/v1/bills/{draft['id']}/image", headers=SUP)).status_code == 200

    # void keeps the record (append-only) and drops it from results
    v = await client.post(f"/api/v1/bills/{draft['id']}/void", json={"reason": "Chụp nhầm bill"}, headers=PG)
    assert v.json()["status"] == "void"
    assert (await client.get(f"/api/v1/bills/results?program_id={prog['id']}", headers=PG)).json()["bills"] == 0


async def test_sup_review_and_validation(client, monkeypatch):
    prog, shift = await setup_shift(client)
    monkeypatch.setattr(engine, "ocr", lambda data: RECEIPT.replace("01/10/2026", "03/10/2026"))
    b = await scan(client, shift["id"], image=JPEG + b"other")
    b = (await client.post(f"/api/v1/bills/{b['id']}/confirm", headers=PG)).json()
    assert b["status"] == "review" and b["flags"][0]["code"] == "outside_program_day"

    queue = (await client.get("/api/v1/bills?status=review", headers=SUP)).json()
    assert [q["id"] for q in queue] == [b["id"]] and queue[0]["pg"]["name"] == "PG01"
    assert (await client.post(f"/api/v1/sup/bills/{b['id']}/decide", json={"decision": "valid"}, headers=PG)).status_code == 403
    assert (await client.post(f"/api/v1/sup/bills/{b['id']}/decide", json={"decision": "draft"}, headers=SUP)).status_code == 400
    ok = (await client.post(f"/api/v1/sup/bills/{b['id']}/decide", json={"decision": "valid", "note": "Đã đối chiếu"}, headers=SUP)).json()
    assert ok["status"] == "valid"

    # inputs at the trust boundary
    bad = await client.post("/api/v1/bills", data={"shift_id": shift["id"]}, files={"image": ("a.pdf", b"%PDF", "application/pdf")}, headers=PG)
    assert bad.status_code == 415
    other = await client.post("/api/v1/bills", data={"shift_id": shift["id"]}, files={"image": ("b.jpg", JPEG, "image/jpeg")}, headers=PG2)
    assert other.status_code == 400  # not PG2's shift
    await client.post(f"/api/v1/sup/dday/programs/{prog['id']}/close", headers=SUP)
    assert (await client.get("/api/v1/dday/programs", headers=PG)).json()["programs"] == []


def test_parse_tolerates_ocr_number_spacing():
    r = engine.parse("So HD: HD1\nNuoc mam Nam Ngu 500ml 2 45.000 90. 000\nTong cong 175. 500\n")
    assert r["total_vnd"] == 175500 and r["lines"][0]["amount"] == 90000
