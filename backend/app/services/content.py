"""Static training content shipped with the app: competencies, levels, scenarios, quiz bank."""
import json
from functools import lru_cache
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"

COMPETENCIES = {
    "c1": ("Tiếp cận & Thiết lập kết nối", "Approach & Rapport Building"),
    "c2": ("Thấu hiểu & Khơi gợi nhu cầu", "Needs Discovery & Engagement"),
    "c3": ("Tư vấn giải pháp sản phẩm", "Product Storytelling & Solution Fit"),
    "c4": ("Gia tăng giá trị giỏ hàng", "Basket Value Expansion"),
    "c5": ("Xử lý phản bác & Củng cố niềm tin", "Objection Handling & Confidence"),
    "c6": ("Đàm phán & Thuyết phục", "Negotiation & Persuasion"),
    "c7": ("Thái độ & Kỷ luật", "Attitude & Discipline"),
}

RED_FLAG_BELOW = 5.0     # doc §IV: Red Flag khi điểm dưới 5,0
CLOSE_AT = 7.0           # doc §IV: đạt từ 7,0 + SUP xác nhận để đóng Red Flag

LEVELS = [
    (8.5, 4, "Giỏi - Xuất sắc"),
    (7.0, 3, "Khá - Thành thạo"),
    (5.0, 2, "Trung bình - Đạt yêu cầu"),
    (0.0, 1, "Cần cải thiện"),
]


def level_of(score: float | None) -> dict | None:
    if score is None:
        return None
    for floor, level, name in LEVELS:
        if score >= floor:
            return {"level": level, "name": name}
    return {"level": 1, "name": LEVELS[-1][2]}


@lru_cache
def scenarios() -> dict[str, dict]:
    items = json.loads((DATA / "scenarios.json").read_text(encoding="utf-8"))
    return {s["code"]: s for s in items}


@lru_cache
def quiz_bank() -> dict:
    return json.loads((DATA / "quiz_bank.json").read_text(encoding="utf-8"))


def scenario_public(s: dict) -> dict:
    """What the PG may see before the roleplay; hidden info and AI reactions stay server-side."""
    return {k: s[k] for k in ("code", "title", "group", "group_label", "difficulty", "competencies", "context", "pg_data", "opening")}
