"""D-day bill intelligence: OCR, receipt parsing, MCH matching and eligibility checks.

Doc §V (scan bill architecture): PG photographs the bill, the system reads it, the PG only
confirms or corrects (every edit is logged), records are append-only (void with a reason,
never delete), and each bill gets Hợp lệ / Cần xem xét / Loại before it counts toward KPIs.
"""
import io
import json
import re
import unicodedata
from datetime import datetime
from functools import lru_cache
from zoneinfo import ZoneInfo

from app.services.content import DATA

VN = ZoneInfo("Asia/Ho_Chi_Minh")
TOTAL_TOLERANCE = 0.02   # lines vs printed total, relative
TOTAL_SLACK_VND = 1000   # absolute slack for rounding

# flag → (status it forces, Vietnamese reason shown to PG/SUP)
FLAGS = {
    "duplicate_image": ("rejected", "Ảnh bill này đã được nộp"),
    "duplicate_bill_no": ("rejected", "Số bill đã được nộp ở cửa hàng này"),
    "no_mch": ("rejected", "Bill không có sản phẩm Masan"),
    "missing_bill_no": ("review", "Thiếu số bill"),
    "missing_date": ("review", "Thiếu ngày giờ trên bill"),
    "outside_program_day": ("review", "Ngày trên bill khác ngày chương trình"),
    "store_mismatch": ("review", "Cửa hàng trên bill khác cửa hàng chương trình"),
    "total_mismatch": ("review", "Tổng các dòng không khớp tổng tiền bill"),
}


def plain(text: str) -> str:
    """Lowercase, no diacritics, single spaces — for matching OCR text."""
    text = unicodedata.normalize("NFD", text.replace("đ", "d").replace("Đ", "D"))
    text = "".join(c for c in text if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


@lru_cache
def catalog() -> list[dict]:
    brands = json.loads((DATA / "sku_catalog.json").read_text(encoding="utf-8"))["brands"]
    return [{**b, "keys": [plain(k) for k in b["keywords"]]} for b in brands]


def match_mch(name: str) -> dict | None:
    p = f" {plain(name)} "
    return next((b for b in catalog() if any(f" {k} " in p for k in b["keys"])), None)


# ── OCR ────────────────────────────────────────────────────────────────────

def ocr(image: bytes) -> str:
    """Vietnamese OCR with Tesseract; returns '' when OCR is unavailable so the PG can type lines."""
    try:
        import pytesseract
        from PIL import Image, ImageOps
    except ImportError:
        return ""
    img = ImageOps.exif_transpose(Image.open(io.BytesIO(image))).convert("L")
    if img.width < 1400:  # receipts are small print; upscale before thresholding
        img = img.resize((1400, round(img.height * 1400 / img.width)))
    img = ImageOps.autocontrast(img, cutoff=1)
    try:
        return pytesseract.image_to_string(img, lang="vie", config="--psm 6")
    except pytesseract.TesseractNotFoundError:
        return ""


# ── Parsing ────────────────────────────────────────────────────────────────

NUM = r"\d{1,3}(?:[.,] ?\d{3})+|\d+"   # OCR sometimes inserts a space after the thousands dot
TAIL = re.compile(rf"^(?P<name>.*?[A-Za-zÀ-ỹ].*?)\s+(?P<nums>(?:(?:{NUM})\s*(?:x|X|\*)?\s*){{1,3}})(?:đ|d|vnd)?\s*$")
NON_ITEM = re.compile(r"\b(tong|thanh toan|tien mat|tien thua|khach dua|chiet khau|giam gia|vat|thue|so luong|don gia|thanh tien|ma hd|so hd|hotline|ngay)\b")


def to_int(s: str) -> int:
    return int(re.sub(r"[., ]", "", s))


def parse(text: str) -> dict:
    """Best-effort fields from a BHX receipt; the PG reviews everything before confirming."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    flat = "\n".join(lines)
    out: dict = {"bill_no": None, "store_name": None, "purchased_at": None, "total_vnd": None, "lines": []}

    m = re.search(r"(?:s[oố]\s*(?:h[đd]|hóa đơn|hoa don|ct|bill)|m[aã]\s*(?:h[đd]|bill)|h[đd])\s*[:#.]?\s*([A-Z0-9][A-Z0-9-]{3,})", flat, re.I)
    if m:
        out["bill_no"] = m.group(1).upper()
    m = re.search(r"(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\D{1,3}(\d{1,2})[:h](\d{2}))?", flat)
    if m:
        d, mo, y, hh, mm = m.groups()
        y = int(y) + (2000 if len(y) == 2 else 0)
        try:
            out["purchased_at"] = datetime(y, int(mo), int(d), int(hh or 0), int(mm or 0), tzinfo=VN)
        except ValueError:
            pass
    for i, ln in enumerate(lines):
        if "bach hoa xanh" in plain(ln) or re.search(r"\bBHX\b", ln):
            nxt = lines[i + 1] if i + 1 < len(lines) and not re.search(NUM + r"\s*$", lines[i + 1]) else ""
            out["store_name"] = (ln + (" - " + nxt if nxt else "")).strip()[:200]
            break
    for ln in lines:
        if re.search(r"\b(tong cong|tong tien|thanh toan|tong)\b", plain(ln)):
            nums = re.findall(NUM, ln)
            if nums:
                out["total_vnd"] = to_int(nums[-1])
    for ln in lines:
        if NON_ITEM.search(plain(ln)):
            continue
        m = TAIL.match(ln)
        if not m:
            continue
        nums = [to_int(n) for n in re.findall(NUM, m.group("nums"))]
        qty, price, amount = 1, None, nums[-1]
        if len(nums) == 3:
            qty, price = nums[0], nums[1]
        elif len(nums) == 2:
            qty, price = (nums[0], amount // nums[0]) if nums[0] <= 50 and nums[0] else (1, nums[0])
        if amount < 500 or qty > 500:  # stray numbers (sizes, codes), not money
            continue
        out["lines"].append(make_line(m.group("name").strip(" .:-"), qty, price or amount // max(qty, 1), amount))
    return out


def make_line(name: str, qty: int, unit_price: int, amount: int) -> dict:
    mch = match_mch(name)
    return {
        "name": name[:120], "qty": qty, "unit_price": unit_price, "amount": amount,
        "mch": mch is not None, "brand": mch["brand"] if mch else None,
        "category": mch["category"] if mch else None, "slug": mch["slug"] if mch else None,
    }


# ── Eligibility ────────────────────────────────────────────────────────────

def evaluate(bill: dict, program: dict, duplicates: set[str]) -> tuple[str, list[str]]:
    """Status + flags for a confirmed bill. `duplicates` holds 'duplicate_image' / 'duplicate_bill_no'."""
    flags = sorted(duplicates)
    if not any(ln["mch"] for ln in bill["lines"]):
        flags.append("no_mch")
    if not bill["bill_no"]:
        flags.append("missing_bill_no")
    if bill["purchased_at"] is None:
        flags.append("missing_date")
    elif bill["purchased_at"].astimezone(VN).date() != program["day"]:
        flags.append("outside_program_day")
    store_words = set(plain(program["store_name"]).split()) - {"bhx", "bach", "hoa", "xanh"}
    if store_words and not store_words & set(plain(bill["store_name"] or "").split()):
        flags.append("store_mismatch")
    total, summed = bill["total_vnd"], sum(ln["amount"] for ln in bill["lines"])
    if total and abs(summed - total) > max(TOTAL_SLACK_VND, total * TOTAL_TOLERANCE):
        flags.append("total_mismatch")
    statuses = {FLAGS[f][0] for f in flags}
    return ("rejected" if "rejected" in statuses else "review" if "review" in statuses else "valid"), flags


def results(bills: list[dict], hours: float, shifts: int) -> dict:
    """D-day KPIs over VALID bills (doc §V KPIs 3.1–3.5)."""
    mch_lines = [ln for b in bills for ln in b["lines"] if ln["mch"]]
    value = sum(ln["amount"] for ln in mch_lines)
    n = len(bills)
    multi = sum(1 for b in bills if len({ln["category"] for ln in b["lines"] if ln["mch"]}) >= 2)
    units = sum(ln["qty"] for ln in mch_lines)
    per_sku: dict[tuple, dict] = {}
    for ln in mch_lines:
        key = (ln["brand"], plain(ln["name"]))
        row = per_sku.setdefault(key, {"brand": ln["brand"], "category": ln["category"], "slug": ln["slug"],
                                       "name": ln["name"], "qty": 0, "amount": 0})
        row["qty"] += ln["qty"]
        row["amount"] += ln["amount"]
    return {
        "mch_value_vnd": value,
        "bills": n,
        "shifts": shifts,
        "hours": round(hours, 1),
        "value_per_hour": round(value / hours) if hours else None,
        "multi_category_rate": round(100 * multi / n) if n else None,
        "value_per_bill": round(value / n) if n else None,
        "units_per_bill": round(units / n, 2) if n else None,
        "skus": sorted(per_sku.values(), key=lambda r: -r["amount"]),
    }
