"""AI Voice Simulator 360°: roleplay sessions against the scenario bank."""
from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_user
from app.core.config import get_settings
from app.db.database import get_db
from app.models.models import AssessmentSource, Quest, SessionKind, TurnAudio, User, UserRole, VoiceSession
from app.services import mock_ai
from app.services.content import COMPETENCIES, level_of, scenario_public, scenarios
from app.services.passport import QUEST_BONUS, add_points, now, record_assessments

router = APIRouter(prefix="/voice")
AUDIO_TYPES = ("audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav", "audio/aac", "audio/x-m4a")


class SessionIn(BaseModel):
    scenario_code: str
    kind: SessionKind = SessionKind.PRACTICE
    quest_id: str | None = None


def _scenario(code: str) -> dict:
    s = scenarios().get(code)
    if s is None:
        raise HTTPException(404, "Không tìm thấy tình huống")
    return s


async def _session(db: AsyncSession, session_id: str, user: User, lock: bool = False) -> VoiceSession:
    s = await db.get(VoiceSession, session_id, with_for_update=lock)
    if s is None or (s.user_id != user.id and user.role is not UserRole.SUPERVISOR):
        raise HTTPException(404, "Không tìm thấy phiên luyện")
    return s


@router.get("/scenarios")
async def list_scenarios(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    best = dict((await db.execute(
        select(VoiceSession.scenario_code, func.max(VoiceSession.overall))
        .where(VoiceSession.user_id == user.id, VoiceSession.completed_at.is_not(None))
        .group_by(VoiceSession.scenario_code)
    )).all())
    return [{**scenario_public(s), "best": best.get(code)} for code, s in scenarios().items()]


@router.get("/scenarios/{code}")
async def get_scenario(code: str, user: User = Depends(current_user)):
    s = _scenario(code)
    return {**scenario_public(s), "competency_names": {c: COMPETENCIES[c][0] for c in s["competencies"]}}


@router.post("/sessions")
async def create_session(body: SessionIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    s = _scenario(body.scenario_code)
    if body.quest_id:
        quest = await db.get(Quest, body.quest_id)
        if quest is None or quest.user_id != user.id or quest.scenario_code != body.scenario_code:
            raise HTTPException(400, "Nhiệm vụ không hợp lệ")
    session = VoiceSession(user_id=user.id, scenario_code=s["code"], kind=body.kind, quest_id=body.quest_id,
                           turns=[{"role": "ai", "text": s["opening"]}], started_at=now())
    db.add(session)
    await db.flush()
    return {"session_id": session.id, "opening": s["opening"], "group": s["group"],
            "max_turns": mock_ai.MAX_PG_TURNS}


@router.post("/sessions/{session_id}/turns")
async def add_turn(
    session_id: str,
    text: str = Form(..., min_length=1, max_length=1000),
    latency_ms: int | None = Form(None, ge=0, le=120_000),
    audio: UploadFile | None = File(None),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await _session(db, session_id, user, lock=True)
    if session.user_id != user.id:
        raise HTTPException(403, "Không thể trả lời thay PG")
    if session.completed_at is not None:
        raise HTTPException(409, "Phiên luyện đã kết thúc")
    pg_turns = [t["text"] for t in session.turns if t["role"] == "pg"]
    if len(pg_turns) >= mock_ai.MAX_PG_TURNS:
        raise HTTPException(409, "Đã đủ số lượt, hãy kết thúc để xem điểm")

    index = len(session.turns)
    if audio is not None:
        mime = (audio.content_type or "").split(";")[0]
        if mime not in AUDIO_TYPES:
            raise HTTPException(415, "Định dạng ghi âm không hỗ trợ")
        data = await audio.read(get_settings().max_audio_bytes + 1)
        if len(data) > get_settings().max_audio_bytes:
            raise HTTPException(413, "File ghi âm quá lớn")
        db.add(TurnAudio(session_id=session.id, turn_index=index, mime=mime, data=data))

    scenario = _scenario(session.scenario_code)
    reply = mock_ai.persona_reply(scenario, [*pg_turns, text], session.revealed)
    session.turns = [
        *session.turns,
        {"role": "pg", "text": text.strip(), "latency_ms": latency_ms, "has_audio": audio is not None},
        {"role": "ai", "text": reply.text, "mood": reply.mood, "action": reply.action},
    ]
    session.revealed = [*session.revealed, *reply.revealed]
    return {"reply": reply.text, "action": reply.action, "mood": reply.mood, "ended": reply.ended,
            "turns_left": mock_ai.MAX_PG_TURNS - len(pg_turns) - 1}


@router.post("/sessions/{session_id}/finish")
async def finish(session_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    session = await _session(db, session_id, user, lock=True)
    if session.user_id != user.id:
        raise HTTPException(403, "Không thể nộp thay PG")
    if session.completed_at is None:
        report = mock_ai.judge(_scenario(session.scenario_code), session.turns)
        session.report, session.scores, session.overall = report, report["scores"], report["overall"]
        session.completed_at = now()
        session.points = round((report["overall"] or 0) * 10)
        await record_assessments(db, user, report["scores"], AssessmentSource.VOICE, ref_id=session.id)
        await add_points(db, user.id, session.points, "voice", session.id)
        if session.quest_id:
            quest = await db.get(Quest, session.quest_id)
            if quest and quest.completed_at is None:
                quest.completed_at, quest.session_id = now(), session.id
                await add_points(db, user.id, QUEST_BONUS, "quest", quest.id)
    return session_view(session)


@router.get("/sessions/{session_id}")
async def get_session(session_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    return session_view(await _session(db, session_id, user))


@router.get("/sessions/{session_id}/audio/{turn_index}")
async def get_audio(session_id: str, turn_index: int, user: User = Depends(current_user),
                    db: AsyncSession = Depends(get_db)):
    await _session(db, session_id, user)
    clip = await db.get(TurnAudio, (session_id, turn_index))
    if clip is None:
        raise HTTPException(404, "Không có ghi âm")
    return Response(clip.data, media_type=clip.mime, headers={"Cache-Control": "private, max-age=3600"})


@router.get("/sessions")
async def my_sessions(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.scalars(select(VoiceSession).where(
        VoiceSession.user_id == user.id, VoiceSession.completed_at.is_not(None)
    ).order_by(VoiceSession.completed_at.desc()).limit(20))).all()
    return [session_summary(s) for s in rows]


def session_summary(s: VoiceSession) -> dict:
    sc = scenarios().get(s.scenario_code, {})
    return {"id": s.id, "scenario_code": s.scenario_code, "title": sc.get("title"), "group": sc.get("group"),
            "kind": s.kind.value, "overall": s.overall, "level": level_of(s.overall), "points": s.points,
            "started_at": s.started_at, "completed_at": s.completed_at,
            "sup_reviewed": bool((s.report or {}).get("sup_review"))}


def session_view(s: VoiceSession) -> dict:
    return {
        **session_summary(s),
        "scenario": scenario_public(scenarios()[s.scenario_code]),
        "turns": s.turns,
        "scores": [{"key": c, "name": COMPETENCIES[c][0], "score": v, "level": level_of(v)}
                   for c, v in (s.scores or {}).items()],
        "report": s.report,
    }
