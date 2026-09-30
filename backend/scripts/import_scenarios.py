"""Convert the scenario bank from the "PROJECT KÊNH MT" Google Doc into seed JSON.

Usage:
    curl -sL "https://docs.google.com/document/d/<DOC_ID>/export?format=md" -o doc.md
    python scripts/import_scenarios.py doc.md app/data/scenarios.json
"""
import json
import re
import sys

GROUPS = {
    "KH": ("customer", "Khách hàng khó tính"),
    "CHT": ("store_manager", "Cửa hàng trưởng"),
    "NV": ("store_staff", "Phối hợp tại cửa hàng"),
    "KM": ("promotion", "Khuyến mãi & SKU"),
    "BH": ("full_sale", "5 bước bán hàng"),
}

SECTION_KEYS = {
    "Bối cảnh và nhiệm vụ của PG": "context",
    "Dữ liệu được cung cấp cho PG": "pg_data",
    "Nhân vật và câu mở đầu của AI": "opening",
    "Thông tin ẩn dành cho AI": "hidden",
    "Cách AI phản ứng theo lời PG": "reactions",
    "Hành vi cần quan sát khi đánh giá": "behaviors",
}

HEADING = re.compile(r"^# \*\*((KH|CHT|NV|KM|BH)\d{2}) (.+?)\*\*\s*$")
SUBHEADING = re.compile(r"^## \*\*(.+?)\*\*\s*$")
META = re.compile(r"Độ khó (\d) trên 3\s*\|\s*Năng lực ([C\d, ]+)")


def clean(text: str) -> str:
    text = re.sub(r"\\([-=+>.])", r"\1", text)
    text = text.replace("**", "").replace("*", "")
    return re.sub(r"\s+", " ", text).strip()


def bullets(lines: list[str]) -> list[str]:
    items = [clean(re.sub(r"^\*\*•\*\*\s*", "", ln)) for ln in lines if ln.strip().startswith("**•**")]
    return [i for i in items if i]


def parse_hidden(item: str) -> dict:
    # "Nếu hỏi ngân sách: tối đa 30.000đ ..." -> trigger + reveal
    m = re.match(r"Nếu (?:PG )?(?:hỏi|đề cập|nhắc)?\s*(.+?):\s*(.+)", item)
    if not m:
        return {"trigger": "", "reveal": item}
    return {"trigger": m.group(1).strip(), "reveal": m.group(2).strip()}


def parse(md: str) -> list[dict]:
    scenarios: list[dict] = []
    current: dict | None = None
    section: str | None = None
    buf: dict[str, list[str]] = {}

    def flush():
        if not current:
            return
        body = {k: [ln for ln in v if ln.strip()] for k, v in buf.items()}
        reactions = " ".join(body.get("reactions", []))
        good = re.search(r"Khi PG xử lý phù hợp:\*\*\s*(.+?)(?=\*\*Khi PG xử lý chưa|$)", reactions)
        poor = re.search(r"Khi PG xử lý chưa phù hợp:\*\*\s*(.+)$", reactions)
        behaviors_raw = body.get("behaviors", [])
        critical = next((clean(ln.split(":**", 1)[1]) for ln in behaviors_raw if "Lỗi trọng yếu" in ln), "")
        context_lines = [clean(ln) for ln in body.get("context", []) if not ln.startswith("PG cần xử lý tình huống")]
        current.update(
            context=" ".join(context_lines),
            pg_data=clean(" ".join(body.get("pg_data", []))),
            opening=clean(" ".join(body.get("opening", []))).strip("“”\""),
            hidden=[parse_hidden(i) for i in bullets(body.get("hidden", []))],
            good_reaction=clean(good.group(1)) if good else "",
            poor_reaction=clean(poor.group(1)) if poor else "",
            behaviors=bullets(behaviors_raw),
            critical_error=critical,
        )
        scenarios.append(current)

    for line in md.splitlines():
        h = HEADING.match(line)
        if h:
            flush()
            code, prefix, title = h.group(1), h.group(2), clean(h.group(3))
            group, group_label = GROUPS[prefix]
            current = {"code": code, "title": title, "group": group, "group_label": group_label}
            section, buf = None, {}
            continue
        if current is None:
            continue
        meta = META.search(line)
        if meta and "difficulty" not in current:
            current["difficulty"] = int(meta.group(1))
            current["competencies"] = [c.strip().lower() for c in meta.group(2).split(",") if c.strip()]
            continue
        s = SUBHEADING.match(line)
        if s:
            section = SECTION_KEYS.get(clean(s.group(1)))
            continue
        if line.startswith("# "):  # any other top-level heading ends the scenario
            flush()
            current, section, buf = None, None, {}
            continue
        if section:
            buf.setdefault(section, []).append(line)
    flush()
    return scenarios


if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    with open(src, encoding="utf-8") as f:
        result = parse(f.read())
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=1)
    print(f"{len(result)} scenarios -> {dst}")
