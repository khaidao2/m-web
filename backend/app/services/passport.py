"""Digital Passport rules: competency scores, Red Flags, daily quests and points.

Doc rules (§IV, Workstream 2/3):
- Red Flag when a competency score falls below 5.0.
- Reaching 7.0 makes a flag *ready*; only a SUP stamp (score ≥ 7.0) closes it.
- One daily roleplay per PG; unresolved Red Flag quests carry over and are listed first.
"""
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import (
    Assessment, AssessmentSource, FlagStatus, PointsEntry, Quest, RedFlag, User, VoiceSession,
)
from app.services.content import CLOSE_AT, COMPETENCIES, RED_FLAG_BELOW, level_of, scenarios

WINDOW = 3            # a competency score is the mean of its latest 3 observations
QUEST_BONUS = 20
DAILY_REPEAT_DAYS = 30


def now() -> datetime:
    return datetime.now(timezone.utc)


async def competency_scores(db: AsyncSession, user_id: str) -> dict[str, float | None]:
    rows = (await db.execute(
        select(Assessment.competency, Assessment.score)
        .where(Assessment.user_id == user_id)
        .order_by(Assessment.created_at.desc())
    )).all()
    recent: dict[str, list[float]] = {}
    for comp, score in rows:
        if len(recent.setdefault(comp, [])) < WINDOW:
            recent[comp].append(score)
    return {c: round(sum(v) / len(v), 1) if (v := recent.get(c)) else None for c in COMPETENCIES}


def overall(scores: dict[str, float | None]) -> float | None:
    vals = [v for v in scores.values() if v is not None]
    return round(sum(vals) / len(vals), 1) if vals else None


async def record_assessments(
    db: AsyncSession, user: User, scores: dict[str, float | None], source: AssessmentSource,
    ref_id: str | None = None, created_by: str | None = None,
) -> None:
    """Stores new observations, then opens / readies Red Flags from the updated passport."""
    for comp, score in scores.items():
        if score is not None:
            db.add(Assessment(user_id=user.id, competency=comp, score=score, source=source,
                              ref_id=ref_id, created_by=created_by))
    await db.flush()
    await sync_red_flags(db, user.id)


async def sync_red_flags(db: AsyncSession, user_id: str) -> None:
    scores = await competency_scores(db, user_id)
    active = {f.competency: f for f in (await db.scalars(
        select(RedFlag).where(RedFlag.user_id == user_id, RedFlag.status != FlagStatus.CLOSED)
    )).all()}
    for comp, score in scores.items():
        if score is None:
            continue
        flag = active.get(comp)
        if flag is None and score < RED_FLAG_BELOW:
            db.add(RedFlag(user_id=user_id, competency=comp, opened_score=score))
        elif flag is not None and flag.status is FlagStatus.OPEN and score >= CLOSE_AT:
            flag.status, flag.ready_at = FlagStatus.READY, now()
        elif flag is not None and flag.status is FlagStatus.READY and score < CLOSE_AT:
            flag.status, flag.ready_at = FlagStatus.OPEN, None
    await db.flush()


async def stamp_flag(db: AsyncSession, flag: RedFlag, sup: User, sup_score: float, note: str | None) -> None:
    """SUP field verification. Closes the flag only when the SUP confirms ≥ 7.0."""
    user = await db.get(User, flag.user_id)
    db.add(Assessment(user_id=flag.user_id, competency=flag.competency, score=sup_score,
                      source=AssessmentSource.SUP, ref_id=flag.id, created_by=sup.id))
    flag.sup_score, flag.sup_note = sup_score, note
    if sup_score >= CLOSE_AT:
        flag.status, flag.closed_at, flag.closed_by = FlagStatus.CLOSED, now(), sup.id
    await db.flush()
    await sync_red_flags(db, user.id)


async def add_points(db: AsyncSession, user_id: str, points: int, reason: str, ref_id: str | None = None) -> None:
    if points > 0:
        db.add(PointsEntry(user_id=user_id, points=points, reason=reason, ref_id=ref_id))


def _pick_scenario(candidates: list[str], recent: dict[str, datetime], seed: int) -> str:
    """Least-recently practised first; ties rotate by `seed` so PGs don't all get the same case."""
    never = [c for c in candidates if c not in recent]
    pool = never or sorted(candidates, key=lambda c: recent[c])[: max(1, len(candidates) // 3)]
    return pool[seed % len(pool)]


async def todays_quests(db: AsyncSession, user: User, today: date) -> list[Quest]:
    """Ensures today's quests exist and returns them with carried-over Red Flag quests first."""
    existing = (await db.scalars(select(Quest).where(Quest.user_id == user.id, Quest.day == today))).all()
    if not existing:
        await _assign(db, user, today)
    carried = (await db.scalars(
        select(Quest).where(Quest.user_id == user.id, Quest.day < today, Quest.completed_at.is_(None),
                            Quest.red_flag_id.is_not(None))
    )).all()
    todays = (await db.scalars(select(Quest).where(Quest.user_id == user.id, Quest.day == today))).all()
    flags = {f.id: f for f in (await db.scalars(select(RedFlag).where(RedFlag.user_id == user.id))).all()}
    # a carried quest is dropped once its flag is closed
    carried = [q for q in carried if flags.get(q.red_flag_id) and flags[q.red_flag_id].status is not FlagStatus.CLOSED]
    return sorted([*carried, *todays], key=lambda q: (q.completed_at is not None, q.red_flag_id is None, q.day))


async def _assign(db: AsyncSession, user: User, today: date) -> None:
    bank = scenarios()
    recent = dict((await db.execute(
        select(VoiceSession.scenario_code, func.max(VoiceSession.started_at))
        .where(VoiceSession.user_id == user.id).group_by(VoiceSession.scenario_code)
    )).all())
    seed = today.toordinal() + sum(map(ord, user.id))
    flags = (await db.scalars(
        select(RedFlag).where(RedFlag.user_id == user.id, RedFlag.status != FlagStatus.CLOSED)
    )).all()
    pending_flag_ids = set((await db.scalars(
        select(Quest.red_flag_id).where(Quest.user_id == user.id, Quest.completed_at.is_(None),
                                        Quest.red_flag_id.is_not(None))
    )).all())
    chosen: set[str] = set()
    for flag in flags:
        if flag.id in pending_flag_ids:
            continue  # the carried-over quest already covers this flag
        options = [c for c, s in bank.items() if flag.competency in s["competencies"] and c not in chosen]
        if not options:  # c7 has no roleplay scenarios; SUP verifies it in the field
            continue
        code = _pick_scenario(options, recent, seed)
        chosen.add(code)
        db.add(Quest(user_id=user.id, day=today, scenario_code=code, red_flag_id=flag.id, competency=flag.competency))

    cutoff = now() - timedelta(days=DAILY_REPEAT_DAYS)
    fresh = [c for c in bank if c not in chosen and (c not in recent or recent[c] < cutoff)]
    daily = _pick_scenario(fresh or [c for c in bank if c not in chosen], recent, seed)
    db.add(Quest(user_id=user.id, day=today, scenario_code=daily))
    await db.flush()


async def passport_view(db: AsyncSession, user: User) -> dict:
    scores = await competency_scores(db, user.id)
    flags = (await db.scalars(
        select(RedFlag).where(RedFlag.user_id == user.id).order_by(RedFlag.opened_at.desc())
    )).all()
    return {
        "overall": overall(scores),
        "overall_level": level_of(overall(scores)),
        "competencies": [
            {"key": c, "name": vi, "name_en": en, "score": scores[c], "level": level_of(scores[c])}
            for c, (vi, en) in COMPETENCIES.items()
        ],
        "red_flags": [flag_view(f) for f in flags],
    }


def flag_view(f: RedFlag) -> dict:
    return {
        "id": f.id, "competency": f.competency, "competency_name": COMPETENCIES[f.competency][0],
        "status": f.status.value, "opened_score": f.opened_score, "opened_at": f.opened_at,
        "ready_at": f.ready_at, "closed_at": f.closed_at, "sup_score": f.sup_score, "sup_note": f.sup_note,
    }
