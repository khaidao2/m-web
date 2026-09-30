"""3-minute quiz: random draw per category, Kahoot-style speed points, feeds the passport."""
import random
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_user
from app.db.database import get_db
from app.models.models import AssessmentSource, QuizAttempt, User
from app.services.content import quiz_bank
from app.services.passport import add_points, now, record_assessments

router = APIRouter(prefix="/quiz")
GRACE_SECONDS = 10


class AnswerIn(BaseModel):
    question_id: str
    choice: int | None = Field(None, ge=0, le=3)   # None = hết giờ
    time_ms: int = Field(ge=0)


def _question_public(q: dict) -> dict:
    return {k: q[k] for k in ("id", "category", "prompt", "options", "visual")}


async def _own_attempt(db: AsyncSession, attempt_id: str, user: User, lock: bool = False) -> QuizAttempt:
    attempt = await db.get(QuizAttempt, attempt_id, with_for_update=lock)
    if attempt is None or attempt.user_id != user.id:
        raise HTTPException(404, "Không tìm thấy bài quiz")
    return attempt


@router.post("/start")
async def start(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    bank = quiz_bank()
    picked: list[dict] = []
    for cat in bank["categories"]:
        pool = [q for q in bank["questions"] if q["category"] == cat]
        picked += random.sample(pool, min(bank["per_category"], len(pool)))
    random.shuffle(picked)
    attempt = QuizAttempt(user_id=user.id, question_ids=[q["id"] for q in picked], started_at=now())
    db.add(attempt)
    await db.flush()
    return {
        "attempt_id": attempt.id,
        "time_limit_seconds": bank["time_limit_seconds"],
        "question_seconds": bank["question_seconds"],
        "categories": bank["categories"],
        "note": bank["note"],
        "questions": [_question_public(q) for q in picked],
    }


@router.post("/{attempt_id}/answer")
async def answer(attempt_id: str, body: AnswerIn, user: User = Depends(current_user),
                 db: AsyncSession = Depends(get_db)):
    attempt = await _own_attempt(db, attempt_id, user, lock=True)
    bank = quiz_bank()
    if attempt.completed_at is not None:
        raise HTTPException(409, "Bài quiz đã kết thúc")
    if now() - attempt.started_at > timedelta(seconds=bank["time_limit_seconds"] + GRACE_SECONDS):
        raise HTTPException(409, "Đã hết 3 phút")
    if body.question_id not in attempt.question_ids or any(a["question_id"] == body.question_id for a in attempt.answers):
        raise HTTPException(400, "Câu hỏi không hợp lệ hoặc đã trả lời")

    q = next(q for q in bank["questions"] if q["id"] == body.question_id)
    correct = body.choice == q["answer"]
    limit_ms = bank["question_seconds"] * 1000
    streak = 0
    for a in reversed(attempt.answers):
        if not a["correct"]:
            break
        streak += 1
    points = 0
    if correct:
        points = 500 + round(500 * max(0.0, 1 - body.time_ms / limit_ms))
        if streak >= 2:
            points += 100
    attempt.answers = [*attempt.answers, {"question_id": q["id"], "choice": body.choice, "correct": correct,
                                          "time_ms": body.time_ms, "points": points}]
    return {"correct": correct, "answer": q["answer"], "explain": q["explain"], "points": points,
            "streak": streak + 1 if correct else 0}


@router.post("/{attempt_id}/finish")
async def finish(attempt_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    attempt = await _own_attempt(db, attempt_id, user, lock=True)
    if attempt.completed_at is not None:
        return _result(attempt)
    bank = quiz_bank()
    by_cat: dict[str, dict] = {c: {"correct": 0, "total": 0} for c in bank["categories"]}
    qmap = {q["id"]: q for q in bank["questions"]}
    answered = {a["question_id"]: a for a in attempt.answers}
    for qid in attempt.question_ids:
        cat = by_cat[qmap[qid]["category"]]
        cat["total"] += 1
        cat["correct"] += int(answered.get(qid, {}).get("correct", False))
    attempt.by_category = by_cat
    attempt.correct = sum(c["correct"] for c in by_cat.values())
    attempt.points = sum(a["points"] for a in attempt.answers)
    attempt.completed_at = now()

    # quiz knowledge → passport: each category informs its competency on the 0–10 scale
    per_comp: dict[str, list[int]] = {}
    for cat, r in by_cat.items():
        comp = bank["categories"][cat]["competency"]
        acc = per_comp.setdefault(comp, [0, 0])
        acc[0] += r["correct"]
        acc[1] += r["total"]
    scores = {c: round(10 * ok / total, 1) for c, (ok, total) in per_comp.items() if total}
    await record_assessments(db, user, scores, AssessmentSource.QUIZ, ref_id=attempt.id)
    await add_points(db, user.id, round(attempt.points / 50), "quiz", attempt.id)
    return _result(attempt)


def _result(a: QuizAttempt) -> dict:
    total = len(a.question_ids)
    return {"attempt_id": a.id, "correct": a.correct, "total": total, "points": a.points,
            "leaderboard_points": round(a.points / 50), "by_category": a.by_category,
            "percent": round(100 * a.correct / total) if total else 0, "completed_at": a.completed_at}


@router.get("/history")
async def history(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.scalars(select(QuizAttempt).where(
        QuizAttempt.user_id == user.id, QuizAttempt.completed_at.is_not(None)
    ).order_by(QuizAttempt.completed_at.desc()).limit(10))).all()
    return [_result(a) for a in rows]


@router.get("/{attempt_id}")
async def get_attempt(attempt_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """Lets the game screen load or resume an attempt; answers are revealed only once answered."""
    attempt = await _own_attempt(db, attempt_id, user)
    bank = quiz_bank()
    qmap = {q["id"]: q for q in bank["questions"]}
    answered = {a["question_id"]: a for a in attempt.answers}
    return {
        "attempt_id": attempt.id,
        "started_at": attempt.started_at,
        "time_limit_seconds": bank["time_limit_seconds"],
        "question_seconds": bank["question_seconds"],
        "categories": bank["categories"],
        "note": bank["note"],
        "questions": [
            {**_question_public(qmap[qid]),
             **({"answered": answered[qid], "answer": qmap[qid]["answer"], "explain": qmap[qid]["explain"]}
                if qid in answered else {})}
            for qid in attempt.question_ids
        ],
        "result": _result(attempt) if attempt.completed_at else None,
    }
