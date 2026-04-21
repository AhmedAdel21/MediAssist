# Part IV — Data Layer

## §27 SQLAlchemy 2.0 Async

### What SQLAlchemy Is

SQLAlchemy is Python's dominant ORM and SQL toolkit. Version 2.0 (released 2023) was a major API overhaul. This codebase uses the 2.0 style throughout — do not mix 1.x patterns into it.

### 1.x vs 2.0 — The Two Worlds

> **⚠️ Gotcha:** SQLAlchemy 2.0 ships with backwards-compatibility shims that silently accept 1.x syntax and emit deprecation warnings. A codebase can accidentally mix both styles. Know the difference.

| Feature | SQLAlchemy 1.x (old) | SQLAlchemy 2.0 (this codebase) |
|---------|----------------------|-------------------------------|
| Model base | `Base = declarative_base()` | `class Base(DeclarativeBase): pass` |
| Column definition | `id = Column(String, primary_key=True)` | `id: Mapped[str] = mapped_column(String, primary_key=True)` |
| Nullable | `Column(String, nullable=True)` | `id: Mapped[Optional[str]]` (type annotation drives nullability) |
| Query | `session.query(User).filter(User.email == e)` | `select(User).where(User.email == e)` |
| Execute | `session.query(User).all()` | `(await session.execute(select(User))).scalars().all()` |
| Async session | `AsyncSession` (separate extension) | First-class, built-in |
| Engine | `create_engine(url)` | `create_async_engine(url)` |

### Your `database.py` — Annotated

```python
# database.py
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass
# DeclarativeBase replaces the old declarative_base() function.
# All ORM models inherit from Base; Base.metadata.create_all() creates tables.

engine = create_async_engine(
    settings.database_url,   # "sqlite+aiosqlite:///./mediassist.db"
    echo=False,              # True logs every SQL query — useful for debugging
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,  # ← CRITICAL for async; explained below
)
```

### `expire_on_commit=False` — Why This Is Mandatory in Async

In synchronous SQLAlchemy, after `session.commit()`, all loaded objects are "expired" — their attributes are cleared and will be lazily re-fetched from the DB on next access. This is fine in sync code (the session is still open, the re-fetch is transparent).

In async code, lazy loading triggers a synchronous DB call from a non-async context — this raises `MissingGreenlet` or `DetachedInstanceError`:

```python
# Without expire_on_commit=False — BROKEN in async
user = await session.get(User, user_id)
await session.commit()
print(user.email)   # MissingGreenlet: greenlet_spawn has not been called
                    # SQLAlchemy tries to lazy-load but there's no running greenlet

# With expire_on_commit=False — WORKS
# Attributes remain cached after commit; no lazy-load triggered
```

> **💡 Senior Tip:** `expire_on_commit=False` means in-memory objects may be stale after a commit if another process modified the same row. For this single-writer SQLite app that's fine. In a multi-writer Postgres environment, you'd call `await session.refresh(user)` explicitly after commits where freshness matters.

### `Mapped[]` — Type-Annotated Columns

```python
# auth/models.py
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Boolean, DateTime
from datetime import datetime
import uuid

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),  # Python-side default, not DB-side
    )
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, default=UserRole.PATIENT)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
```

`Mapped[str]` = NOT NULL column returning `str`. `Mapped[Optional[str]]` = nullable column returning `str | None`. The type annotation drives nullability — no need to set `nullable=False` explicitly when using `Mapped[str]`.

**`default` vs `server_default`:**
- `default=lambda: str(uuid.uuid4())` — Python generates the value before INSERT
- `server_default=func.now()` — the DB generates the value at INSERT time via SQL `DEFAULT NOW()`

For `id`, use Python-side default so you know the ID before the INSERT completes (useful for building response objects without a round-trip).

### Async Query Patterns

```python
# Get by primary key
user = await session.get(User, user_id)   # returns None if not found

# Select with filter — 2.0 style
from sqlalchemy import select

stmt = select(User).where(User.email == email)
result = await session.execute(stmt)
user = result.scalar_one_or_none()   # returns one row or None; raises if multiple

# Multiple rows
stmt = select(User).where(User.is_active == True).limit(20).offset(0)
result = await session.execute(stmt)
users = result.scalars().all()   # list of User objects

# Count — used in admin/router.py for pagination
from sqlalchemy import func, select

count_stmt = select(func.count()).select_from(User).where(User.is_active == True)
total = (await session.execute(count_stmt)).scalar()

# INSERT
new_user = User(email="a@b.com", ...)
session.add(new_user)
await session.commit()
await session.refresh(new_user)   # optional: fetch server-generated fields

# UPDATE — used in admin/router.py
user.role = UserRole.DOCTOR
user.updated_at = datetime.utcnow()
await session.commit()

# DELETE
await session.delete(user)
await session.commit()
```

> **🔁 Dart Analogy:** `select(User).where(User.email == email)` is SQLAlchemy's equivalent of Dart's `isar.where().emailEqualTo(email).findFirst()` in Isar, or `drift`'s `(select(users)..where((u) => u.email.equals(email))).getSingleOrNull()`.

### `init_db` — Schema Creation

```python
# database.py
async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
```

`engine.begin()` opens a connection and starts a transaction. `run_sync` bridges async context → sync SQLAlchemy metadata API (which is sync-only). `create_all` creates tables that don't exist yet; it's idempotent. In production, replace this with Alembic migrations (see §30).

---

## §28 aiosqlite

### What It Is

`aiosqlite` wraps Python's standard `sqlite3` module (a C extension, inherently synchronous) in a background thread, exposing a coroutine-based API. SQLAlchemy's `aiosqlite` dialect (`sqlite+aiosqlite://`) uses this transparently.

```python
# What happens under the hood when you await session.execute(stmt):
# 1. SQLAlchemy serializes stmt to SQL string
# 2. aiosqlite dispatches to its background thread via asyncio.Queue
# 3. Background thread executes sqlite3 call (blocking, but isolated)
# 4. Result is put back on the queue
# 5. Your coroutine resumes with the result
```

### SQLite Connection Pooling Caveats

SQLAlchemy normally pools connections for performance. SQLite has a critical constraint: **a SQLite file can only have one writer at a time**. Multiple simultaneous writers cause `OperationalError: database is locked`.

`aiosqlite` uses a single persistent connection per engine. With `create_async_engine`, the pool size is effectively 1 by default for aiosqlite. This is actually correct behavior for SQLite — don't override it.

```python
# DO NOT do this with aiosqlite:
engine = create_async_engine(url, pool_size=10)  # won't help; SQLite serializes writes anyway

# For SQLite, the correct tuning:
engine = create_async_engine(
    url,
    connect_args={"check_same_thread": False},  # needed for SQLite + threading
)
```

### WAL Mode — The One Tuning That Matters for SQLite

Write-Ahead Logging (WAL) allows concurrent readers while a write is in progress:

```python
# database.py — add this for production SQLite
from sqlalchemy import event

@event.listens_for(engine.sync_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()
```

Without WAL, a single writer blocks all readers. With WAL, reads and writes can overlap — critical for a web server with concurrent requests.

> **💡 Senior Tip:** SQLite is excellent for development, single-server production apps under ~10K req/day, and testing. For anything that needs horizontal scaling, concurrent writes at volume, or multiple server processes — switch to PostgreSQL with `asyncpg` driver. The SQLAlchemy query code is identical; only the `DATABASE_URL` and driver change.

---

## §29 Session Management Patterns

### The `get_db` Pattern — Request-Scoped Sessions

```python
# database.py
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except HTTPException:
            raise              # don't rollback on intentional HTTP errors
        except Exception as exc:
            logger.error("DB session error: %s", exc, exc_info=True)
            raise              # context manager will rollback on __aexit__
        finally:
            await session.close()
```

`async with AsyncSessionLocal() as session` is equivalent to:
```python
session = AsyncSessionLocal()
await session.__aenter__()
# ... endpoint body runs ...
await session.__aexit__(exc_type, exc_val, exc_tb)  # rolls back if exception
```

If the endpoint commits explicitly (`await session.commit()`), the context manager exits cleanly. If an unhandled exception propagates, the context manager rolls back automatically.

### Transaction Lifecycle in Practice

```python
# auth/router.py — register endpoint
async def register(data: UserRegister, db: AsyncSession = Depends(get_db)):
    existing = await get_user_by_email(db, data.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    #      ↑ HTTPException is caught by get_db, re-raised without rollback
    #      (the insert hasn't happened yet, so rollback is a no-op)

    user = await create_user(db, data)
    #           ↑ this does session.add(user) + await session.commit()
    return UserResponse.model_validate(user)
```

Inside `create_user`:
```python
# auth/service.py
async def create_user(db: AsyncSession, data: UserRegister) -> User:
    user = User(
        email=data.email,
        full_name=data.full_name,
        hashed_password=hash_password(data.password),
        role=data.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)   # populates server-generated created_at, updated_at
    return user
```

### Avoid Detached Instance Errors

A `DetachedInstanceError` happens when you access a relationship attribute after the session is closed:

```python
# WRONG — session closed after get_db yields
async def endpoint(db: AsyncSession = Depends(get_db)):
    user = await session.get(User, user_id)
    return user    # FastAPI serializes *after* the endpoint returns
                   # If User has lazy-loaded relationships, this fails
```

Since `UserResponse` doesn't include relationships (just scalar fields), this isn't a current problem. But if you add relationships later, use `selectinload` or `joinedload` to eagerly load them:

```python
from sqlalchemy.orm import selectinload

stmt = select(User).options(selectinload(User.documents)).where(User.id == user_id)
result = await session.execute(stmt)
user = result.scalar_one()
```

---

## §30 Migrations — The Missing Alembic

### Why There's No Alembic Here

The codebase uses `init_db()` → `Base.metadata.create_all()` on startup. This is fine for:
- Development (tables recreate from scratch)
- First deploy (empty DB, create all tables)
- Testing (in-memory DB per test)

It **breaks** the moment you need to:
- Add a column to an existing production table
- Rename a column
- Add an index to a table with live data
- Roll back a bad schema change

`create_all` is additive-only and non-destructive: it creates missing tables but never alters existing ones. Adding `role: Mapped[str]` to `User` when the table already exists = the column silently doesn't appear.

### Adding Alembic — Step by Step

```bash
pip install alembic
alembic init alembic
```

This creates:
```
alembic/
    env.py          ← configure your DB URL and metadata here
    versions/       ← migration files live here
alembic.ini         ← points to env.py
```

**Configure `alembic/env.py` for async:**

```python
# alembic/env.py
import asyncio
from logging.config import fileConfig
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context

from database import Base   # your Base from database.py
from auth.models import User  # import all models so metadata is populated

config = context.config
fileConfig(config.config_file_name)

target_metadata = Base.metadata   # Alembic compares this against the DB schema

def run_migrations_online():
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
    )

    async def do_run():
        async with connectable.connect() as connection:
            await connection.run_sync(context.run_migrations)

    asyncio.run(do_run())

run_migrations_online()
```

**Generate a migration:**

```bash
alembic revision --autogenerate -m "add users table"
# Alembic diffs Base.metadata against the current DB schema
# and generates a migration file in alembic/versions/
```

**Apply migrations:**

```bash
alembic upgrade head   # apply all pending migrations
alembic downgrade -1   # roll back one migration
```

**In `main.py`, replace `init_db()` with a migration check:**

```python
# main.py — production pattern
from alembic import command
from alembic.config import Config

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run pending migrations on startup
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")   # sync, but runs once at startup
    setup_telemetry()
    yield
```

> **💡 Senior Tip:** `alembic --autogenerate` is a diff tool, not a mind reader. It detects table additions, column additions/removals, and index changes. It does NOT detect: column renames (it sees drop + add), data migrations (moving data between tables), or changes to server defaults that don't affect the column type. Always review generated migrations before applying to production.
