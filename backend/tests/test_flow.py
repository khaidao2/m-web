from app.services.content import quiz_bank
from tests.conftest import as_user

PG, PG2, SUP = as_user("pg01"), as_user("pg02"), as_user("sup01")

POOR = ["Hàng này tốt lắm chị mua đi", "Thương hiệu lớn mà chị, chắc chắn 100% ngon"]
GOOD = [
    "Dạ em chào chị, chị ưu tiên điều gì khi chọn mì ạ?",
    "Dạ em hiểu, vậy mức chi của chị cho một gói khoảng bao nhiêu ạ?",
    "Dạ gói A 80g giá 10.000đ, tính ra 12.500đ trên 100g, gói B khoảng 12.300đ, chị muốn no thì gói 80g hợp hơn, em kiểm tra thêm thông tin trên gói cho chị nha, chị thấy sao ạ?",
    "Vậy em chốt giúp chị 2 gói, tổng 20.000đ nha chị",
]


async def roleplay(client, headers, lines, code="KH01", quest_id=None):
    r = await client.post("/api/v1/voice/sessions", json={"scenario_code": code, "quest_id": quest_id,
                                                           "kind": "quest" if quest_id else "practice"}, headers=headers)
    assert r.status_code == 200, r.text
    sid = r.json()["session_id"]
    for line in lines:
        r = await client.post(f"/api/v1/voice/sessions/{sid}/turns", data={"text": line, "latency_ms": "1500"}, headers=headers)
        assert r.status_code == 200, r.text
    r = await client.post(f"/api/v1/voice/sessions/{sid}/finish", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


async def test_onboarding_quiz_feeds_passport(client):
    me = (await client.get("/api/v1/me", headers=PG)).json()
    assert me["role"] == "pg" and me["onboarding"]["complete"] is False

    start = (await client.post("/api/v1/quiz/start", headers=PG)).json()
    assert len(start["questions"]) == 10
    assert "answer" not in start["questions"][0]
    answers = {q["id"]: q["answer"] for q in quiz_bank()["questions"]}
    for i, q in enumerate(start["questions"]):
        choice = answers[q["id"]] if i % 2 == 0 else (answers[q["id"]] + 1) % 4
        r = await client.post(f"/api/v1/quiz/{start['attempt_id']}/answer",
                              json={"question_id": q["id"], "choice": choice, "time_ms": 3000}, headers=PG)
        assert r.json()["correct"] is (i % 2 == 0)
    dup = await client.post(f"/api/v1/quiz/{start['attempt_id']}/answer",
                            json={"question_id": start["questions"][0]["id"], "choice": 0, "time_ms": 1}, headers=PG)
    assert dup.status_code == 400
    result = (await client.post(f"/api/v1/quiz/{start['attempt_id']}/finish", headers=PG)).json()
    assert result["correct"] == 5 and result["total"] == 10

    passport = (await client.get("/api/v1/passport", headers=PG)).json()
    scores = {c["key"]: c["score"] for c in passport["competencies"]}
    assert scores["c7"] is None and scores["c1"] is None          # "Chưa đánh giá", never 0
    assert all(scores[c] is not None for c in ("c2", "c3", "c5", "c6"))


async def test_red_flag_lifecycle_with_sup_stamp(client):
    report = await roleplay(client, PG, POOR)
    assert report["overall"] < 5 and report["report"]["critical"] is True

    flags = (await client.get("/api/v1/passport", headers=PG)).json()["red_flags"]
    c3 = next(f for f in flags if f["competency"] == "c3")
    assert c3["status"] == "open"

    quests = (await client.get("/api/v1/quests/today", headers=PG)).json()
    assert quests[0]["kind"] == "red_flag"                       # red-flag quests listed first
    assert quests[-1]["kind"] == "daily"
    again = (await client.get("/api/v1/quests/today", headers=PG)).json()
    assert [q["id"] for q in again] == [q["id"] for q in quests]  # assignment is idempotent

    # SUP only
    assert (await client.get("/api/v1/sup/flags", headers=PG)).status_code == 403
    queue = (await client.get("/api/v1/sup/flags", headers=SUP)).json()
    assert any(f["id"] == c3["id"] for f in queue)

    # a SUP score below 7.0 does not close the flag
    r = await client.post(f"/api/v1/sup/flags/{c3['id']}/stamp", json={"score": 6.0}, headers=SUP)
    assert r.json()["status"] != "closed"

    # practice until the AI sees ≥ 7.0 → ready, then SUP confirms → closed
    for _ in range(3):
        await roleplay(client, PG, GOOD)
    flags = {f["competency"]: f for f in (await client.get("/api/v1/passport", headers=PG)).json()["red_flags"]}
    assert flags["c3"]["status"] == "ready"
    r = await client.post(f"/api/v1/sup/flags/{c3['id']}/stamp", json={"score": 8.0, "note": "Đã quan sát tại quầy"}, headers=SUP)
    assert r.json()["status"] == "closed"
    again = await client.post(f"/api/v1/sup/flags/{c3['id']}/stamp", json={"score": 8.0}, headers=SUP)
    assert again.status_code == 409


async def test_quest_completion_awards_bonus_and_leaderboard(client):
    quest = (await client.get("/api/v1/quests/today", headers=PG)).json()[0]
    report = await roleplay(client, PG, GOOD, code=quest["scenario"]["code"], quest_id=quest["id"])
    assert (await client.get("/api/v1/quests/today", headers=PG)).json()[0]["done"] is True

    board = (await client.get("/api/v1/leaderboard?period=week", headers=PG)).json()
    assert board["me"]["rank"] == 1 and board["me"]["points"] == report["points"] + 20


async def test_session_privacy_and_audio(client):
    r = await client.post("/api/v1/voice/sessions", json={"scenario_code": "CHT01"}, headers=PG)
    sid = r.json()["session_id"]
    ok = await client.post(f"/api/v1/voice/sessions/{sid}/turns", data={"text": "Dạ em chào anh"},
                           files={"audio": ("a.webm", b"\x1a\x45\xdf\xa3fake", "audio/webm")}, headers=PG)
    assert ok.status_code == 200
    bad = await client.post(f"/api/v1/voice/sessions/{sid}/turns", data={"text": "x"},
                            files={"audio": ("a.exe", b"MZ", "application/octet-stream")}, headers=PG)
    assert bad.status_code == 415

    assert (await client.get(f"/api/v1/voice/sessions/{sid}", headers=PG2)).status_code == 404
    assert (await client.get(f"/api/v1/voice/sessions/{sid}/audio/1", headers=PG2)).status_code == 404
    audio = await client.get(f"/api/v1/voice/sessions/{sid}/audio/1", headers=SUP)
    assert audio.status_code == 200 and audio.headers["content-type"] == "audio/webm"
    # a SUP can listen but cannot speak on the PG's behalf
    assert (await client.post(f"/api/v1/voice/sessions/{sid}/turns", data={"text": "x"}, headers=SUP)).status_code == 403


async def test_sup_review_and_field_audit(client):
    report = await roleplay(client, PG, GOOD)
    pg_id = (await client.get("/api/v1/me", headers=PG)).json()["id"]
    r = await client.post(f"/api/v1/sup/sessions/{report['id']}/review", json={"scores": {"c2": 7.0, "c9": 1}}, headers=SUP)
    assert r.status_code == 400
    r = await client.post(f"/api/v1/sup/sessions/{report['id']}/review", json={"scores": {"c2": 7.0}}, headers=SUP)
    assert r.json()["report"]["sup_review"]["scores"] == {"c2": 7.0}

    r = await client.post(f"/api/v1/sup/pgs/{pg_id}/audit", json={"period": "2026-09-01", "revenue_vnd": 633_000_000,
                                                                   "dday_units": 120, "c7_score": 8.5}, headers=SUP)
    assert r.status_code == 200
    detail = (await client.get(f"/api/v1/sup/pgs/{pg_id}", headers=SUP)).json()
    c7 = next(c for c in detail["passport"]["competencies"] if c["key"] == "c7")
    assert c7["score"] == 8.5 and detail["audits"][0]["revenue_vnd"] == 633_000_000

    overview = (await client.get("/api/v1/sup/overview", headers=SUP)).json()
    gap = next(k for k in overview["kpis"] if k["code"] == "AI")
    assert gap["value"] is not None


async def test_quiz_resume_and_profile(client):
    start = (await client.post("/api/v1/quiz/start", headers=PG)).json()
    q0 = start["questions"][0]
    await client.post(f"/api/v1/quiz/{start['attempt_id']}/answer", json={"question_id": q0["id"], "choice": 0, "time_ms": 900}, headers=PG)
    view = (await client.get(f"/api/v1/quiz/{start['attempt_id']}", headers=PG)).json()
    assert "answer" in view["questions"][0] and "answer" not in view["questions"][1]
    assert (await client.get(f"/api/v1/quiz/{start['attempt_id']}", headers=PG2)).status_code == 404
    assert (await client.get("/api/v1/quiz/history", headers=PG)).status_code == 200

    me = (await client.patch("/api/v1/me", json={"store_name": "BHX Q7 - Huỳnh Tấn Phát"}, headers=PG)).json()
    assert me["store_name"] == "BHX Q7 - Huỳnh Tấn Phát" and me["stats"]["points"] == 0


async def test_tts_endpoint(client, monkeypatch):
    from pathlib import Path

    from app.core.config import get_settings
    from app.services import tts

    assert (await client.post("/api/v1/voice/tts", json={"text": "x" * 401}, headers=PG)).status_code == 422
    model = Path(get_settings().tts_model_path)
    if not model.exists():  # CI: no voice model → a clean 503 the client falls back from
        r = await client.post("/api/v1/voice/tts", json={"text": "Chào em"}, headers=PG)
        assert r.status_code == 503
        return
    tts.synthesize.cache_clear()
    r = await client.post("/api/v1/voice/tts", json={"text": "Gói này mắc hơn, em nói đáng tiền là đáng chỗ nào?", "group": "customer"}, headers=PG)
    assert r.status_code == 200 and r.headers["content-type"] == "audio/wav" and r.content[:4] == b"RIFF"
