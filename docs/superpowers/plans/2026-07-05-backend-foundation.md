# Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the FastAPI + PostgreSQL backend for Ceylon Bellezza: all data models, both auth flows (salon-admin and platform/super-admin), and the core CRUD APIs (salon management, services, staff, gallery, content blocks) with enforced tenant isolation. No frontend in this plan — verified entirely via pytest.

**Architecture:** One FastAPI app, one PostgreSQL database. Every salon-owned table carries a `salon_id` foreign key. Two JWT auth flows distinguished by a `role` claim (`platform_admin` has no `salon_id` restriction; `salon_admin` carries a `salon_id` claim that every dependent query is filtered by). SQLAlchemy 2.0 declarative models, Alembic migrations, Pydantic v2 schemas for request/response validation.

**Tech Stack:** Python 3.11+, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2 / pydantic-settings, PostgreSQL, python-jose (JWT), passlib[bcrypt] (password hashing), pytest + httpx (testing), googlemaps (geocoding client).

## Global Constraints

- Database: PostgreSQL only (no SQLite substitution, including in tests — use a real Postgres test database so behavior matches production).
- All salon-owned resource queries MUST filter by `salon_id` derived from the authenticated JWT (salon-admin routes) or URL path (none in this plan — public routes are Plan 4). Never trust a client-supplied `salon_id`.
- Passwords: bcrypt via passlib, never stored or logged in plaintext.
- JWTs: short-lived access tokens (30 min) signed with `HS256`, secret from environment config, never hardcoded.
- Money values (`services.price`) stored as `Numeric(10, 2)`, never `Float`.
- All timestamps stored in UTC.

---

## File Structure

```
backend/
  requirements.txt
  alembic.ini
  .env.example
  app/
    __init__.py
    main.py                 # FastAPI app instance, router registration
    config.py                # Settings (env vars)
    database.py               # Engine, SessionLocal, Base, get_db dependency
    models/
      __init__.py
      salon.py                # Salon model
      admin.py                 # SalonAdmin, PlatformAdmin models
      service.py                # Service model
      staff.py                  # Staff model, StaffService join table
      gallery.py                 # GalleryItem model
      booking.py                  # Booking model (columns only, no endpoints yet — Plan 4 adds routes)
      content.py                   # ContentBlock model
    schemas/
      salon.py                # Pydantic schemas for salon create/read/update
      admin.py                 # Login request/response schemas
      service.py
      staff.py
      gallery.py
      content.py
    auth/
      security.py              # hash_password, verify_password, create_access_token, decode_access_token
      dependencies.py           # get_current_platform_admin, get_current_salon_admin
      geocoding.py                # geocode_address()
    routers/
      auth.py                  # POST /auth/platform-admin/login, POST /auth/salon-admin/login
      salons.py                 # Super-admin salon management endpoints
      services.py                # Salon-admin services CRUD
      staff.py                   # Salon-admin staff CRUD
      gallery.py                  # Salon-admin gallery CRUD
      content.py                   # Salon-admin content block CRUD
  alembic/
    env.py
    versions/                  # generated migration(s)
  tests/
    conftest.py                 # DB fixtures, test client, factory helpers
    test_auth.py
    test_salons.py
    test_services.py
    test_staff.py
    test_gallery.py
    test_content.py
    test_tenant_isolation.py     # cross-cutting: salon A token can never touch salon B data
```

---

### Task 1: Project scaffolding & config

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/.env.example`
- Create: `backend/app/__init__.py`
- Create: `backend/app/config.py`
- Create: `backend/app/database.py`
- Create: `backend/app/main.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Test: `backend/tests/test_health.py`

**Interfaces:**
- Produces: `app.config.settings` (a `Settings` instance with `.database_url`, `.jwt_secret_key`, `.jwt_algorithm`, `.access_token_expire_minutes`, `.google_maps_api_key`). `app.database.Base` (declarative base), `app.database.get_db` (FastAPI dependency yielding a `Session`), `app.database.engine`. `app.main.app` (the FastAPI instance).

- [ ] **Step 1: Write `requirements.txt`**

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
sqlalchemy==2.0.35
alembic==1.13.2
psycopg2-binary==2.9.9
pydantic==2.9.2
pydantic-settings==2.5.2
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
googlemaps==4.10.0
pytest==8.3.3
httpx==0.27.2
```

- [ ] **Step 2: Write `.env.example`**

```
DATABASE_URL=postgresql://ceylon:ceylon@localhost:5432/ceylon_bellezza
TEST_DATABASE_URL=postgresql://ceylon:ceylon@localhost:5432/ceylon_bellezza_test
JWT_SECRET_KEY=change-me-to-a-random-secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

- [ ] **Step 3: Write `backend/app/config.py`**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    test_database_url: str = ""
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    google_maps_api_key: str = ""

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
```

- [ ] **Step 4: Write `backend/app/database.py`**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 5: Write `backend/app/main.py`**

```python
from fastapi import FastAPI

app = FastAPI(title="Ceylon Bellezza API")


@app.get("/health")
def health_check():
    return {"status": "ok"}
```

- [ ] **Step 6: Write `backend/tests/conftest.py`**

```python
import os

os.environ.setdefault("DATABASE_URL", "postgresql://ceylon:ceylon@localhost:5432/ceylon_bellezza")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.database import Base, get_db
from app.main import app

test_engine = create_engine(settings.test_database_url or settings.database_url)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture()
def db_session():
    Base.metadata.create_all(bind=test_engine)
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture()
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
```

- [ ] **Step 7: Write the failing test `backend/tests/test_health.py`**

```python
def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 8: Set up a local Postgres test database and run the test**

```bash
createdb ceylon_bellezza_test
cd backend && cp .env.example .env
pip install -r requirements.txt
pytest tests/test_health.py -v
```

Expected: PASS (health check requires no models yet).

- [ ] **Step 9: Commit**

```bash
git add backend/requirements.txt backend/.env.example backend/app backend/tests
git commit -m "chore: scaffold FastAPI project with config, db session, health check"
```

---

### Task 2: SQLAlchemy models for all tables

**Files:**
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/salon.py`
- Create: `backend/app/models/admin.py`
- Create: `backend/app/models/service.py`
- Create: `backend/app/models/staff.py`
- Create: `backend/app/models/gallery.py`
- Create: `backend/app/models/booking.py`
- Create: `backend/app/models/content.py`
- Test: `backend/tests/test_models.py`

**Interfaces:**
- Consumes: `app.database.Base`, `app.database.get_db` (Task 1).
- Produces: `Salon`, `SalonAdmin`, `PlatformAdmin`, `Service`, `Staff`, `StaffService`, `StaffAvailability`, `GalleryItem`, `Booking`, `ContentBlock` — all importable from `app.models`. Every salon-owned model has a `salon_id: Mapped[uuid.UUID]` column (`ForeignKey("salons.id")`).

- [ ] **Step 1: Write `backend/app/models/salon.py`**

```python
import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Salon(Base):
    __tablename__ = "salons"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(20))  # "mens" | "womens" | "unisex"
    address: Mapped[str] = mapped_column(String(300))
    city: Mapped[str] = mapped_column(String(100))
    latitude: Mapped[float | None] = mapped_column(nullable=True)
    longitude: Mapped[float | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")  # "active" | "suspended"
    enabled_modules: Mapped[dict] = mapped_column(JSON, default=lambda: {"gallery": True, "booking": True, "contact_form": True})
    template_settings: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
```

- [ ] **Step 2: Write `backend/app/models/admin.py`**

```python
import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PlatformAdmin(Base):
    __tablename__ = "platform_admins"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))


class SalonAdmin(Base):
    __tablename__ = "salon_admins"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    salon_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("salons.id"))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
```

- [ ] **Step 3: Write `backend/app/models/service.py`**

```python
import uuid

from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Service(Base):
    __tablename__ = "services"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    salon_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("salons.id"), index=True)
    name: Mapped[str] = mapped_column(String(150))
    description: Mapped[str] = mapped_column(String(1000), default="")
    category: Mapped[str] = mapped_column(String(100))
    price: Mapped[float] = mapped_column(Numeric(10, 2))
    duration_minutes: Mapped[int]
```

- [ ] **Step 4: Write `backend/app/models/staff.py`**

```python
import uuid

from sqlalchemy import ForeignKey, String, Table, Column
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

staff_services = Table(
    "staff_services",
    Base.metadata,
    Column("staff_id", UUID(as_uuid=True), ForeignKey("staff.id"), primary_key=True),
    Column("service_id", UUID(as_uuid=True), ForeignKey("services.id"), primary_key=True),
)


class Staff(Base):
    __tablename__ = "staff"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    salon_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("salons.id"), index=True)
    name: Mapped[str] = mapped_column(String(150))
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    bio: Mapped[str] = mapped_column(String(1000), default="")


class StaffAvailability(Base):
    __tablename__ = "staff_availability"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    staff_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("staff.id"), index=True)
    day_of_week: Mapped[int]  # 0=Monday .. 6=Sunday
    start_time: Mapped[str] = mapped_column(String(5))  # "09:00"
    end_time: Mapped[str] = mapped_column(String(5))  # "17:00"
```

- [ ] **Step 5: Write `backend/app/models/gallery.py`**

```python
import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class GalleryItem(Base):
    __tablename__ = "gallery_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    salon_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("salons.id"), index=True)
    image_url: Mapped[str] = mapped_column(String(500))
    caption: Mapped[str] = mapped_column(String(300), default="")
```

- [ ] **Step 6: Write `backend/app/models/content.py`**

```python
import uuid

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ContentBlock(Base):
    __tablename__ = "content_blocks"
    __table_args__ = (UniqueConstraint("salon_id", "key", name="uq_content_block_salon_key"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    salon_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("salons.id"), index=True)
    key: Mapped[str] = mapped_column(String(50))  # "about_us" | "contact_info"
    value: Mapped[str] = mapped_column(String(5000), default="")
```

- [ ] **Step 7: Write `backend/app/models/booking.py`**

```python
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (UniqueConstraint("staff_id", "scheduled_at", name="uq_booking_staff_slot"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    salon_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("salons.id"), index=True)
    service_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("services.id"))
    staff_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("staff.id"), nullable=True)
    customer_name: Mapped[str] = mapped_column(String(150))
    customer_phone: Mapped[str] = mapped_column(String(30))
    customer_email: Mapped[str] = mapped_column(String(255))
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), default="pending")
```

- [ ] **Step 8: Write `backend/app/models/__init__.py`**

```python
from app.models.admin import PlatformAdmin, SalonAdmin
from app.models.booking import Booking
from app.models.content import ContentBlock
from app.models.gallery import GalleryItem
from app.models.salon import Salon
from app.models.service import Service
from app.models.staff import Staff, StaffAvailability, staff_services

__all__ = [
    "Salon",
    "SalonAdmin",
    "PlatformAdmin",
    "Service",
    "Staff",
    "StaffAvailability",
    "staff_services",
    "GalleryItem",
    "Booking",
    "ContentBlock",
]
```

- [ ] **Step 9: Write the failing test `backend/tests/test_models.py`**

```python
import uuid

from app.models import Salon, Service


def test_create_salon_and_service(db_session):
    salon = Salon(
        slug="glamour-lk",
        name="Glamour Salon",
        category="unisex",
        address="123 Galle Rd",
        city="Colombo",
    )
    db_session.add(salon)
    db_session.commit()

    service = Service(
        salon_id=salon.id,
        name="Haircut",
        category="hair",
        price=1500.00,
        duration_minutes=30,
    )
    db_session.add(service)
    db_session.commit()

    assert isinstance(salon.id, uuid.UUID)
    assert service.salon_id == salon.id
    assert salon.enabled_modules == {"gallery": True, "booking": True, "contact_form": True}
```

- [ ] **Step 10: Run test to verify it fails**

```bash
cd backend && pytest tests/test_models.py -v
```

Expected: FAIL (models package doesn't fully resolve / tables not created — confirms test exercises the new code).

- [ ] **Step 11: Run test to verify it passes**

```bash
cd backend && pytest tests/test_models.py -v
```

Expected: PASS (fixture's `Base.metadata.create_all` picks up all imported models via `app.models.__init__`).

- [ ] **Step 12: Commit**

```bash
git add backend/app/models backend/tests/test_models.py
git commit -m "feat: add SQLAlchemy models for all core tables"
```

---

### Task 3: Alembic migration

**Files:**
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/script.py.mako`
- Create: `backend/alembic/versions/0001_initial_schema.py` (generated, then reviewed)

**Interfaces:**
- Consumes: `app.database.Base`, `app.models` (Task 2) — Alembic's `target_metadata` must import `app.models` so all tables are registered on `Base.metadata`.
- Produces: a runnable `alembic upgrade head` that creates every table in Task 2 against a real PostgreSQL database.

- [ ] **Step 1: Initialize Alembic**

```bash
cd backend && alembic init alembic
```

- [ ] **Step 2: Edit `backend/alembic/env.py` to point at our models and settings**

Replace the `target_metadata = None` line and the sqlalchemy.url wiring with:

```python
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.config import settings
from app.database import Base
from app import models  # noqa: F401  -- ensures all models are registered on Base.metadata

config.set_main_option("sqlalchemy.url", settings.database_url)
target_metadata = Base.metadata
```

(Insert this after the existing `config = context.config` line, keeping the rest of the generated `env.py` structure intact.)

- [ ] **Step 3: Generate the initial migration**

```bash
cd backend && alembic revision --autogenerate -m "initial schema"
```

Expected: a new file in `backend/alembic/versions/` containing `op.create_table(...)` calls for `salons`, `platform_admins`, `salon_admins`, `services`, `staff`, `staff_services`, `staff_availability`, `gallery_items`, `bookings`, `content_blocks`.

- [ ] **Step 4: Review the generated migration file**

Open the generated file and confirm every table from Task 2 appears with the expected columns and the two `UniqueConstraint`s (`content_blocks.salon_id+key`, `bookings.staff_id+scheduled_at`). Fix manually if autogenerate missed a constraint.

- [ ] **Step 5: Apply the migration to both databases and verify**

```bash
cd backend && alembic upgrade head
psql $DATABASE_URL -c '\dt'
```

Expected: all 10 tables listed.

- [ ] **Step 6: Commit**

```bash
git add backend/alembic.ini backend/alembic
git commit -m "feat: add initial Alembic migration for core schema"
```

---

### Task 4: Password hashing & JWT utilities

**Files:**
- Create: `backend/app/auth/__init__.py`
- Create: `backend/app/auth/security.py`
- Test: `backend/tests/test_security.py`

**Interfaces:**
- Consumes: `app.config.settings` (Task 1).
- Produces: `hash_password(password: str) -> str`, `verify_password(password: str, password_hash: str) -> bool`, `create_access_token(data: dict) -> str`, `decode_access_token(token: str) -> dict` (raises `jose.JWTError` on invalid/expired token).

- [ ] **Step 1: Write the failing test `backend/tests/test_security.py`**

```python
import pytest
from jose import JWTError

from app.auth.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_hash_and_verify_password():
    hashed = hash_password("correct-horse")
    assert hashed != "correct-horse"
    assert verify_password("correct-horse", hashed) is True
    assert verify_password("wrong-password", hashed) is False


def test_create_and_decode_token():
    token = create_access_token({"sub": "abc-123", "role": "salon_admin", "salon_id": "salon-1"})
    payload = decode_access_token(token)
    assert payload["sub"] == "abc-123"
    assert payload["role"] == "salon_admin"
    assert payload["salon_id"] == "salon-1"


def test_decode_invalid_token_raises():
    with pytest.raises(JWTError):
        decode_access_token("not-a-real-token")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/test_security.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.auth'`.

- [ ] **Step 3: Write `backend/app/auth/__init__.py`** (empty file)

- [ ] **Step 4: Write `backend/app/auth/security.py`**

```python
from datetime import datetime, timedelta, timezone

from jose import jwt
from passlib.context import CryptContext

from app.config import settings

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _pwd_context.verify(password, password_hash)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend && pytest tests/test_security.py -v
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/auth/__init__.py backend/app/auth/security.py backend/tests/test_security.py
git commit -m "feat: add password hashing and JWT utilities"
```

---

### Task 5: Auth dependencies (current platform admin / current salon admin)

**Files:**
- Create: `backend/app/auth/dependencies.py`
- Test: `backend/tests/test_dependencies.py`

**Interfaces:**
- Consumes: `create_access_token`, `decode_access_token` (Task 4).
- Produces: `get_current_platform_admin(token: str = Depends(oauth2_scheme)) -> dict` (returns `{"id": str}`, raises `HTTPException(401)` if role isn't `platform_admin`), `get_current_salon_admin(token: str = Depends(oauth2_scheme)) -> dict` (returns `{"id": str, "salon_id": str}`, raises `HTTPException(401)` if role isn't `salon_admin`). Later tasks depend on these exact function names and return shapes.

- [ ] **Step 1: Write the failing test `backend/tests/test_dependencies.py`**

```python
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_platform_admin, get_current_salon_admin
from app.auth.security import create_access_token

test_app = FastAPI()


@test_app.get("/platform-only")
def platform_only(admin=Depends(get_current_platform_admin)):
    return {"id": admin["id"]}


@test_app.get("/salon-only")
def salon_only(admin=Depends(get_current_salon_admin)):
    return {"id": admin["id"], "salon_id": admin["salon_id"]}


client = TestClient(test_app)


def test_platform_admin_dependency_accepts_platform_token():
    token = create_access_token({"sub": "admin-1", "role": "platform_admin"})
    response = client.get("/platform-only", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json() == {"id": "admin-1"}


def test_platform_admin_dependency_rejects_salon_token():
    token = create_access_token({"sub": "admin-1", "role": "salon_admin", "salon_id": "salon-1"})
    response = client.get("/platform-only", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_salon_admin_dependency_accepts_salon_token():
    token = create_access_token({"sub": "admin-2", "role": "salon_admin", "salon_id": "salon-9"})
    response = client.get("/salon-only", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json() == {"id": "admin-2", "salon_id": "salon-9"}


def test_missing_token_rejected():
    response = client.get("/salon-only")
    assert response.status_code == 401
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/test_dependencies.py -v
```

Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Write `backend/app/auth/dependencies.py`**

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError

from app.auth.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/salon-admin/login", auto_error=False)


def _decode_or_401(token: str | None) -> dict:
    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        return decode_access_token(token)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


def get_current_platform_admin(token: str | None = Depends(oauth2_scheme)) -> dict:
    payload = _decode_or_401(token)
    if payload.get("role") != "platform_admin":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Platform admin access required")
    return {"id": payload["sub"]}


def get_current_salon_admin(token: str | None = Depends(oauth2_scheme)) -> dict:
    payload = _decode_or_401(token)
    if payload.get("role") != "salon_admin":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Salon admin access required")
    return {"id": payload["sub"], "salon_id": payload["salon_id"]}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && pytest tests/test_dependencies.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/auth/dependencies.py backend/tests/test_dependencies.py
git commit -m "feat: add role-scoped auth dependencies for platform and salon admins"
```

---

### Task 6: Login endpoints + seed helper

**Files:**
- Create: `backend/app/routers/__init__.py`
- Create: `backend/app/routers/auth.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_auth.py`

**Interfaces:**
- Consumes: `Salon`, `SalonAdmin`, `PlatformAdmin` models (Task 2); `hash_password`, `verify_password`, `create_access_token` (Task 4); `get_db` (Task 1).
- Produces: `POST /auth/platform-admin/login` (body: `{"email", "password"}`, returns `{"access_token", "token_type": "bearer"}`), `POST /auth/salon-admin/login` (same shape). Both return 401 on bad credentials.

- [ ] **Step 1: Write the failing test `backend/tests/test_auth.py`**

```python
from app.auth.security import hash_password
from app.models import PlatformAdmin, Salon, SalonAdmin


def _make_salon(db_session):
    salon = Salon(slug="glamour-lk", name="Glamour Salon", category="unisex", address="123 Galle Rd", city="Colombo")
    db_session.add(salon)
    db_session.commit()
    return salon


def test_salon_admin_login_success(client, db_session):
    salon = _make_salon(db_session)
    admin = SalonAdmin(salon_id=salon.id, email="owner@glamour.lk", password_hash=hash_password("secret123"))
    db_session.add(admin)
    db_session.commit()

    response = client.post("/auth/salon-admin/login", json={"email": "owner@glamour.lk", "password": "secret123"})
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_salon_admin_login_wrong_password(client, db_session):
    salon = _make_salon(db_session)
    admin = SalonAdmin(salon_id=salon.id, email="owner@glamour.lk", password_hash=hash_password("secret123"))
    db_session.add(admin)
    db_session.commit()

    response = client.post("/auth/salon-admin/login", json={"email": "owner@glamour.lk", "password": "wrong"})
    assert response.status_code == 401


def test_platform_admin_login_success(client, db_session):
    admin = PlatformAdmin(email="team@ceylonbellezza.com", password_hash=hash_password("adminpass"))
    db_session.add(admin)
    db_session.commit()

    response = client.post("/auth/platform-admin/login", json={"email": "team@ceylonbellezza.com", "password": "adminpass"})
    assert response.status_code == 200
    assert "access_token" in response.json()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/test_auth.py -v
```

Expected: FAIL with 404 (no `/auth/*` routes registered yet).

- [ ] **Step 3: Write `backend/app/routers/__init__.py`** (empty file)

- [ ] **Step 4: Write `backend/app/routers/auth.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.security import create_access_token, verify_password
from app.database import get_db
from app.models import PlatformAdmin, SalonAdmin

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/salon-admin/login", response_model=TokenResponse)
def salon_admin_login(payload: LoginRequest, db: Session = Depends(get_db)):
    admin = db.query(SalonAdmin).filter(SalonAdmin.email == payload.email).first()
    if admin is None or not verify_password(payload.password, admin.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    token = create_access_token({"sub": str(admin.id), "role": "salon_admin", "salon_id": str(admin.salon_id)})
    return TokenResponse(access_token=token)


@router.post("/platform-admin/login", response_model=TokenResponse)
def platform_admin_login(payload: LoginRequest, db: Session = Depends(get_db)):
    admin = db.query(PlatformAdmin).filter(PlatformAdmin.email == payload.email).first()
    if admin is None or not verify_password(payload.password, admin.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    token = create_access_token({"sub": str(admin.id), "role": "platform_admin"})
    return TokenResponse(access_token=token)
```

- [ ] **Step 5: Register the router in `backend/app/main.py`**

```python
from fastapi import FastAPI

from app.routers import auth

app = FastAPI(title="Ceylon Bellezza API")
app.include_router(auth.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd backend && pytest tests/test_auth.py -v
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers backend/app/main.py backend/tests/test_auth.py
git commit -m "feat: add platform-admin and salon-admin login endpoints"
```

---

### Task 7: Super-admin salon management API

**Files:**
- Create: `backend/app/schemas/salon.py`
- Create: `backend/app/auth/geocoding.py`
- Create: `backend/app/routers/salons.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_salons.py`

**Interfaces:**
- Consumes: `get_current_platform_admin` (Task 5), `Salon`, `SalonAdmin` models (Task 2), `hash_password` (Task 4), `get_db` (Task 1).
- Produces: `POST /admin/salons` (create — geocodes if lat/lng omitted, creates first `SalonAdmin`, returns salon + generated admin temp password), `GET /admin/salons` (list all), `PATCH /admin/salons/{salon_id}/modules` (toggle `enabled_modules`), `PATCH /admin/salons/{salon_id}/status` (set `active`/`suspended`). All require `get_current_platform_admin`. `geocode_address(address: str, city: str) -> tuple[float, float] | None` in `app.auth.geocoding` — later tests mock this directly rather than calling Google's API.

- [ ] **Step 1: Write `backend/app/auth/geocoding.py`**

```python
import googlemaps

from app.config import settings


def geocode_address(address: str, city: str) -> tuple[float, float] | None:
    client = googlemaps.Client(key=settings.google_maps_api_key)
    results = client.geocode(f"{address}, {city}")
    if not results:
        return None
    location = results[0]["geometry"]["location"]
    return location["lat"], location["lng"]
```

- [ ] **Step 2: Write `backend/app/schemas/salon.py`**

```python
import uuid

from pydantic import BaseModel


class SalonCreateRequest(BaseModel):
    slug: str
    name: str
    category: str
    address: str
    city: str
    latitude: float | None = None
    longitude: float | None = None
    admin_email: str
    admin_password: str


class SalonRead(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    category: str
    address: str
    city: str
    latitude: float | None
    longitude: float | None
    status: str
    enabled_modules: dict
    template_settings: dict

    model_config = {"from_attributes": True}


class ModuleToggleRequest(BaseModel):
    gallery: bool
    booking: bool
    contact_form: bool


class StatusUpdateRequest(BaseModel):
    status: str  # "active" | "suspended"
```

- [ ] **Step 3: Write the failing test `backend/tests/test_salons.py`**

```python
from unittest.mock import patch

from app.auth.security import create_access_token


def _platform_token():
    return create_access_token({"sub": "platform-1", "role": "platform_admin"})


def test_create_salon_geocodes_when_lat_lng_missing(client, db_session):
    token = _platform_token()
    with patch("app.routers.salons.geocode_address", return_value=(6.9271, 79.8612)):
        response = client.post(
            "/admin/salons",
            json={
                "slug": "glamour-lk",
                "name": "Glamour Salon",
                "category": "unisex",
                "address": "123 Galle Rd",
                "city": "Colombo",
                "admin_email": "owner@glamour.lk",
                "admin_password": "secret123",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
    assert response.status_code == 201
    body = response.json()
    assert body["slug"] == "glamour-lk"
    assert body["latitude"] == 6.9271
    assert body["longitude"] == 79.8612
    assert body["status"] == "active"


def test_create_salon_requires_platform_admin(client, db_session):
    response = client.post(
        "/admin/salons",
        json={
            "slug": "glamour-lk",
            "name": "Glamour Salon",
            "category": "unisex",
            "address": "123 Galle Rd",
            "city": "Colombo",
            "admin_email": "owner@glamour.lk",
            "admin_password": "secret123",
        },
    )
    assert response.status_code == 401


def test_list_salons(client, db_session):
    token = _platform_token()
    with patch("app.routers.salons.geocode_address", return_value=(6.9, 79.8)):
        client.post(
            "/admin/salons",
            json={
                "slug": "glamour-lk",
                "name": "Glamour Salon",
                "category": "unisex",
                "address": "123 Galle Rd",
                "city": "Colombo",
                "admin_email": "owner@glamour.lk",
                "admin_password": "secret123",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
    response = client.get("/admin/salons", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_toggle_modules(client, db_session):
    token = _platform_token()
    with patch("app.routers.salons.geocode_address", return_value=(6.9, 79.8)):
        created = client.post(
            "/admin/salons",
            json={
                "slug": "glamour-lk",
                "name": "Glamour Salon",
                "category": "unisex",
                "address": "123 Galle Rd",
                "city": "Colombo",
                "admin_email": "owner@glamour.lk",
                "admin_password": "secret123",
            },
            headers={"Authorization": f"Bearer {token}"},
        ).json()

    response = client.patch(
        f"/admin/salons/{created['id']}/modules",
        json={"gallery": False, "booking": True, "contact_form": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["enabled_modules"]["gallery"] is False


def test_suspend_salon(client, db_session):
    token = _platform_token()
    with patch("app.routers.salons.geocode_address", return_value=(6.9, 79.8)):
        created = client.post(
            "/admin/salons",
            json={
                "slug": "glamour-lk",
                "name": "Glamour Salon",
                "category": "unisex",
                "address": "123 Galle Rd",
                "city": "Colombo",
                "admin_email": "owner@glamour.lk",
                "admin_password": "secret123",
            },
            headers={"Authorization": f"Bearer {token}"},
        ).json()

    response = client.patch(
        f"/admin/salons/{created['id']}/status",
        json={"status": "suspended"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "suspended"
```

- [ ] **Step 4: Run test to verify it fails**

```bash
cd backend && pytest tests/test_salons.py -v
```

Expected: FAIL with 404 (no `/admin/salons` routes yet).

- [ ] **Step 5: Write `backend/app/routers/salons.py`**

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_platform_admin
from app.auth.geocoding import geocode_address
from app.auth.security import hash_password
from app.database import get_db
from app.models import Salon, SalonAdmin
from app.schemas.salon import ModuleToggleRequest, SalonCreateRequest, SalonRead, StatusUpdateRequest

router = APIRouter(prefix="/admin/salons", tags=["salons"], dependencies=[Depends(get_current_platform_admin)])


@router.post("", response_model=SalonRead, status_code=status.HTTP_201_CREATED)
def create_salon(payload: SalonCreateRequest, db: Session = Depends(get_db)):
    latitude, longitude = payload.latitude, payload.longitude
    if latitude is None or longitude is None:
        geocoded = geocode_address(payload.address, payload.city)
        if geocoded is not None:
            latitude, longitude = geocoded

    salon = Salon(
        slug=payload.slug,
        name=payload.name,
        category=payload.category,
        address=payload.address,
        city=payload.city,
        latitude=latitude,
        longitude=longitude,
    )
    db.add(salon)
    db.commit()
    db.refresh(salon)

    admin = SalonAdmin(salon_id=salon.id, email=payload.admin_email, password_hash=hash_password(payload.admin_password))
    db.add(admin)
    db.commit()

    return salon


@router.get("", response_model=list[SalonRead])
def list_salons(db: Session = Depends(get_db)):
    return db.query(Salon).all()


@router.patch("/{salon_id}/modules", response_model=SalonRead)
def toggle_modules(salon_id: uuid.UUID, payload: ModuleToggleRequest, db: Session = Depends(get_db)):
    salon = db.get(Salon, salon_id)
    if salon is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Salon not found")
    salon.enabled_modules = payload.model_dump()
    db.commit()
    db.refresh(salon)
    return salon


@router.patch("/{salon_id}/status", response_model=SalonRead)
def update_status(salon_id: uuid.UUID, payload: StatusUpdateRequest, db: Session = Depends(get_db)):
    salon = db.get(Salon, salon_id)
    if salon is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Salon not found")
    salon.status = payload.status
    db.commit()
    db.refresh(salon)
    return salon
```

- [ ] **Step 6: Register the router in `backend/app/main.py`**

```python
from fastapi import FastAPI

from app.routers import auth, salons

app = FastAPI(title="Ceylon Bellezza API")
app.include_router(auth.router)
app.include_router(salons.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
```

- [ ] **Step 7: Run test to verify it passes**

```bash
cd backend && pytest tests/test_salons.py -v
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/app/schemas/salon.py backend/app/auth/geocoding.py backend/app/routers/salons.py backend/app/main.py backend/tests/test_salons.py
git commit -m "feat: add super-admin salon management API"
```

---

### Task 8: Salon-admin services CRUD API

**Files:**
- Create: `backend/app/schemas/service.py`
- Create: `backend/app/routers/services.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_services.py`

**Interfaces:**
- Consumes: `get_current_salon_admin` (Task 5), `Service` model (Task 2), `get_db` (Task 1).
- Produces: `POST /dashboard/services`, `GET /dashboard/services`, `PATCH /dashboard/services/{service_id}`, `DELETE /dashboard/services/{service_id}` — all scoped to `admin["salon_id"]` from the JWT, never a client-supplied salon id.

- [ ] **Step 1: Write `backend/app/schemas/service.py`**

```python
import uuid

from pydantic import BaseModel


class ServiceCreateRequest(BaseModel):
    name: str
    description: str = ""
    category: str
    price: float
    duration_minutes: int


class ServiceUpdateRequest(BaseModel):
    name: str
    description: str = ""
    category: str
    price: float
    duration_minutes: int


class ServiceRead(BaseModel):
    id: uuid.UUID
    salon_id: uuid.UUID
    name: str
    description: str
    category: str
    price: float
    duration_minutes: int

    model_config = {"from_attributes": True}
```

- [ ] **Step 2: Write the failing test `backend/tests/test_services.py`**

```python
from app.auth.security import create_access_token
from app.models import Salon


def _salon_and_token(db_session, salon_id_suffix="1"):
    salon = Salon(slug=f"salon-{salon_id_suffix}", name="Salon", category="unisex", address="Addr", city="Colombo")
    db_session.add(salon)
    db_session.commit()
    token = create_access_token({"sub": "admin-1", "role": "salon_admin", "salon_id": str(salon.id)})
    return salon, token


def test_create_and_list_services(client, db_session):
    salon, token = _salon_and_token(db_session)
    headers = {"Authorization": f"Bearer {token}"}

    create_response = client.post(
        "/dashboard/services",
        json={"name": "Haircut", "category": "hair", "price": 1500.0, "duration_minutes": 30},
        headers=headers,
    )
    assert create_response.status_code == 201
    assert create_response.json()["salon_id"] == str(salon.id)

    list_response = client.get("/dashboard/services", headers=headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1


def test_update_service(client, db_session):
    salon, token = _salon_and_token(db_session)
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post(
        "/dashboard/services",
        json={"name": "Haircut", "category": "hair", "price": 1500.0, "duration_minutes": 30},
        headers=headers,
    ).json()

    response = client.patch(
        f"/dashboard/services/{created['id']}",
        json={"name": "Premium Haircut", "category": "hair", "price": 2000.0, "duration_minutes": 45},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Premium Haircut"


def test_delete_service(client, db_session):
    salon, token = _salon_and_token(db_session)
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post(
        "/dashboard/services",
        json={"name": "Haircut", "category": "hair", "price": 1500.0, "duration_minutes": 30},
        headers=headers,
    ).json()

    response = client.delete(f"/dashboard/services/{created['id']}", headers=headers)
    assert response.status_code == 204

    list_response = client.get("/dashboard/services", headers=headers)
    assert list_response.json() == []
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend && pytest tests/test_services.py -v
```

Expected: FAIL with 404.

- [ ] **Step 4: Write `backend/app/routers/services.py`**

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_salon_admin
from app.database import get_db
from app.models import Service
from app.schemas.service import ServiceCreateRequest, ServiceRead, ServiceUpdateRequest

router = APIRouter(prefix="/dashboard/services", tags=["services"])


@router.post("", response_model=ServiceRead, status_code=status.HTTP_201_CREATED)
def create_service(
    payload: ServiceCreateRequest,
    admin: dict = Depends(get_current_salon_admin),
    db: Session = Depends(get_db),
):
    service = Service(salon_id=uuid.UUID(admin["salon_id"]), **payload.model_dump())
    db.add(service)
    db.commit()
    db.refresh(service)
    return service


@router.get("", response_model=list[ServiceRead])
def list_services(admin: dict = Depends(get_current_salon_admin), db: Session = Depends(get_db)):
    return db.query(Service).filter(Service.salon_id == uuid.UUID(admin["salon_id"])).all()


def _get_owned_service(service_id: uuid.UUID, admin: dict, db: Session) -> Service:
    service = db.get(Service, service_id)
    if service is None or service.salon_id != uuid.UUID(admin["salon_id"]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    return service


@router.patch("/{service_id}", response_model=ServiceRead)
def update_service(
    service_id: uuid.UUID,
    payload: ServiceUpdateRequest,
    admin: dict = Depends(get_current_salon_admin),
    db: Session = Depends(get_db),
):
    service = _get_owned_service(service_id, admin, db)
    for field, value in payload.model_dump().items():
        setattr(service, field, value)
    db.commit()
    db.refresh(service)
    return service


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service(
    service_id: uuid.UUID,
    admin: dict = Depends(get_current_salon_admin),
    db: Session = Depends(get_db),
):
    service = _get_owned_service(service_id, admin, db)
    db.delete(service)
    db.commit()
```

- [ ] **Step 5: Register the router in `backend/app/main.py`**

```python
from fastapi import FastAPI

from app.routers import auth, salons, services

app = FastAPI(title="Ceylon Bellezza API")
app.include_router(auth.router)
app.include_router(salons.router)
app.include_router(services.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd backend && pytest tests/test_services.py -v
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/service.py backend/app/routers/services.py backend/app/main.py backend/tests/test_services.py
git commit -m "feat: add salon-admin services CRUD API"
```

---

### Task 9: Salon-admin staff CRUD API

**Files:**
- Create: `backend/app/schemas/staff.py`
- Create: `backend/app/routers/staff.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_staff.py`

**Interfaces:**
- Consumes: `get_current_salon_admin` (Task 5), `Staff` model (Task 2), `get_db` (Task 1).
- Produces: `POST /dashboard/staff`, `GET /dashboard/staff`, `PATCH /dashboard/staff/{staff_id}`, `DELETE /dashboard/staff/{staff_id}` — scoped to `admin["salon_id"]`, same tenant-isolation pattern as Task 8.

- [ ] **Step 1: Write `backend/app/schemas/staff.py`**

```python
import uuid

from pydantic import BaseModel


class StaffCreateRequest(BaseModel):
    name: str
    photo_url: str | None = None
    bio: str = ""


class StaffUpdateRequest(BaseModel):
    name: str
    photo_url: str | None = None
    bio: str = ""


class StaffRead(BaseModel):
    id: uuid.UUID
    salon_id: uuid.UUID
    name: str
    photo_url: str | None
    bio: str

    model_config = {"from_attributes": True}
```

- [ ] **Step 2: Write the failing test `backend/tests/test_staff.py`**

```python
from app.auth.security import create_access_token
from app.models import Salon


def _salon_and_token(db_session):
    salon = Salon(slug="salon-1", name="Salon", category="unisex", address="Addr", city="Colombo")
    db_session.add(salon)
    db_session.commit()
    token = create_access_token({"sub": "admin-1", "role": "salon_admin", "salon_id": str(salon.id)})
    return salon, token


def test_create_and_list_staff(client, db_session):
    salon, token = _salon_and_token(db_session)
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post("/dashboard/staff", json={"name": "Nadeesha", "bio": "Hair stylist"}, headers=headers)
    assert response.status_code == 201
    assert response.json()["salon_id"] == str(salon.id)

    list_response = client.get("/dashboard/staff", headers=headers)
    assert len(list_response.json()) == 1


def test_update_and_delete_staff(client, db_session):
    salon, token = _salon_and_token(db_session)
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post("/dashboard/staff", json={"name": "Nadeesha", "bio": "Hair stylist"}, headers=headers).json()

    update_response = client.patch(
        f"/dashboard/staff/{created['id']}", json={"name": "Nadeesha Perera", "bio": "Senior stylist"}, headers=headers
    )
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Nadeesha Perera"

    delete_response = client.delete(f"/dashboard/staff/{created['id']}", headers=headers)
    assert delete_response.status_code == 204
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend && pytest tests/test_staff.py -v
```

Expected: FAIL with 404.

- [ ] **Step 4: Write `backend/app/routers/staff.py`**

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_salon_admin
from app.database import get_db
from app.models import Staff
from app.schemas.staff import StaffCreateRequest, StaffRead, StaffUpdateRequest

router = APIRouter(prefix="/dashboard/staff", tags=["staff"])


@router.post("", response_model=StaffRead, status_code=status.HTTP_201_CREATED)
def create_staff(
    payload: StaffCreateRequest,
    admin: dict = Depends(get_current_salon_admin),
    db: Session = Depends(get_db),
):
    staff = Staff(salon_id=uuid.UUID(admin["salon_id"]), **payload.model_dump())
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return staff


@router.get("", response_model=list[StaffRead])
def list_staff(admin: dict = Depends(get_current_salon_admin), db: Session = Depends(get_db)):
    return db.query(Staff).filter(Staff.salon_id == uuid.UUID(admin["salon_id"])).all()


def _get_owned_staff(staff_id: uuid.UUID, admin: dict, db: Session) -> Staff:
    staff = db.get(Staff, staff_id)
    if staff is None or staff.salon_id != uuid.UUID(admin["salon_id"]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member not found")
    return staff


@router.patch("/{staff_id}", response_model=StaffRead)
def update_staff(
    staff_id: uuid.UUID,
    payload: StaffUpdateRequest,
    admin: dict = Depends(get_current_salon_admin),
    db: Session = Depends(get_db),
):
    staff = _get_owned_staff(staff_id, admin, db)
    for field, value in payload.model_dump().items():
        setattr(staff, field, value)
    db.commit()
    db.refresh(staff)
    return staff


@router.delete("/{staff_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_staff(
    staff_id: uuid.UUID,
    admin: dict = Depends(get_current_salon_admin),
    db: Session = Depends(get_db),
):
    staff = _get_owned_staff(staff_id, admin, db)
    db.delete(staff)
    db.commit()
```

- [ ] **Step 5: Register the router in `backend/app/main.py`**

```python
from fastapi import FastAPI

from app.routers import auth, salons, services, staff

app = FastAPI(title="Ceylon Bellezza API")
app.include_router(auth.router)
app.include_router(salons.router)
app.include_router(services.router)
app.include_router(staff.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd backend && pytest tests/test_staff.py -v
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/staff.py backend/app/routers/staff.py backend/app/main.py backend/tests/test_staff.py
git commit -m "feat: add salon-admin staff CRUD API"
```

---

### Task 10: Salon-admin gallery CRUD API

**Files:**
- Create: `backend/app/schemas/gallery.py`
- Create: `backend/app/routers/gallery.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_gallery.py`

**Interfaces:**
- Consumes: `get_current_salon_admin` (Task 5), `GalleryItem` model (Task 2), `get_db` (Task 1).
- Produces: `POST /dashboard/gallery` (body: `{"image_url", "caption"}` — actual file upload to object storage is handled by the frontend/Plan 3; this endpoint just persists the resulting URL), `GET /dashboard/gallery`, `DELETE /dashboard/gallery/{item_id}` — scoped to `admin["salon_id"]`.

- [ ] **Step 1: Write `backend/app/schemas/gallery.py`**

```python
import uuid

from pydantic import BaseModel


class GalleryItemCreateRequest(BaseModel):
    image_url: str
    caption: str = ""


class GalleryItemRead(BaseModel):
    id: uuid.UUID
    salon_id: uuid.UUID
    image_url: str
    caption: str

    model_config = {"from_attributes": True}
```

- [ ] **Step 2: Write the failing test `backend/tests/test_gallery.py`**

```python
from app.auth.security import create_access_token
from app.models import Salon


def _salon_and_token(db_session):
    salon = Salon(slug="salon-1", name="Salon", category="unisex", address="Addr", city="Colombo")
    db_session.add(salon)
    db_session.commit()
    token = create_access_token({"sub": "admin-1", "role": "salon_admin", "salon_id": str(salon.id)})
    return salon, token


def test_create_list_and_delete_gallery_item(client, db_session):
    salon, token = _salon_and_token(db_session)
    headers = {"Authorization": f"Bearer {token}"}

    created = client.post(
        "/dashboard/gallery", json={"image_url": "https://cdn.example.com/photo1.jpg", "caption": "Bridal look"}, headers=headers
    )
    assert created.status_code == 201
    assert created.json()["salon_id"] == str(salon.id)

    listed = client.get("/dashboard/gallery", headers=headers)
    assert len(listed.json()) == 1

    deleted = client.delete(f"/dashboard/gallery/{created.json()['id']}", headers=headers)
    assert deleted.status_code == 204
    assert client.get("/dashboard/gallery", headers=headers).json() == []
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend && pytest tests/test_gallery.py -v
```

Expected: FAIL with 404.

- [ ] **Step 4: Write `backend/app/routers/gallery.py`**

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_salon_admin
from app.database import get_db
from app.models import GalleryItem
from app.schemas.gallery import GalleryItemCreateRequest, GalleryItemRead

router = APIRouter(prefix="/dashboard/gallery", tags=["gallery"])


@router.post("", response_model=GalleryItemRead, status_code=status.HTTP_201_CREATED)
def create_gallery_item(
    payload: GalleryItemCreateRequest,
    admin: dict = Depends(get_current_salon_admin),
    db: Session = Depends(get_db),
):
    item = GalleryItem(salon_id=uuid.UUID(admin["salon_id"]), **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("", response_model=list[GalleryItemRead])
def list_gallery_items(admin: dict = Depends(get_current_salon_admin), db: Session = Depends(get_db)):
    return db.query(GalleryItem).filter(GalleryItem.salon_id == uuid.UUID(admin["salon_id"])).all()


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_gallery_item(
    item_id: uuid.UUID,
    admin: dict = Depends(get_current_salon_admin),
    db: Session = Depends(get_db),
):
    item = db.get(GalleryItem, item_id)
    if item is None or item.salon_id != uuid.UUID(admin["salon_id"]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gallery item not found")
    db.delete(item)
    db.commit()
```

- [ ] **Step 5: Register the router in `backend/app/main.py`**

```python
from fastapi import FastAPI

from app.routers import auth, gallery, salons, services, staff

app = FastAPI(title="Ceylon Bellezza API")
app.include_router(auth.router)
app.include_router(salons.router)
app.include_router(services.router)
app.include_router(staff.router)
app.include_router(gallery.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd backend && pytest tests/test_gallery.py -v
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/gallery.py backend/app/routers/gallery.py backend/app/main.py backend/tests/test_gallery.py
git commit -m "feat: add salon-admin gallery CRUD API"
```

---

### Task 11: Salon-admin content block API

**Files:**
- Create: `backend/app/schemas/content.py`
- Create: `backend/app/routers/content.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_content.py`

**Interfaces:**
- Consumes: `get_current_salon_admin` (Task 5), `ContentBlock` model (Task 2), `get_db` (Task 1).
- Produces: `PUT /dashboard/content/{key}` (upsert — creates or updates the block for `key` in `{"about_us", "contact_info"}`, scoped to `admin["salon_id"]`), `GET /dashboard/content` (list all blocks for the salon).

- [ ] **Step 1: Write `backend/app/schemas/content.py`**

```python
import uuid

from pydantic import BaseModel


class ContentBlockUpsertRequest(BaseModel):
    value: str


class ContentBlockRead(BaseModel):
    id: uuid.UUID
    salon_id: uuid.UUID
    key: str
    value: str

    model_config = {"from_attributes": True}
```

- [ ] **Step 2: Write the failing test `backend/tests/test_content.py`**

```python
from app.auth.security import create_access_token
from app.models import Salon


def _salon_and_token(db_session):
    salon = Salon(slug="salon-1", name="Salon", category="unisex", address="Addr", city="Colombo")
    db_session.add(salon)
    db_session.commit()
    token = create_access_token({"sub": "admin-1", "role": "salon_admin", "salon_id": str(salon.id)})
    return salon, token


def test_upsert_creates_then_updates_content_block(client, db_session):
    salon, token = _salon_and_token(db_session)
    headers = {"Authorization": f"Bearer {token}"}

    first = client.put("/dashboard/content/about_us", json={"value": "We are a full-service salon."}, headers=headers)
    assert first.status_code == 200
    assert first.json()["key"] == "about_us"

    second = client.put("/dashboard/content/about_us", json={"value": "Updated about text."}, headers=headers)
    assert second.status_code == 200
    assert second.json()["value"] == "Updated about text."

    listed = client.get("/dashboard/content", headers=headers)
    assert len(listed.json()) == 1
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend && pytest tests/test_content.py -v
```

Expected: FAIL with 404.

- [ ] **Step 4: Write `backend/app/routers/content.py`**

```python
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_salon_admin
from app.database import get_db
from app.models import ContentBlock
from app.schemas.content import ContentBlockRead, ContentBlockUpsertRequest

router = APIRouter(prefix="/dashboard/content", tags=["content"])


@router.put("/{key}", response_model=ContentBlockRead)
def upsert_content_block(
    key: str,
    payload: ContentBlockUpsertRequest,
    admin: dict = Depends(get_current_salon_admin),
    db: Session = Depends(get_db),
):
    salon_id = uuid.UUID(admin["salon_id"])
    block = (
        db.query(ContentBlock)
        .filter(ContentBlock.salon_id == salon_id, ContentBlock.key == key)
        .first()
    )
    if block is None:
        block = ContentBlock(salon_id=salon_id, key=key, value=payload.value)
        db.add(block)
    else:
        block.value = payload.value
    db.commit()
    db.refresh(block)
    return block


@router.get("", response_model=list[ContentBlockRead])
def list_content_blocks(admin: dict = Depends(get_current_salon_admin), db: Session = Depends(get_db)):
    return db.query(ContentBlock).filter(ContentBlock.salon_id == uuid.UUID(admin["salon_id"])).all()
```

- [ ] **Step 5: Register the router in `backend/app/main.py`**

```python
from fastapi import FastAPI

from app.routers import auth, content, gallery, salons, services, staff

app = FastAPI(title="Ceylon Bellezza API")
app.include_router(auth.router)
app.include_router(salons.router)
app.include_router(services.router)
app.include_router(staff.router)
app.include_router(gallery.router)
app.include_router(content.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd backend && pytest tests/test_content.py -v
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/content.py backend/app/routers/content.py backend/app/main.py backend/tests/test_content.py
git commit -m "feat: add salon-admin content block upsert API"
```

---

### Task 12: Cross-salon tenant isolation test suite

**Files:**
- Test: `backend/tests/test_tenant_isolation.py`

**Interfaces:**
- Consumes: all routers from Tasks 7–11, `create_access_token` (Task 4). No production code changes expected — this task proves the isolation already built into Tasks 8–11 (filtering every query by `admin["salon_id"]`) actually holds across resources. If any assertion fails, fix the offending router in place before committing.

- [ ] **Step 1: Write the failing-or-passing test `backend/tests/test_tenant_isolation.py`**

```python
from app.auth.security import create_access_token
from app.models import GalleryItem, Salon, Service, Staff


def _two_salons_with_tokens(db_session):
    salon_a = Salon(slug="salon-a", name="Salon A", category="unisex", address="Addr A", city="Colombo")
    salon_b = Salon(slug="salon-b", name="Salon B", category="unisex", address="Addr B", city="Kandy")
    db_session.add_all([salon_a, salon_b])
    db_session.commit()

    token_a = create_access_token({"sub": "admin-a", "role": "salon_admin", "salon_id": str(salon_a.id)})
    token_b = create_access_token({"sub": "admin-b", "role": "salon_admin", "salon_id": str(salon_b.id)})
    return salon_a, salon_b, token_a, token_b


def test_salon_a_cannot_see_salon_b_services(client, db_session):
    salon_a, salon_b, token_a, token_b = _two_salons_with_tokens(db_session)
    db_session.add(Service(salon_id=salon_b.id, name="Beard Trim", category="grooming", price=800.0, duration_minutes=20))
    db_session.commit()

    response = client.get("/dashboard/services", headers={"Authorization": f"Bearer {token_a}"})
    assert response.json() == []


def test_salon_a_cannot_update_salon_b_service(client, db_session):
    salon_a, salon_b, token_a, token_b = _two_salons_with_tokens(db_session)
    service_b = Service(salon_id=salon_b.id, name="Beard Trim", category="grooming", price=800.0, duration_minutes=20)
    db_session.add(service_b)
    db_session.commit()

    response = client.patch(
        f"/dashboard/services/{service_b.id}",
        json={"name": "Hacked", "category": "grooming", "price": 1.0, "duration_minutes": 5},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert response.status_code == 404


def test_salon_a_cannot_delete_salon_b_staff(client, db_session):
    salon_a, salon_b, token_a, token_b = _two_salons_with_tokens(db_session)
    staff_b = Staff(salon_id=salon_b.id, name="Kasun", bio="Barber")
    db_session.add(staff_b)
    db_session.commit()

    response = client.delete(f"/dashboard/staff/{staff_b.id}", headers={"Authorization": f"Bearer {token_a}"})
    assert response.status_code == 404


def test_salon_a_cannot_see_salon_b_gallery(client, db_session):
    salon_a, salon_b, token_a, token_b = _two_salons_with_tokens(db_session)
    db_session.add(GalleryItem(salon_id=salon_b.id, image_url="https://cdn.example.com/b.jpg"))
    db_session.commit()

    response = client.get("/dashboard/gallery", headers={"Authorization": f"Bearer {token_a}"})
    assert response.json() == []
```

- [ ] **Step 2: Run the tests**

```bash
cd backend && pytest tests/test_tenant_isolation.py -v
```

Expected: PASS — Tasks 8–11 already scope every query by the JWT's `salon_id`, so no other salon's rows are ever returned, and cross-salon writes 404 rather than succeeding. If anything fails, fix the corresponding router before proceeding.

- [ ] **Step 3: Run the full test suite to confirm nothing regressed**

```bash
cd backend && pytest -v
```

Expected: all tests across every task pass.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_tenant_isolation.py
git commit -m "test: add cross-salon tenant isolation test suite"
```

---

## Self-Review Notes

- **Spec coverage**: data model (Task 2/3), both auth flows (Tasks 4–6), super-admin salon management incl. geocoding/module toggles/suspend (Task 7), salon-admin CRUD for services/staff/gallery/content (Tasks 8–11), tenant isolation (Task 12). Booking endpoints, the public directory/salon page, and both dashboards' UIs are intentionally out of scope — they belong to Plans 2–4 per the spec's sub-project breakdown.
- **Placeholder scan**: no TBD/TODO markers; every step has runnable code.
- **Type consistency**: `get_current_salon_admin` returns `{"id": str, "salon_id": str}` in Task 5 and every consumer (Tasks 8–11) reads `admin["salon_id"]` the same way; `get_current_platform_admin` returns `{"id": str}` and Task 7 depends on it via router-level `dependencies=[...]` rather than a parameter, since no endpoint needs the admin's own id.
