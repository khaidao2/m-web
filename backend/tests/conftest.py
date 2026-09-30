import os

# Tests drop and recreate every table, so they must never share the app database.
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", "postgresql+asyncpg://pgnexus:pgnexus@localhost:55432/pgnexus_test")
assert os.environ["DATABASE_URL"].rsplit("/", 1)[-1].endswith("_test"), "TEST_DATABASE_URL must point at a *_test database"

import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from fastapi import Header  # noqa: E402

from app.core.auth import TokenClaims, verify_token  # noqa: E402
from app.db.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models.models import UserRole  # noqa: E402


async def fake_claims(x_test_user: str = Header(...)) -> TokenClaims:
    role = UserRole.SUPERVISOR if x_test_user.startswith("sup") else UserRole.PG
    return TokenClaims(sub=f"kc-{x_test_user}", username=x_test_user, full_name=x_test_user.upper(), role=role)


@pytest.fixture(autouse=True)
async def db_schema():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


@pytest.fixture
async def client():
    app.dependency_overrides[verify_token] = fake_claims
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


def as_user(name: str) -> dict:
    return {"X-Test-User": name}
