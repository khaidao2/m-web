"""Seeds demo PG profiles so the leaderboard has a roster during the pilot demo.

Demo profiles cannot log in (no Keycloak subject), are tagged is_demo, and are excluded
from SUP KPIs and Red Flag queues. Idempotent: does nothing if demo profiles exist.
Run: python -m scripts.seed
"""
import asyncio
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.db.database import SessionLocal
from app.models.models import Assessment, AssessmentSource, PointsEntry, User, UserRole

DEMO_PGS = [
    ("Nguyễn Thị Thu Hà", "BHX Q7 - Huỳnh Tấn Phát"), ("Trần Minh Thư", "BHX Gò Vấp - Quang Trung"),
    ("Lê Ngọc Ánh", "BHX Bình Thạnh - Nơ Trang Long"), ("Phạm Thị Hồng Nhung", "BHX Thủ Đức - Võ Văn Ngân"),
    ("Võ Thị Kim Ngân", "BHX Tân Bình - Cộng Hòa"), ("Đặng Thanh Trúc", "BHX Q12 - Tô Ký"),
    ("Huỳnh Mỹ Linh", "BHX Bình Tân - Tên Lửa"), ("Bùi Thị Diễm My", "BHX Q8 - Phạm Thế Hiển"),
    ("Ngô Phương Thảo", "BHX Nhà Bè - Nguyễn Hữu Thọ"), ("Dương Thị Yến", "BHX Hóc Môn - Lê Thị Hà"),
    ("Mai Thanh Tâm", "BHX Q6 - Hậu Giang"), ("Lý Kim Phụng", "BHX Tân Phú - Lũy Bán Bích"),
]


async def main() -> None:
    rng = random.Random(2026)
    async with SessionLocal() as db:
        if await db.scalar(select(User.id).where(User.is_demo.is_(True)).limit(1)):
            print("demo data already present")
            return
        now = datetime.now(timezone.utc)
        for name, store in DEMO_PGS:
            user = User(username=f"demo-{rng.randrange(10**6):06d}", full_name=name, store_name=store,
                        role=UserRole.PG, is_demo=True)
            db.add(user)
            await db.flush()
            skill = rng.uniform(4.0, 9.0)
            for day in range(0, 70, 2):
                at = now - timedelta(days=day, hours=rng.randrange(8))
                db.add(PointsEntry(user_id=user.id, points=rng.randrange(30, 110), reason="voice", created_at=at))
            for comp in ("c1", "c2", "c3", "c4", "c5", "c6"):
                db.add(Assessment(user_id=user.id, competency=comp, source=AssessmentSource.VOICE,
                                  score=round(max(0, min(10, rng.gauss(skill, 1.2))), 1)))
        await db.commit()
        print(f"seeded {len(DEMO_PGS)} demo PGs")


if __name__ == "__main__":
    asyncio.run(main())
