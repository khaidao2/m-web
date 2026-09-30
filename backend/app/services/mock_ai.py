"""Mock AI Voice Simulator: persona engine + rubric judge.

Stands in for the Claude roleplay/judge described in the project doc. Speech-to-text and
text-to-speech run in the phone browser, so this module only sees text plus the PG's
reaction latency. Everything is deterministic so SUP scores can be compared against it
when tuning the rubric (Workstream 2: "AI chấm vs SUP chấm").
"""
import re
import unicodedata
from dataclasses import dataclass, field

from app.services.content import COMPETENCIES

MAX_PG_TURNS = 8

PRONOUN = {"customer": "chị", "store_manager": "anh", "store_staff": "chị", "promotion": "chị", "full_sale": "chị"}
SELF_WORDS = ("chị", "anh", "cô", "chú", "bác")
SUBJECT = re.compile(r"^(khách|CHT|cửa hàng trưởng|nhân viên kho|nhân viên|NV|store)\s+", re.IGNORECASE)
# "Nếu/Khi PG <condition>, <subject> <outcome>" — the outcome is narration, not dialogue
NARRATION = re.compile(r",\s+((?:khách|CHT|cửa hàng trưởng|nhân viên|nhân vật|NV|người|store|quản lý)\b.*)$", re.IGNORECASE)

SIGNALS: dict[str, list[str]] = {
    "greet": [r"\bchào\b", r"xin chào"],
    "polite": [r"\bdạ\b", r"\bạ\b", r"\bvâng\b"],
    "open_q": [r"\bgì\b", r"\bnào\b", r"như thế nào", r"ra sao", r"\bsao\b", r"bao nhiêu", r"thế nào", r"ở đâu", r"khi nào"],
    "paraphrase": [r"nghĩa là", r"tức là", r"em hiểu là", r"ý (anh|chị) là", r"vậy là (anh|chị)", r"như (anh|chị) nói", r"(anh|chị) cần .* đúng không"],
    "empathy": [r"em hiểu", r"xin lỗi", r"cảm ơn", r"đúng là", r"em rất tiếc", r"(anh|chị) lo", r"em ghi nhận"],
    "usp": [r"khoai tây", r"ớt chín", r"cá cơm", r"đậm đặc", r"tiết kiệm", r"dung tích", r"khối lượng", r"\d+\s?g\b", r"100g",
            r"thành phần", r"hạn (dùng|sử dụng)", r"nhãn", r"omachi", r"chin-?su", r"nam ngư", r"kokomi", r"đệ nhị",
            r"wake-?up", r"vinacafe", r"hạt nêm", r"nước mắm", r"tương ớt", r"\bmì\b", r"vị\b", r"gói"],
    "cross_sell": [r"combo", r"\bkèm\b", r"mua thêm", r"lấy thêm", r"ăn cùng", r"dùng cùng", r"ghép", r"thêm (một|1|chai|gói)"],
    "data": [r"\d", r"%", r"doanh số", r"số liệu", r"\btồn\b", r"facing", r"\bmâm\b", r"sell-?out", r"đơn vị", r"theo dõi"],
    "proposal": [r"đề xuất", r"\bthử\b", r"em xin", r"mình thử", r"báo cáo", r"\bmốc\b", r"phương án", r"em đề nghị", r"hay là"],
    "close": [r"\bchốt\b", r"tổng (cộng|tiền|chi)", r"xác nhận", r"em lấy giúp", r"mình lấy", r"vậy (anh|chị) lấy", r"em gói"],
    "verify": [r"kiểm tra", r"xác minh", r"hỏi lại", r"báo (quản lý|sup|cửa hàng|nhân viên)", r"em check", r"xem lại"],
    "risky": [r"chắc chắn 100", r"bảo đảm hoàn tiền", r"đảm bảo hoàn tiền", r"em hứa", r"\bdở\b", r"\btệ\b", r"không tốt bằng",
              r"bên kia (dở|kém)", r"phải mua", r"mua đi", r"tốt cho sức khỏe"],
}
_COMPILED = {k: [re.compile(p, re.IGNORECASE) for p in v] for k, v in SIGNALS.items()}

STOPWORDS = {"hỏi", "nếu", "của", "về", "cho", "các", "và", "có", "khi", "là", "được", "việc", "pg", "khách", "cần",
             "với", "không", "một", "những", "trong", "đã", "đang", "sẽ", "này", "đó", "thì", "hay", "hoặc", "để"}

SYNONYMS = {
    "ngân sách": ["bao nhiêu tiền", "tầm giá", "mức chi", "chi bao nhiêu", "ngân sách"],
    "mức chi": ["bao nhiêu tiền", "tầm giá", "ngân sách", "mức chi"],
    "lý do": ["vì sao", "tại sao", "lý do", "sao vậy"],
    "ưu tiên": ["ưu tiên", "quan trọng", "cần gì", "muốn gì"],
    "thời gian": ["bao lâu", "khi nào", "mấy giờ", "thời gian"],
}

TIPS = {
    "c1": "Mở lời chủ động và thân thiện ngay khi khách dừng lại: “Dạ em chào chị, chị đang tìm gia vị cho món gì ạ?”",
    "c2": "Hỏi thêm một câu mở rồi nhắc lại ý chính: “Vậy là chị cần loại … cho … đúng không ạ?”",
    "c3": "Nối lợi ích sản phẩm với đúng nhu cầu vừa hỏi được, có số liệu cụ thể: “Gói này 80g, tính ra … trên 100g, hợp bữa trưa của chị.”",
    "c4": "Gợi ý sản phẩm bổ trợ ngay khi khách chọn xong món chính và hỏi ý khách: “Chị có cần thêm tương ớt ăn kèm không ạ?”",
    "c5": "Đồng cảm trước, giải thích sau: “Dạ em hiểu chị lo …, chị cho em hỏi thêm … để em tư vấn đúng nha.”",
    "c6": "Dùng số liệu và đề xuất thử có mốc rà soát: “Tuần rồi mình bán 120 đơn vị trên 6 mâm, anh cho em thử 7 ngày rồi mình cùng xem lại số nhé.”",
    "c7": "Giữ tác phong và phối hợp theo quy định cửa hàng; chủ động báo SUP khi có phát sinh.",
}

# {p} is the persona's self-pronoun, inferred from the scenario's opening line
NUDGES = {
    "customer": ["Ừ, rồi sao nữa em?", "Em nói cụ thể hơn giúp {p} được không?", "{P} vẫn chưa thấy khác gì hết."],
    "store_manager": ["Em nói ngắn gọn, {p} đang bận.", "Có số liệu gì không em?", "Vậy em đề xuất cụ thể sao?"],
    "store_staff": ["{P} đang bận, em cần gì nói nhanh nha.", "Rồi em tính sao?", "Việc đó ai chịu trách nhiệm em?"],
    "promotion": ["Vậy rốt cuộc {p} có được không em?", "Em giải thích rõ hơn giúp {p}.", "Sao lúc nãy {p} thấy khác?"],
    "full_sale": ["Ừ, vậy em thấy {p} nên lấy gì?", "Còn gì nữa không em?", "Em tư vấn giúp {p} với."],
}
PLEASED = {
    "store_manager": "Được, em nói rõ phương án đi.",
    "store_staff": "Ừ, vậy mình làm vậy nha em.",
}
ANNOYED = {
    "store_manager": "{P} chưa thấy thuyết phục.",
    "store_staff": "Thôi em tự lo đi, {p} còn việc.",
}


def _norm(text: str) -> str:
    return unicodedata.normalize("NFC", text).lower().strip()


def _strip_marks(text: str) -> str:
    text = unicodedata.normalize("NFD", text.replace("đ", "d").replace("Đ", "D"))
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


def signals_in(text: str) -> set[str]:
    t = _norm(text)
    found = {name for name, pats in _COMPILED.items() if any(p.search(t) for p in pats)}
    if "?" in t:
        found.add("question")
    if "open_q" in found:
        found.add("question")
    return found


def persona_pronoun(scenario: dict) -> str:
    """How the character refers to themself: the most frequent kinship word in the opening line."""
    words = re.findall(r"\w+", scenario.get("opening", "").lower())
    counts = {w: words.count(w) for w in SELF_WORDS if w in words}
    return max(counts, key=counts.get) if counts else PRONOUN.get(scenario["group"], "chị")


def _say(template: str, pronoun: str) -> str:
    return template.replace("{P}", pronoun.capitalize()).replace("{p}", pronoun)


def reaction_parts(reaction: str, mood: str, scenario: dict) -> tuple[str, str | None]:
    """Splits a scenario reaction into (spoken line, stage direction).

    Reactions read either 'Nếu PG …, khách hỏi: <line>' (a line to speak) or
    'Khi PG …, khách đồng ý …' (narration). Narration is shown as an action note and the
    persona says a short in-character line instead.
    """
    head, sep, tail = reaction.rpartition(":")
    if sep and tail.strip() and not tail.strip().lower().startswith(("nếu", "khi")):
        return tail.strip(), None
    narration = NARRATION.search(reaction)
    action = narration.group(1).strip() if narration else reaction.strip()
    # drop author notes addressed to the AI ("AI chỉ cung cấp thông tin sau …")
    action = "; ".join(part for part in re.split(r";\s*", action) if not part.strip().startswith("AI ")).rstrip(".;") + "."
    action = action[0].upper() + action[1:]
    group, pronoun = scenario["group"], persona_pronoun(scenario)
    if mood == "pleased":
        line = PLEASED.get(group, "Ừ, vậy cũng được, em nói tiếp đi.")
    else:
        line = ANNOYED.get(group, "Thôi, để {p} tự xem.")
    return _say(line, pronoun), action


def _to_speech(reveal: str, scenario: dict) -> str:
    line = SUBJECT.sub(f"{persona_pronoun(scenario)} ", reveal.strip())
    line = line[0].upper() + line[1:] if line else line
    return f"À, {line[0].lower() + line[1:]}" if line else line


def _trigger_hit(trigger: str, pg: str) -> bool:
    t = _norm(trigger)
    if not t:
        return False
    phrases = SYNONYMS.get(t, []) + [t]
    if any(p in pg for p in phrases):
        return True
    words = [w for w in re.findall(r"\w+", t) if w not in STOPWORDS and len(w) >= 3]
    pg_plain = _strip_marks(pg)
    return any(w in pg.split() or (len(w) >= 4 and _strip_marks(w) in pg_plain) for w in words)


@dataclass
class PersonaTurn:
    text: str
    action: str | None = None
    revealed: list[int] = field(default_factory=list)
    mood: str = "neutral"      # neutral | pleased | annoyed
    ended: bool = False


def persona_reply(scenario: dict, pg_turns: list[str], revealed: list[int]) -> PersonaTurn:
    """Replies to the latest PG turn; `pg_turns` holds every PG utterance so far."""
    group = scenario["group"]
    latest = _norm(pg_turns[-1])
    sig = signals_in(latest)
    so_far = set().union(*(signals_in(t) for t in pg_turns))

    if "risky" in sig:
        return _react(scenario, "poor_reaction", "annoyed")

    new = [i for i, h in enumerate(scenario["hidden"]) if i not in revealed and _trigger_hit(h["trigger"], latest)]
    if new:
        return PersonaTurn(" ".join(_to_speech(scenario["hidden"][i]["reveal"], scenario) for i in new), revealed=new)

    good_evidence = len(so_far & {"question", "empathy", "data", "proposal", "paraphrase", "verify", "usp"})
    good_given = bool(revealed) and good_evidence >= 3
    if len(pg_turns) >= MAX_PG_TURNS or (good_given and "close" in sig):
        return PersonaTurn("Ừ, vậy được. Cảm ơn em nha.", mood="pleased", ended=True)
    if good_evidence >= 3 and len(pg_turns) >= 2:
        return _react(scenario, "good_reaction", "pleased")
    if len(pg_turns) >= 2 and not sig & {"question", "empathy", "data", "usp"}:
        return _react(scenario, "poor_reaction", "annoyed")
    nudges = NUDGES.get(group, NUDGES["customer"])
    return PersonaTurn(_say(nudges[(len(pg_turns) - 1) % len(nudges)], persona_pronoun(scenario)))


def _react(scenario: dict, key: str, mood: str) -> PersonaTurn:
    line, action = reaction_parts(scenario[key], mood, scenario)
    return PersonaTurn(line, action=action, mood=mood)


def _clamp(x: float) -> float:
    return round(max(0.0, min(10.0, x)), 1)


def judge(scenario: dict, turns: list[dict]) -> dict:
    """Scores the scenario's target competencies on the 0–10 scale with quoted evidence.

    `turns` are {role: 'pg'|'ai', text, latency_ms?}. Competencies without evidence stay None
    ("Chưa đánh giá"), matching doc §IV.
    """
    pg = [t for t in turns if t["role"] == "pg" and t["text"].strip()]
    targets = [c for c in scenario["competencies"] if c in COMPETENCIES]
    if not pg:
        return {"scores": {c: None for c in targets}, "overall": None, "evidence": {}, "metrics": {}, "fix": None,
                "critical": False, "strengths": []}

    per_turn = [(t["text"], signals_in(t["text"])) for t in pg]
    count = {name: sum(1 for _, s in per_turn if name in s) for name in [*SIGNALS, "question"]}
    has = {k: v > 0 for k, v in count.items()}
    latencies = [t["latency_ms"] for t in pg if t.get("latency_ms")]
    avg_latency = sum(latencies) / len(latencies) if latencies else None
    words = sum(len(t.split()) for t, _ in per_turn)
    first = per_turn[0][1]
    usp_hits = sorted({m.group(0).lower() for t, _ in per_turn for p in _COMPILED["usp"] for m in p.finditer(t)})
    no_upsell_required = "không coi việc không bán thêm là thất bại" in scenario.get("pg_data", "").lower()

    raw = {
        "c1": 4 + 2 * has["greet"] + (1 if count["polite"] >= len(pg) / 2 else 0)
        + (2 if avg_latency is not None and avg_latency < 2000 else 1 if avg_latency is not None and avg_latency < 4000 else 0)
        + (1 if "question" in first else 0),
        "c2": 3 + 1.5 * min(count["question"], 3) + 2 * has["paraphrase"] + 0.5 * has["empathy"],
        "c3": 3 + 1.2 * min(len(usp_hits), 4) + 1 * has["data"] + 1 * has["verify"],
        "c4": (6 if no_upsell_required and not has["cross_sell"] else 3 + 3 * has["cross_sell"])
        + 1 * has["close"] + 0.5 * has["question"],
        "c5": 3 + 2 * has["empathy"] + 1.5 * has["question"] + 1.5 * (has["data"] or bool(usp_hits)) + 1 * has["verify"],
        "c6": 3 + 1.5 * has["data"] + 2 * has["proposal"] + 1 * has["question"] + 1 * (has["close"] or has["verify"]),
    }
    if has["risky"]:
        for c in ("c3", "c5", "c6"):
            raw[c] -= 2.5
    if words < 15:  # too little speech to judge confidently
        raw = {c: min(v, 4.5) for c, v in raw.items()}

    scores = {c: _clamp(raw[c]) if c in raw else None for c in targets}
    evidence_keys = {"c1": ["greet", "polite"], "c2": ["question", "paraphrase"], "c3": ["usp", "data", "verify"],
                     "c4": ["cross_sell", "close"], "c5": ["empathy", "verify"], "c6": ["data", "proposal"]}
    evidence = {
        c: [t for t, s in per_turn if s & set(evidence_keys.get(c, []))][:2] for c in targets
    }
    scored = {c: v for c, v in scores.items() if v is not None}
    weakest = min(scored, key=scored.get) if scored else None
    weak_quote = next((t for t, s in per_turn if not s & set(evidence_keys.get(weakest, []))), per_turn[0][0]) if weakest else None
    strengths = [COMPETENCIES[c][0] for c, v in sorted(scored.items(), key=lambda kv: -kv[1]) if v >= 7.0][:2]

    return {
        "scores": scores,
        "overall": round(sum(scored.values()) / len(scored), 1) if scored else None,
        "evidence": evidence,
        "metrics": {
            "avg_latency_ms": round(avg_latency) if avg_latency is not None else None,
            "questions": count["question"],
            "usp_keywords": usp_hits,
            "pg_turns": len(pg),
            "words": words,
        },
        "fix": {"competency": weakest, "quote": weak_quote, "tip": TIPS[weakest]} if weakest else None,
        "critical": has["risky"],
        "critical_error": scenario.get("critical_error") if has["risky"] else None,
        "strengths": strengths,
        "behaviors": scenario.get("behaviors", []),
    }
