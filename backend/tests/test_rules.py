from datetime import datetime
from zoneinfo import ZoneInfo

from app.api.leaderboard import period_bounds
from app.services.content import level_of, scenarios
from app.services.mock_ai import judge

VN = ZoneInfo("Asia/Ho_Chi_Minh")


def test_levels_follow_doc_bands():
    assert level_of(None) is None
    assert [level_of(s)["level"] for s in (0, 4.9, 5.0, 6.9, 7.0, 8.4, 8.5, 10)] == [1, 1, 2, 2, 3, 3, 4, 4]


def test_judge_without_speech_is_not_assessed():
    report = judge(scenarios()["KH01"], [{"role": "ai", "text": "..."}])
    assert report["overall"] is None and set(report["scores"].values()) == {None}


def test_period_bounds():
    now = datetime(2026, 9, 30, 10, tzinfo=VN)  # Wednesday
    prev, start, end = period_bounds("week", now)
    assert (start.day, prev.day, end.day) == (28, 21, 5)
    prev, start, end = period_bounds("quarter", now)
    assert (prev.month, start.month, end.month, end.year) == (4, 7, 10, 2026)
    prev, start, end = period_bounds("month", datetime(2026, 1, 15, tzinfo=VN))
    assert (prev.year, prev.month, start.month, end.month) == (2025, 12, 1, 2)
