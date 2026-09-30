import uuid
import time
import io
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.db.database import get_db
from app.models.models import VoiceScenario, VoiceSession, PGPassport, SessionStatus
from app.core.auth import verify_token, get_current_user_info, require_role
from app.core.config import get_settings
from app.api.users import get_or_create_user
from app.api.passport import get_or_create_passport, COMPETENCY_FIELDS

router = APIRouter()
settings = get_settings()


class CreateSessionRequest(BaseModel):
    scenario_id: str


class ChatRequest(BaseModel):
    transcript: str


class TTSRequest(BaseModel):
    text: str


class StampRequest(BaseModel):
    notes: Optional[str] = None


def get_openai_client():
    if not settings.openai_api_key:
        return None
    import openai
    return openai.AsyncOpenAI(api_key=settings.openai_api_key)


def get_anthropic_client():
    if not settings.anthropic_api_key:
        return None
    import anthropic
    return anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)


@router.get("/voice/scenarios")
async def list_scenarios(
    payload: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(VoiceScenario).where(VoiceScenario.is_active == True))
    scenarios = result.scalars().all()
    return [
        {
            "id": s.id,
            "title": s.title,
            "description": s.description,
            "scenario_type": s.scenario_type,
            "target_competencies": s.target_competencies,
            "difficulty": s.difficulty,
            "duration_minutes": s.duration_minutes,
        }
        for s in scenarios
    ]


@router.get("/voice/scenarios/{scenario_id}")
async def get_scenario(
    scenario_id: str,
    payload: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(VoiceScenario).where(VoiceScenario.id == scenario_id))
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise HTTPException(status_code=404, detail="Kịch bản không tồn tại")
    return {
        "id": scenario.id,
        "title": scenario.title,
        "description": scenario.description,
        "scenario_type": scenario.scenario_type,
        "target_competencies": scenario.target_competencies,
        "difficulty": scenario.difficulty,
        "duration_minutes": scenario.duration_minutes,
    }


@router.post("/voice/sessions")
async def create_session(
    req: CreateSessionRequest,
    payload: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db),
):
    user_info = await get_current_user_info(payload)
    user = await get_or_create_user(db, user_info)

    result = await db.execute(select(VoiceScenario).where(VoiceScenario.id == req.scenario_id))
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise HTTPException(status_code=404, detail="Kịch bản không tồn tại")

    session = VoiceSession(
        id=str(uuid.uuid4()),
        user_id=user.id,
        scenario_id=req.scenario_id,
        status=SessionStatus.IN_PROGRESS,
        conversation_history=[],
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return {"session_id": session.id, "scenario_id": req.scenario_id}


@router.post("/voice/sessions/{session_id}/transcribe")
async def transcribe_audio(
    session_id: str,
    audio: UploadFile = File(...),
    payload: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db),
):
    user_info = await get_current_user_info(payload)
    user = await get_or_create_user(db, user_info)

    result = await db.execute(
        select(VoiceSession).where(VoiceSession.id == session_id, VoiceSession.user_id == user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Phiên không tồn tại")

    start_ms = int(time.time() * 1000)

    client = get_openai_client()
    if not client:
        # Fallback: return placeholder transcript
        return {
            "transcript": "(Chưa cấu hình OpenAI API key - đây là transcript mẫu)",
            "latency_ms": 0,
        }

    try:
        audio_bytes = await audio.read()
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = "audio.webm"

        response = await client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language="vi",
        )
        latency = int(time.time() * 1000) - start_ms
        return {"transcript": response.text, "latency_ms": latency}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Lỗi nhận diện giọng nói: {str(e)}")


@router.post("/voice/sessions/{session_id}/chat")
async def chat_with_ai(
    session_id: str,
    req: ChatRequest,
    payload: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db),
):
    user_info = await get_current_user_info(payload)
    user = await get_or_create_user(db, user_info)

    result = await db.execute(
        select(VoiceSession).where(VoiceSession.id == session_id, VoiceSession.user_id == user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Phiên không tồn tại")

    # Get scenario for persona prompt
    scenario_result = await db.execute(select(VoiceScenario).where(VoiceScenario.id == session.scenario_id))
    scenario = scenario_result.scalar_one()

    # Build conversation history
    history = session.conversation_history or []
    history.append({"role": "user", "content": req.transcript, "timestamp": datetime.now(timezone.utc).isoformat()})

    client = get_anthropic_client()
    if not client:
        ai_response = "(Chưa cấu hình Anthropic API key - đây là phản hồi AI mẫu: Tôi hiểu ý bạn, bạn có thể nói thêm không?)"
    else:
        try:
            messages = [{"role": m["role"], "content": m["content"]}
                       for m in history if m["role"] in ["user", "assistant"]]
            response = await client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=512,
                system=scenario.persona_prompt,
                messages=messages,
            )
            ai_response = response.content[0].text
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Lỗi AI: {str(e)}")

    history.append({"role": "assistant", "content": ai_response, "timestamp": datetime.now(timezone.utc).isoformat()})
    session.conversation_history = history
    await db.commit()

    return {"ai_response": ai_response, "role": "assistant"}


@router.post("/voice/sessions/{session_id}/tts")
async def text_to_speech(
    session_id: str,
    req: TTSRequest,
    payload: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db),
):
    user_info = await get_current_user_info(payload)
    user = await get_or_create_user(db, user_info)

    result = await db.execute(
        select(VoiceSession).where(VoiceSession.id == session_id, VoiceSession.user_id == user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Phiên không tồn tại")

    client = get_openai_client()
    if not client:
        raise HTTPException(status_code=503, detail="Chưa cấu hình TTS API key")

    try:
        response = await client.audio.speech.create(
            model="tts-1",
            voice="nova",
            input=req.text,
        )
        audio_bytes = response.content
        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/mpeg",
            headers={"Content-Length": str(len(audio_bytes))},
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Lỗi TTS: {str(e)}")


@router.post("/voice/sessions/{session_id}/complete")
async def complete_session(
    session_id: str,
    payload: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db),
):
    user_info = await get_current_user_info(payload)
    user = await get_or_create_user(db, user_info)

    result = await db.execute(
        select(VoiceSession).where(VoiceSession.id == session_id, VoiceSession.user_id == user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Phiên không tồn tại")

    # Use Claude to analyze conversation and score competencies
    client = get_anthropic_client()
    scenario_result = await db.execute(select(VoiceScenario).where(VoiceScenario.id == session.scenario_id))
    scenario = scenario_result.scalar_one()

    history_text = "\n".join([
        f"{'PG' if m['role'] == 'user' else 'AI'}: {m['content']}"
        for m in (session.conversation_history or [])
    ])

    scores = {f: 2.0 for f in COMPETENCY_FIELDS}  # default scores

    if client and history_text:
        try:
            analysis_prompt = f"""Bạn là chuyên gia đánh giá năng lực bán hàng của Masan Consumer.
Phân tích cuộc hội thoại dưới đây và cho điểm PG theo 7 tiêu chí (thang 1.0-4.0):

c1_approach: Tiếp cận & Thiết lập kết nối (1.0-4.0)
c2_discovery: Thấu hiểu & Khơi gợi nhu cầu (1.0-4.0)
c3_storytelling: Tư vấn giải pháp sản phẩm (1.0-4.0)
c4_expansion: Gia tăng giá trị giỏ hàng (1.0-4.0)
c5_objection: Xử lý phản bác & Củng cố niềm tin (1.0-4.0)
c6_negotiation: Đàm phán & Thuyết phục (1.0-4.0)
c7_discipline: Thái độ & Kỷ luật (1.0-4.0)

Cuộc hội thoại:
{history_text}

Trả về JSON ONLY (không có text khác):
{{"c1_approach": X.X, "c2_discovery": X.X, "c3_storytelling": X.X, "c4_expansion": X.X, "c5_objection": X.X, "c6_negotiation": X.X, "c7_discipline": X.X, "feedback": "Nhận xét ngắn bằng tiếng Việt"}}"""

            response = await client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=512,
                messages=[{"role": "user", "content": analysis_prompt}],
            )
            import json
            try:
                analysis = json.loads(response.content[0].text)
                for field in COMPETENCY_FIELDS:
                    if field in analysis:
                        scores[field] = float(analysis[field])
                session.feedback_summary = analysis.get("feedback", "")
            except json.JSONDecodeError:
                pass
        except Exception:
            pass

    # Compute points (0-100 based on average competency level)
    avg_score = sum(scores.values()) / 7
    points = int((avg_score / 4.0) * 100)

    session.scores = scores
    session.overall_score = round(avg_score, 2)
    session.points_earned = points
    session.status = SessionStatus.COMPLETED
    session.completed_at = datetime.now(timezone.utc)

    # Update passport
    passport = await get_or_create_passport(db, user.id)
    for field in COMPETENCY_FIELDS:
        current = getattr(passport, field)
        new_level = scores[field]
        updated = round(new_level * 0.7 + current * 0.3 if current > 0 else new_level, 2)
        setattr(passport, field, updated)

    all_scores = [getattr(passport, f) for f in COMPETENCY_FIELDS]
    non_zero = [s for s in all_scores if s > 0]
    passport.overall_score = round(sum(non_zero) / len(non_zero), 2) if non_zero else 0.0
    passport.red_flags = [f for f in COMPETENCY_FIELDS if 0 < getattr(passport, f) < 2.0]
    passport.total_points = (passport.total_points or 0) + points
    passport.last_assessment_at = datetime.now(timezone.utc)

    await db.commit()
    return {
        "message": "Hoàn thành phiên luyện tập!",
        "scores": scores,
        "overall_score": session.overall_score,
        "points_earned": points,
        "feedback": session.feedback_summary,
    }


@router.post("/voice/sessions/{session_id}/stamp")
async def stamp_session(
    session_id: str,
    req: StampRequest,
    payload: dict = Depends(require_role("supervisor", "admin")),
    db: AsyncSession = Depends(get_db),
):
    user_info = await get_current_user_info(payload)
    supervisor = await get_or_create_user(db, user_info)

    result = await db.execute(select(VoiceSession).where(VoiceSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Phiên không tồn tại")

    session.supervisor_stamp = True
    session.supervisor_id = supervisor.id
    session.supervisor_notes = req.notes
    session.stamped_at = datetime.now(timezone.utc)

    # Remove red flags related to this scenario's competencies
    passport = await get_or_create_passport(db, session.user_id)
    scenario_result = await db.execute(select(VoiceScenario).where(VoiceScenario.id == session.scenario_id))
    scenario = scenario_result.scalar_one()
    current_flags = set(passport.red_flags or [])
    for comp in scenario.target_competencies:
        field_map = {"c1": "c1_approach", "c2": "c2_discovery", "c3": "c3_storytelling",
                     "c4": "c4_expansion", "c5": "c5_objection", "c6": "c6_negotiation",
                     "c7": "c7_discipline"}
        field = field_map.get(comp)
        if field and field in current_flags:
            val = getattr(passport, field)
            if val >= 2.0:
                current_flags.discard(field)
    passport.red_flags = list(current_flags)

    await db.commit()
    return {"message": "Đã xác nhận stamp thành công. Xóa cờ đỏ liên quan."}
