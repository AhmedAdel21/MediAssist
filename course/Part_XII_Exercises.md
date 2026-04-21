# Part XII — 10 Mastery Exercises

Each exercise targets a real gap or improvement opportunity in the MediAssist codebase. Solutions are hidden in collapsible blocks — attempt them first.

---

## Exercise 1 — Fix the Blocking bcrypt Call

**Problem:** `auth/service.py:hash_password` calls `bcrypt.hashpw` synchronously inside async endpoints. At `rounds=12`, this takes ~100ms and blocks the entire event loop.

**Task:** Refactor `hash_password` and `verify_password` in `auth/service.py` to run in a threadpool executor so the event loop is not blocked.

**Acceptance criteria:**
- `hash_password_async(password: str) -> str` is a coroutine
- `verify_password_async(plain: str, hashed: str) -> bool` is a coroutine
- `auth/router.py` uses the async versions
- Existing tests still pass

<details>
<summary>Solution</summary>

```python
# auth/service.py
import asyncio
import functools
import bcrypt

async def hash_password_async(password: str) -> str:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None,
        lambda: bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8"),
    )

async def verify_password_async(plain: str, hashed: str) -> bool:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None,
        lambda: bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8")),
    )

# auth/service.py — update authenticate_user to use async verify
async def authenticate_user(db: AsyncSession, email: str, password: str) -> User | None:
    user = await get_user_by_email(db, email)
    if not user:
        return None
    if not await verify_password_async(password, user.hashed_password):
        return None
    if not user.is_active:
        return None
    return user

# auth/service.py — update create_user to use async hash
async def create_user(db: AsyncSession, data: UserRegister) -> User:
    user = User(
        email=data.email,
        full_name=data.full_name,
        hashed_password=await hash_password_async(data.password),
        role=data.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
```

**Why `run_in_executor` works:** It submits the callable to the default `ThreadPoolExecutor`. The event loop suspends the calling coroutine and resumes it when the thread finishes — no event loop blocking.

**Why not `asyncio.to_thread`?** `asyncio.to_thread` (Python 3.9+) is cleaner syntax for the same pattern: `await asyncio.to_thread(bcrypt.hashpw, password.encode(), bcrypt.gensalt())`. Either works; `to_thread` is preferred in 3.9+.

</details>

---

## Exercise 2 — Add `asyncio.timeout` to External API Calls

**Problem:** `agents/service.py:MedicalAgent.stream` has no timeout on Gemini calls. A stalled Gemini API holds connections open indefinitely. Similarly, `rag/service.py:_get_embedding` has no timeout on Anthropic calls.

**Task:** Add a 30-second timeout to `_get_embedding` in `rag/service.py` and a 60-second total timeout to the agentic loop in `agents/service.py:stream`.

<details>
<summary>Solution</summary>

```python
# rag/service.py
import asyncio

async def _get_embedding(self, text: str) -> list[float]:
    if not self.anthropic or settings.anthropic_api_key.startswith("sk-ant-test"):
        seed = hash(text) % (2**31)
        rng = random.Random(seed)
        return [rng.uniform(-1, 1) for _ in range(self.EMBEDDING_DIMENSIONS)]

    try:
        async with asyncio.timeout(30.0):
            response = await self.anthropic.embeddings.create(
                model="voyage-medical-2",
                input=text,
            )
            return response.embeddings[0].embedding
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=504,
            detail="Embedding service timed out. Please try again.",
        )

# agents/service.py
async def stream(
    self, message: str, conversation_history: list[dict]
) -> AsyncGenerator[str, None]:
    try:
        async with asyncio.timeout(60.0):   # 60s total budget for full agentic loop
            chat = self.model.start_chat(
                history=self._build_history(conversation_history)
            )
            current_message = message
            iterations = 0

            while iterations < self.MAX_ITERATIONS:
                # ... existing loop logic ...
                pass

    except asyncio.TimeoutError:
        yield "The AI assistant is taking too long to respond. Please try again."
    except Exception as e:
        if "ResourceExhausted" in type(e).__name__:
            raise HTTPException(status_code=429, detail="AI rate limit exceeded")
        raise HTTPException(status_code=500, detail=f"AI error: {e}")
```

**Why 60s for the loop, 30s per embedding?** The agentic loop may make 2–3 tool calls, each involving an embedding (30s each). The total budget (60s) covers multiple iterations. If embedding times out, it propagates up through the loop.

**Python 3.9/3.10 compatibility:** Replace `asyncio.timeout(N)` with `asyncio.wait_for(coro, timeout=N)` for pre-3.11.

</details>

---

## Exercise 3 — Decouple `PolicyEngine` from `HTTPException`

**Problem:** `authz/policies.py:PolicyEngine` raises `fastapi.HTTPException` directly — the domain layer depends on the HTTP framework.

**Task:** Introduce a `PermissionDeniedError` domain exception. Update `PolicyEngine` to raise it. Register an exception handler in `main.py` that converts it to a 403 response.

<details>
<summary>Solution</summary>

```python
# authz/exceptions.py (new file)
class PermissionDeniedError(Exception):
    def __init__(self, detail: str = "Permission denied"):
        self.detail = detail
        super().__init__(detail)

# authz/policies.py — updated
from authz.exceptions import PermissionDeniedError

class PolicyEngine:
    @staticmethod
    def assert_role(user: User, *roles: UserRole) -> None:
        if not PolicyEngine.check_role(user, *roles):
            raise PermissionDeniedError(
                f"Role '{user.role}' is not in required roles: {[r.value for r in roles]}"
            )

    @staticmethod
    def assert_owns_document(user: User, owner_id: str) -> None:
        if not PolicyEngine.check_owns_document(user, owner_id):
            raise PermissionDeniedError("You can only delete your own documents")

    @staticmethod
    def assert_nurse_patient_access(nurse: User, assigned_nurse_ids: list[str]) -> None:
        if not PolicyEngine.check_nurse_patient_access(nurse, assigned_nurse_ids):
            raise PermissionDeniedError("You do not have access to this patient's records")

# main.py — add exception handler
from fastapi import Request
from fastapi.responses import JSONResponse
from authz.exceptions import PermissionDeniedError

@app.exception_handler(PermissionDeniedError)
async def permission_denied_handler(request: Request, exc: PermissionDeniedError):
    return JSONResponse(
        status_code=403,
        content={"detail": exc.detail},
    )
```

**Why this matters:** `PolicyEngine` can now be unit-tested without a running FastAPI app. `PermissionDeniedError` carries semantic meaning independent of HTTP. The translation to HTTP 403 is the framework boundary's responsibility, not the domain's.

</details>

---

## Exercise 4 — Add Alembic to the Project

**Problem:** The codebase uses `Base.metadata.create_all()` — no migration history, no safe schema evolution.

**Task:** Add Alembic support with async configuration. Generate an initial migration for the `users` table.

<details>
<summary>Solution</summary>

```bash
# Terminal
pip install alembic
alembic init alembic
```

```python
# alembic/env.py — replace contents
import asyncio
from logging.config import fileConfig
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context

# Import all models so their tables are registered in Base.metadata
from database import Base
from auth.models import User  # noqa: F401

config = context.config
fileConfig(config.config_file_name)
target_metadata = Base.metadata

def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    # Read DATABASE_URL from environment (same as app)
    import os
    configuration["sqlalchemy.url"] = os.getenv(
        "DATABASE_URL", "sqlite+aiosqlite:///./mediassist.db"
    )

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=None,
    )

    async def do_run():
        async with connectable.connect() as connection:
            await connection.run_sync(context.run_migrations)
        await connectable.dispose()

    asyncio.run(do_run())

run_migrations_online()
```

```bash
# Generate initial migration
alembic revision --autogenerate -m "create users table"

# Apply migration
alembic upgrade head

# Verify
alembic current   # shows current revision
alembic history   # shows all revisions
```

```python
# main.py — replace init_db() with Alembic
from alembic import command
from alembic.config import Config

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run pending migrations synchronously (once at startup)
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")
    setup_telemetry()
    yield
```

</details>

---

## Exercise 5 — Implement True Gemini Streaming

**Problem:** `agents/service.py:MedicalAgent.stream` simulates streaming by splitting the complete response into words. Real streaming yields tokens as Gemini generates them.

**Task:** Replace the word-split simulation with true Gemini streaming using `model.generate_content_async(stream=True)`.

<details>
<summary>Solution</summary>

```python
# agents/service.py — true streaming version
# Note: true streaming with tool use requires careful handling
# because tool_calls come in separate stream events

async def stream(
    self, message: str, conversation_history: list[dict]
) -> AsyncGenerator[str, None]:
    chat = self.model.start_chat(history=self._build_history(conversation_history))
    current_message = message
    iterations = 0

    while iterations < self.MAX_ITERATIONS:
        iterations += 1

        # Use streaming=True for the final generation
        # For tool-call detection, we still need the complete response first
        response = await chat.send_message_async(current_message)

        function_calls = [
            p.function_call
            for p in response.parts
            if hasattr(p, "function_call") and p.function_call.name
        ]
        text_parts = [
            p.text for p in response.parts
            if hasattr(p, "text") and p.text
        ]

        if function_calls:
            # Tool calls can't be streamed — execute and continue loop
            tool_results = []
            for fc in function_calls:
                result = await self._execute_tool(fc.name, dict(fc.args))
                tool_results.append(
                    protos.Part(
                        function_response=protos.FunctionResponse(
                            name=fc.name,
                            response={"result": result},
                        )
                    )
                )
            current_message = tool_results
        else:
            # Final text — stream character by character using async generator
            # For true streaming, use generate_content with stream=True
            final_prompt = [{"role": "user", "parts": [current_message]}] if isinstance(current_message, str) else current_message

            async for chunk in await self.model.generate_content_async(
                final_prompt if not isinstance(current_message, str) else current_message,
                stream=True,
            ):
                if chunk.text:
                    yield chunk.text   # yield as tokens arrive
            break

    logger.info("Agent completed", extra={"iterations": iterations})
```

**Note:** Gemini's streaming API (`stream=True`) yields `GenerateContentResponse` chunks with `.text` containing the token delta. This is true streaming — tokens arrive as the model generates them, not after the full response is ready.

</details>

---

## Exercise 6 — Mock Anthropic Embedding Call in Tests

**Problem:** `rag/service.py` uses a `startswith("sk-ant-test")` gate for test mode. But what if you want to test the actual API call path with a mock?

**Task:** Write a pytest test that uses `pytest-httpx` to mock the Anthropic embeddings API call and verify that `RAGService.index_document` correctly stores the returned embedding.

<details>
<summary>Solution</summary>

```python
# tests/test_rag_embedding.py
import pytest
from pytest_httpx import HTTPXMock
from httpx import AsyncClient

DOCTOR_DATA = {
    "email": "doc@test.com",
    "full_name": "Dr. Test",
    "password": "SecurePass1",
    "role": "doctor",
}

async def register_and_login(client: AsyncClient, data: dict) -> str:
    await client.post("/api/v1/auth/register", json=data)
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": data["email"], "password": data["password"]},
    )
    return resp.json()["access_token"]


async def test_upload_calls_embedding_api(
    client: AsyncClient,
    httpx_mock: HTTPXMock,
    monkeypatch,
):
    # Override the test API key gate so we hit the actual embedding path
    import os
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-real-looking-key-for-test")

    # Mock Anthropic embeddings endpoint
    httpx_mock.add_response(
        url="https://api.anthropic.com/v1/embeddings",
        json={
            "model": "voyage-medical-2",
            "embeddings": [{"embedding": [0.1] * 384, "index": 0}],
            "usage": {"total_tokens": 10},
        },
        status_code=200,
    )

    token = await register_and_login(client, DOCTOR_DATA)
    response = await client.post(
        "/api/v1/documents/upload",
        files={"file": ("test.txt", b"Patient shows signs of acute MI.", "text/plain")},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["chunks_created"] >= 1
    assert "doc_id" in data

    # Verify the mock was actually called
    requests = httpx_mock.get_requests()
    embedding_calls = [r for r in requests if "embeddings" in str(r.url)]
    assert len(embedding_calls) >= 1
```

</details>

---

## Exercise 7 — Fix `cors_origins` Whitespace Bug

**Problem:** `settings.cors_origins.split(",")` doesn't strip whitespace. `"http://a.com, http://b.com"` produces `["http://a.com", " http://b.com"]` — the leading space breaks CORS header matching.

**Task:** Fix in `config.py` by changing `cors_origins` from `str` to `list[str]`, supporting both JSON array env var and comma-separated string.

<details>
<summary>Solution</summary>

```python
# config.py
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ... other fields ...
    cors_origins: list[str] = ["http://localhost:3000"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v) -> list[str]:
        if isinstance(v, str):
            # Handle both JSON array and comma-separated string
            if v.startswith("["):
                import json
                return json.loads(v)
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

settings = Settings()
```

```python
# main.py — simplified (no more .split(","))
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,   # already a list[str]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Env var usage:**
```bash
# Both forms now work:
CORS_ORIGINS="http://localhost:3000,https://app.mediassist.com"
CORS_ORIGINS='["http://localhost:3000","https://app.mediassist.com"]'
```

</details>

---

## Exercise 8 — Implement `exclude_unset` for PATCH Endpoint

**Problem:** `admin/router.py:update_user` uses `model_dump(exclude_none=True)`. This means a client can't explicitly set a field to `null` if that were ever valid. More importantly, it incorrectly treats "field not sent" the same as "field sent as null".

**Task:** Change the PATCH endpoint to use `model_dump(exclude_unset=True)` and write a test verifying that sending only `{"role": "nurse"}` updates `role` without touching `full_name` or `is_active`.

<details>
<summary>Solution</summary>

```python
# admin/router.py
@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    data: UserUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> User:
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # exclude_unset=True: only fields explicitly sent in the request body
    changes = data.model_dump(exclude_unset=True)  # ← changed from exclude_none

    for field, value in changes.items():
        setattr(user, field, value)

    if changes:
        user.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(user)
        logger.info("User updated", extra={"user_id": user_id, "changes": changes})

    return user
```

```python
# tests/test_admin.py
async def test_patch_role_only(client: AsyncClient):
    # Setup: create admin + target user
    admin_token = await register_and_login(client, ADMIN_DATA)
    await client.post("/api/v1/auth/register", json=DOCTOR_DATA)
    users_resp = await client.get(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    doctor = next(u for u in users_resp.json()["items"] if u["role"] == "doctor")

    # Patch only role
    patch_resp = await client.patch(
        f"/api/v1/admin/users/{doctor['id']}",
        json={"role": "nurse"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert patch_resp.status_code == 200
    updated = patch_resp.json()
    assert updated["role"] == "nurse"
    assert updated["full_name"] == doctor["full_name"]   # unchanged
    assert updated["is_active"] == doctor["is_active"]   # unchanged
```

</details>

---

## Exercise 9 — Parallel Embedding with `asyncio.TaskGroup`

**Problem:** `rag/service.py:index_document` embeds chunks sequentially in a `for` loop. For a 20-chunk document, this makes 20 sequential API calls (~600ms total if each takes 30ms).

**Task:** Replace the sequential embedding loop with `asyncio.TaskGroup` to embed all chunks concurrently. Cap concurrency at 5 simultaneous requests using `asyncio.Semaphore`.

<details>
<summary>Solution</summary>

```python
# rag/service.py
import asyncio

async def index_document(
    self, filename: str, content: str, uploader_id: str
) -> dict:
    doc_id = str(uuid.uuid4())
    chunks = self._chunk_text(content)

    # Semaphore limits concurrent Anthropic API calls
    semaphore = asyncio.Semaphore(5)

    async def embed_with_limit(chunk: str) -> list[float]:
        async with semaphore:
            return await self._get_embedding(chunk)

    # Python 3.11+ — TaskGroup for structured concurrency
    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(embed_with_limit(chunk)) for chunk in chunks]

    embeddings = [task.result() for task in tasks]

    self.collection.add(
        ids=[f"{doc_id}_chunk_{i}" for i in range(len(chunks))],
        embeddings=embeddings,
        documents=chunks,
        metadatas=[
            {
                "filename": filename,
                "doc_id": doc_id,
                "chunk_index": i,
                "uploader_id": uploader_id,
            }
            for i in range(len(chunks))
        ],
    )
    return {"doc_id": doc_id, "filename": filename, "chunks_created": len(chunks)}
```

**Python 3.9/3.10 version (using `gather`):**
```python
embeddings = await asyncio.gather(
    *[embed_with_limit(chunk) for chunk in chunks]
)
```

**Performance gain:** 20 chunks × 30ms each = 600ms sequential vs ~120ms with 5 concurrent (ceil(20/5) × 30ms).

</details>

---

## Exercise 10 — Add Catch-All Exception Handler with Structured Logging

**Problem:** Unhandled exceptions in MediAssist return `{"detail": "Internal Server Error"}` with no logging. Incidents are invisible until a user complains.

**Task:** Add an `@app.exception_handler(Exception)` handler to `main.py` that: logs the full traceback with structured fields (path, method, user agent), returns a generic 500 JSON response, and does NOT expose internal error details to the client.

<details>
<summary>Solution</summary>

```python
# main.py — add after app initialization

import traceback
from fastapi import Request
from fastapi.responses import JSONResponse

logger = get_logger(__name__)

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # Build structured context for the log
    tb = traceback.format_exc()

    logger.error(
        "Unhandled exception",
        exc_info=exc,
        extra={
            "event": "unhandled_exception",
            "exception_type": type(exc).__name__,
            "exception_message": str(exc),
            "path": str(request.url.path),
            "method": request.method,
            "query_params": str(request.query_params),
            "user_agent": request.headers.get("user-agent", ""),
            "traceback": tb,
        },
    )

    # Never expose internal error details to the client
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An internal server error occurred. Please try again later.",
        },
    )


# Also add HTTPException handler for consistent error format
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(
        "Request validation error",
        extra={
            "event": "validation_error",
            "path": str(request.url.path),
            "errors": exc.errors(),
        },
    )
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )
```

**Test this handler:**
```python
# tests/test_error_handling.py
async def test_unhandled_exception_returns_500(client: AsyncClient, monkeypatch):
    # Inject a fault into the health endpoint
    from main import app
    original_health = app.routes  # find and monkeypatch

    # Easier: add a test-only route that raises
    @app.get("/test/crash")
    async def crash():
        raise RuntimeError("Intentional crash for testing")

    response = await client.get("/test/crash")
    assert response.status_code == 500
    assert "internal server error" in response.json()["detail"].lower()
    # Verify internal details are NOT exposed
    assert "RuntimeError" not in response.json()["detail"]
    assert "Intentional crash" not in response.json()["detail"]
```

**Why not log the traceback in the response?** Security: stack traces reveal internal paths, library versions, and code structure — all useful to attackers. Log it server-side where only your team can see it.

</details>

---

*End of course. You now have a complete reference for the MediAssist backend stack.*
