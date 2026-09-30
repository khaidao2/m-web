import uuid
import math
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.db.database import get_db
from app.models.models import User, Quiz, QuizAttempt, PGPassport, DailyQuest, SessionStatus
from app.core.auth import verify_token, get_current_user_info
from app.api.users import get_or_create_user
from app.api.passport import get_or_create_passport, COMPETENCY_FIELDS

router = APIRouter()


class SubmitAnswers(BaseModel):
    answers: list[dict]  # [{question_id, selected, time_ms}]


def score_to_competency_level(score_pct: float) -> float:
    """Convert 0-100% score to 1.0-4.0 competency level."""
    if score_pct >= 87.5:
        return 4.0
    elif score_pct >= 62.5:
        return 3.0 + (score_pct - 62.5) / 25.0 * 0.9
    elif score_pct >= 37.5:
        return 2.0 + (score_pct - 37.5) / 25.0 * 0.9
    else:
        return 1.0 + score_pct / 37.5 * 0.9


@router.get("/quizzes")
async def list_quizzes(
    category: Optional[str] = None,
    payload: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db),
):
    query = select(Quiz).where(Quiz.is_active == True)
    if category:
        query = query.where(Quiz.category == category)
    result = await db.execute(query)
    quizzes = result.scalars().all()
    return [
        {
            "id": q.id,
            "title": q.title,
            "description": q.description,
            "category": q.category,
            "competency_target": q.competency_target,
            "question_count": len(q.questions),
            "time_limit_seconds": q.time_limit_seconds,
        }
        for q in quizzes
    ]


@router.get("/quizzes/attempts")
async def list_my_attempts(
    payload: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db),
):
    user_info = await get_current_user_info(payload)
    user = await get_or_create_user(db, user_info)

    result = await db.execute(
        select(QuizAttempt).where(QuizAttempt.user_id == user.id)
        .order_by(QuizAttempt.started_at.desc()).limit(50)
    )
    attempts = result.scalars().all()
    return [
        {
            "id": a.id,
            "quiz_id": a.quiz_id,
            "score": a.score,
            "points_earned": a.points_earned,
            "status": a.status,
            "started_at": a.started_at,
            "completed_at": a.completed_at,
        }
        for a in attempts
    ]


@router.get("/quizzes/{quiz_id}")
async def get_quiz(
    quiz_id: str,
    payload: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Quiz).where(Quiz.id == quiz_id, Quiz.is_active == True))
    quiz = result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz không tồn tại")

    # Strip correct answers from questions
    questions = [
        {k: v for k, v in q.items() if k != "correct"}
        for q in quiz.questions
    ]

    return {
        "id": quiz.id,
        "title": quiz.title,
        "description": quiz.description,
        "category": quiz.category,
        "competency_target": quiz.competency_target,
        "questions": questions,
        "time_limit_seconds": quiz.time_limit_seconds,
    }


@router.post("/quizzes/{quiz_id}/start")
async def start_quiz(
    quiz_id: str,
    payload: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db),
):
    user_info = await get_current_user_info(payload)
    user = await get_or_create_user(db, user_info)

    result = await db.execute(select(Quiz).where(Quiz.id == quiz_id, Quiz.is_active == True))
    quiz = result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz không tồn tại")

    attempt = QuizAttempt(
        id=str(uuid.uuid4()),
        user_id=user.id,
        quiz_id=quiz_id,
        status=SessionStatus.IN_PROGRESS,
    )
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)
    return {"attempt_id": attempt.id, "started_at": attempt.started_at}


@router.post("/quizzes/attempts/{attempt_id}/submit")
async def submit_quiz(
    attempt_id: str,
    data: SubmitAnswers,
    payload: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db),
):
    user_info = await get_current_user_info(payload)
    user = await get_or_create_user(db, user_info)

    result = await db.execute(
        select(QuizAttempt).where(QuizAttempt.id == attempt_id, QuizAttempt.user_id == user.id)
    )
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Không tìm thấy lần làm bài")
    if attempt.status == SessionStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Bài kiểm tra đã được nộp")

    # Get quiz for answers
    quiz_result = await db.execute(select(Quiz).where(Quiz.id == attempt.quiz_id))
    quiz = quiz_result.scalar_one()

    # Grade answers
    correct_map = {q["id"]: q["correct"] for q in quiz.questions}
    graded = []
    correct_count = 0
    total_time = 0

    for ans in data.answers:
        qid = ans.get("question_id")
        selected = ans.get("selected")
        is_correct = correct_map.get(qid) == selected
        if is_correct:
            correct_count += 1
        total_time += ans.get("time_ms", 0)
        graded.append({
            "question_id": qid,
            "selected": selected,
            "correct": correct_map.get(qid),
            "is_correct": is_correct,
            "time_ms": ans.get("time_ms", 0),
        })

    total_questions = len(quiz.questions)
    score_pct = (correct_count / total_questions * 100) if total_questions > 0 else 0
    points = math.floor(score_pct / 10) * 10

    # Update attempt
    attempt.score = round(score_pct, 1)
    attempt.points_earned = points
    attempt.answers = graded
    attempt.time_taken_seconds = total_time // 1000
    attempt.status = SessionStatus.COMPLETED
    attempt.completed_at = datetime.now(timezone.utc)

    # Update passport competency
    if quiz.competency_target:
        passport = await get_or_create_passport(db, user.id)
        field_map = {
            "c1": "c1_approach", "c2": "c2_discovery", "c3": "c3_storytelling",
            "c4": "c4_expansion", "c5": "c5_objection", "c6": "c6_negotiation",
            "c7": "c7_discipline",
        }
        field = field_map.get(quiz.competency_target)
        if field:
            current = getattr(passport, field)
            new_level = score_to_competency_level(score_pct)
            # Weighted average: 70% new, 30% old (only if already scored)
            updated = round(new_level * 0.7 + current * 0.3 if current > 0 else new_level, 2)
            setattr(passport, field, updated)

        # Recompute overall and red flags
        all_scores = [getattr(passport, f) for f in COMPETENCY_FIELDS]
        non_zero = [s for s in all_scores if s > 0]
        passport.overall_score = round(sum(non_zero) / len(non_zero), 2) if non_zero else 0.0
        passport.red_flags = [f for f in COMPETENCY_FIELDS if 0 < getattr(passport, f) < 2.0]
        passport.total_points = (passport.total_points or 0) + points
        passport.last_assessment_at = datetime.now(timezone.utc)

        # Trigger daily quest for red flags
        for red_flag in passport.red_flags:
            existing = await db.execute(
                select(DailyQuest).where(
                    DailyQuest.user_id == user.id,
                    DailyQuest.target_competency == red_flag,
                    DailyQuest.is_completed == False,
                )
            )
            if not existing.scalar_one_or_none():
                quest = DailyQuest(
                    id=str(uuid.uuid4()),
                    user_id=user.id,
                    title=f"Cải thiện năng lực {red_flag.upper()}",
                    description=f"Luyện tập để nâng cao điểm {red_flag} lên Level 2 trở lên",
                    target_competency=red_flag,
                    task_type="quiz",
                    task_id=quiz.id,
                )
                db.add(quest)

    await db.commit()
    return {
        "score": attempt.score,
        "correct_count": correct_count,
        "total_questions": total_questions,
        "points_earned": points,
        "graded_answers": graded,
        "message": "Nộp bài thành công!",
    }
