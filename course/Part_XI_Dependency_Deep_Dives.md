# Part XI — Dependency Deep Dives

Every package in `requirements.txt` — identity, why chosen, codebase usage, pitfalls, senior tip.

---

## `fastapi==0.115.0`

**What it is:** ASGI web framework built on Starlette and Pydantic. Generates OpenAPI schemas automatically from type hints.

**Why chosen over alternatives:**

| | FastAPI | Django REST | Flask |
|--|---------|-------------|-------|
| Async | Native | Limited (3.1+) | No |
| Auto OpenAPI | Yes | Via drf-spectacular | Via flasgger |
| Pydantic integration | Native v2 | No | No |
| Performance | High | Medium | Medium |
| Type hints | First-class | Partial | No |

**Usage in codebase:** Every router file, `main.py`, dependency functions, middleware.

**Pitfalls:**
- Middleware registration is reversed (last added = outermost). See `main.py`.
- `response_model` runs Pydantic validation on every response — CPU cost on large payloads.
- `Depends()` takes a callable reference, not the result. `Depends(get_db())` is wrong.

> **💡 Senior Tip:** FastAPI 0.100+ requires Pydantic v2. If a third-party library still uses Pydantic v1 internally, you'll get `PydanticUserError` on startup. Check compatibility with `pip show pydantic` — both v1 and v2 can coexist via `pydantic.v1` compatibility shim.

---

## `uvicorn[standard]==0.32.0`

**What it is:** Production-grade ASGI server. `[standard]` extra installs `uvloop`, `httptools`, and `websockets`.

**Why chosen:** The de facto ASGI server for FastAPI. `uvloop` replaces `asyncio`'s pure-Python event loop with a C implementation based on libuv (same engine as Node.js).

**Usage in codebase:** Runs the app. Started with `uvicorn backend.main:app`.

**Pitfalls:**
- `uvloop` not available on Windows — no-op on dev machines, active in Linux prod.
- `--reload` in development uses file watchers that eat CPU on large directories. Add `--reload-dir backend` to limit scope.
- Single worker by default — use Gunicorn+UvicornWorker in prod for multi-core utilization.

> **💡 Senior Tip:** `uvicorn.workers.UvicornWorker` is the bridge between Gunicorn's process management and Uvicorn's async event loop. Each worker is a full Uvicorn instance — independent event loop, independent connection pool, independent ChromaDB file lock (the problem).

---

## `pydantic==2.9.2`

**What it is:** Data validation library with a Rust core (`pydantic-core`). Validates Python types at runtime, serializes to/from JSON/dict.

**Why chosen over alternatives:**

| | Pydantic v2 | attrs | dataclasses | marshmallow |
|--|-------------|-------|-------------|-------------|
| Validation | Yes | Plugin | No | Yes |
| Performance | Rust core | Fast | Fast | Python |
| FastAPI integration | Native | No | Limited | No |
| JSON schema | Auto | No | No | Yes |

**Usage in codebase:** `auth/models.py` (UserRegister, UserResponse, etc.), `agents/router.py` (ChatRequest), `rag/router.py` (QueryRequest).

**Pitfalls:**
- v1 → v2 migration: `.dict()` → `.model_dump()`, `@validator` → `@field_validator`, `orm_mode` → `from_attributes`.
- `model_dump(exclude_none=True)` vs `exclude_unset=True` — different semantics for PATCH.
- Pydantic v2 is strict about types: `"123"` won't coerce to `int` by default in strict mode.

> **💡 Senior Tip:** Pydantic v2's `model_json_schema()` generates JSON Schema Draft 7. If you're building an API client SDK from the OpenAPI spec, this schema drives the generated types. Make sure your Pydantic models have good `description=` in `Field()` — they appear in the generated SDK docs.

---

## `pydantic-settings==2.5.2`

**What it is:** Extension to Pydantic for reading settings from environment variables and `.env` files. Separate package from core Pydantic since v2.

**Why chosen:** Integrates with Pydantic's type system — env var `ACCESS_TOKEN_EXPIRE_MINUTES=30` is automatically cast to `int`. Supports nested settings, secrets, and custom sources.

**Usage in codebase:** `config.py` — the `Settings` class with `SettingsConfigDict(env_file=".env")`.

**Pitfalls:**
- `Settings()` at module level runs at import time — if required vars are missing, `ImportError`-like behavior on first import. `tests/conftest.py` sets env vars before importing app to avoid this.
- Environment variable names are uppercased automatically: `database_url` field reads from `DATABASE_URL` env var.
- `.env` file is **not** loaded in tests unless you set `env_file` and the file exists. `conftest.py` uses `os.environ` directly instead.

> **💡 Senior Tip:** For secrets (API keys, database passwords), use `SecretStr` type: `anthropic_api_key: SecretStr`. It masks the value in logs/repr: `SecretStr('**********')`. Access the actual value with `.get_secret_value()`. This prevents accidental credential logging.

---

## `email-validator==2.2.0`

**What it is:** RFC-compliant email address validation library. Required by Pydantic to validate `EmailStr` type.

**Why chosen:** Pydantic's `EmailStr` type is a string that validates as a proper email. Without this package installed, using `EmailStr` in a model raises `ImportError: email-validator is not installed`.

**Usage in codebase:** `auth/models.py:UserRegister` uses `email: str` with Pydantic's built-in email validation via the `email-validator` annotation when `EmailStr` is used. The current code uses plain `str` with `email-validator` providing the underlying validation capability.

**Pitfalls:** None significant. Keep it installed alongside Pydantic.

> **💡 Senior Tip:** `EmailStr` normalizes email to lowercase. `"Ahmed@Example.COM"` is stored as `"ahmed@example.com"`. If you have existing users stored with mixed case, this can cause login failures after upgrading. Always `lower()` emails before storage and lookup.

---

## `sqlalchemy==2.0.36`

**What it is:** Python's dominant SQL toolkit and ORM. Version 2.0 introduced async-first design, type-annotated columns, and a new query API.

**Why chosen over alternatives:**

| | SQLAlchemy 2.0 | Tortoise ORM | SQLModel | Prisma Python |
|--|----------------|--------------|----------|---------------|
| Async | Yes | Yes | Yes (via SA) | Yes |
| Pydantic v2 | Yes | No | Partial | No |
| Maturity | 15+ years | 4 years | 3 years | 2 years |
| Migrations | Alembic (mature) | Aerich | Alembic | Prisma |
| Raw SQL | Yes | Limited | Yes (via SA) | Yes |

**Usage in codebase:** `database.py` (engine, session, `init_db`), `auth/models.py` (`User` ORM model), all router files that use `AsyncSession`.

**Pitfalls:**
- 1.x and 2.0 syntax can coexist silently — always use 2.0 style (`select()`, `Mapped[]`).
- `expire_on_commit=False` is mandatory with async sessions (see §27).
- `session.execute()` returns a `CursorResult`, not a list — must call `.scalars().all()` or `.scalar_one_or_none()`.

> **💡 Senior Tip:** SQLAlchemy 2.0 can emit "implicit coercion" warnings when you accidentally use 1.x patterns. Run with `PYTHONWARNINGS=error::DeprecationWarning` in CI to catch these early — they become errors in future SQLAlchemy versions.

---

## `aiosqlite==0.20.0`

**What it is:** Async wrapper for Python's `sqlite3`. Runs SQLite operations in a background thread while exposing an `async/await` API.

**Why chosen:** SQLAlchemy's `create_async_engine` with `sqlite+aiosqlite://` URL needs this driver. It's the only async SQLite driver for SQLAlchemy.

**Usage in codebase:** Implicit — `settings.database_url = "sqlite+aiosqlite:///./mediassist.db"` in `config.py`.

**Pitfalls:**
- SQLite is single-writer. Multiple concurrent write transactions serialize (not parallel).
- No connection pool in the traditional sense — SQLite connections are cheap but the DB file itself is the bottleneck.
- `check_same_thread=False` must be passed to allow async usage: `create_async_engine(url, connect_args={"check_same_thread": False})`. SQLAlchemy's aiosqlite dialect sets this automatically.

> **💡 Senior Tip:** Enable WAL mode in production SQLite for better read concurrency: `PRAGMA journal_mode=WAL`. Add this via SQLAlchemy's `event.listens_for(engine.sync_engine, "connect")` hook. Without WAL, a write blocks all concurrent reads.

---

## `python-jose[cryptography]==3.3.0`

**What it is:** JWT encode/decode library. `[cryptography]` extra enables RS256 (asymmetric signing) in addition to the default HS256.

**Why chosen over `PyJWT`:**

| | python-jose | PyJWT |
|--|-------------|-------|
| Algorithms | HS256, RS256, ES256+ | Same |
| JWE (encrypted tokens) | Yes | No |
| API style | `jwt.encode/decode` | `jwt.encode/decode` |
| Maintenance | Less active | More active |
| FastAPI docs recommendation | Yes (historically) | Yes (now equally) |

**Usage in codebase:** `auth/service.py` — `create_access_token`, `create_refresh_token`, `decode_token`.

**Pitfalls:**
- `algorithms=["HS256"]` must be a **list**. If passed as a string `"HS256"`, jose may accept tokens with `"none"` algorithm — critical security vulnerability.
- `jose.jwt.decode` raises `jose.JWTError` for invalid tokens, expired tokens, and signature failures. The current `except Exception` catches all of these but also masks bugs.
- `python-jose` is less actively maintained than `PyJWT`. Consider migrating to `PyJWT>=2.8` for new projects.

> **💡 Senior Tip:** To rotate secrets without immediately invalidating all tokens, implement multi-secret verification: try decoding with the new secret, fall back to the old secret. This gives users a grace period to receive a new token during secret rotation.

---

## `bcrypt>=4.0.1`

**What it is:** The bcrypt password hashing algorithm, a Python binding to the OpenBSD bcrypt implementation.

**Why chosen over alternatives:**

| | bcrypt | argon2-cffi | scrypt |
|--|--------|-------------|--------|
| Algorithm | bcrypt | Argon2id | scrypt |
| Memory-hardness | No | Yes | Yes |
| GPU resistance | Good | Better | Good |
| Industry support | Ubiquitous | Growing | Moderate |
| Work factor tunable | Yes (rounds) | Yes (m,t,p) | Yes |

Argon2id is technically superior (winner of Password Hashing Competition 2015). bcrypt is chosen here for ubiquity and library maturity. For new systems, consider `argon2-cffi`.

**Usage in codebase:** `auth/service.py:hash_password`, `verify_password`.

**Pitfalls:**
- bcrypt 4.0+ removed `__about__` attribute — incompatible with `passlib 1.7.x`. Use `bcrypt` directly, not via passlib.
- bcrypt limits passwords to 72 bytes. Passwords longer than 72 chars are silently truncated — `bcrypt.hashpw("A"*100, ...)` and `bcrypt.hashpw("A"*73, ...)` produce different hashes, but `bcrypt.hashpw("A"*73, ...)` and `bcrypt.hashpw("A"*72 + "B", ...)` produce the SAME hash. Mitigate: SHA-256 hash the password before bcrypt if you allow very long passwords.
- Default `gensalt()` uses rounds=12 (~100ms). At rounds=14 (~400ms), brute force becomes impractical even with modern GPUs.

> **💡 Senior Tip:** The `bcrypt.gensalt()` work factor should be tuned to take ~250ms on your production hardware. Run a benchmark: `timeit(lambda: bcrypt.hashpw(b"test", bcrypt.gensalt(rounds=N)), number=10)`. Increase rounds annually as hardware improves.

---

## `python-multipart==0.0.12`

**What it is:** Streaming multipart form data and URL-encoded form parser. Required by FastAPI for `File(...)` and `Form(...)` parameters.

**Why chosen:** FastAPI's documentation requires it. It's the only maintained multipart parser compatible with Starlette's async streaming.

**Usage in codebase:** Implicit — required for `UploadFile = File(...)` in `rag/router.py`.

**Pitfalls:**
- Missing installation causes `RuntimeError: Form data requires "python-multipart" to be installed` at request time (not startup time).
- Large file uploads with `await file.read()` load the entire file into memory. Stream with chunked reads for files >10MB.

> **💡 Senior Tip:** Set `max_upload_size` to prevent memory exhaustion from huge uploads: use a middleware that checks `Content-Length` header before reading the body. FastAPI has no built-in limit.

---

## `anthropic==0.39.0`

**What it is:** Official Python SDK for Anthropic's Claude and Voyage APIs. Provides both sync `Anthropic` and async `AsyncAnthropic` clients.

**Why chosen:** Only official SDK for Voyage embedding models (`voyage-medical-2`). Required for domain-specific medical embeddings.

**Usage in codebase:** `rag/service.py` — `AsyncAnthropic` for embedding chunks and queries.

**Pitfalls:**
- Default timeout is 600 seconds — set explicitly: `AsyncAnthropic(timeout=30.0)`.
- `anthropic_api_key.startswith("sk-ant-test")` is the test-mode gate. Any key starting with this string triggers pseudo-random embeddings — ensure your production key doesn't start with this.
- Rate limits return `anthropic.RateLimitError`. The SDK auto-retries but with exponential backoff — under high load, retries can cause request pile-up.

> **💡 Senior Tip:** Voyage embedding dimensions are fixed at 1024 for `voyage-2` and 384 for `voyage-medical-2`. `EMBEDDING_DIMENSIONS = 384` in `rag/service.py` must match the model. If you switch models, you must recreate the ChromaDB collection — existing embeddings are incompatible.

---

## `google-generativeai==0.8.3`

**What it is:** Official Python SDK for Google's Gemini model family. Supports text generation, multimodal input, function calling (tool use), and streaming.

**Why chosen over OpenAI SDK + GPT-4:**
- Gemini 2.5 Flash is fast and cost-effective for function-calling-heavy agentic loops
- Native `protos.FunctionDeclaration` / `FunctionResponse` protocol for tool use
- `system_instruction` parameter for model behavior configuration

**Usage in codebase:** `agents/service.py` — `GenerativeModel`, `TOOL_DECLARATIONS`, agentic loop.

**Pitfalls:**
- Gemini uses `role: "model"` not `role: "assistant"` — `_build_history()` converts this.
- `genai.configure(api_key=...)` sets a module-level global — calling it per request is redundant but harmless.
- `ResourceExhausted` is the quota error — catch `google.api_core.exceptions.ResourceExhausted`, not a string match.
- Tool results must be sent as `protos.Part(function_response=...)`, not plain dicts.

> **💡 Senior Tip:** Gemini's free tier limits are per-minute (RPM) not per-day. A burst of 10 concurrent requests can hit the limit even at low daily volume. Implement a token bucket or semaphore: `asyncio.Semaphore(3)` to limit concurrent Gemini calls.

---

## `chromadb==0.5.20`

**What it is:** Embedded vector database with Python-native API, HNSW indexing, and optional persistence.

**Why chosen over alternatives:**

| | ChromaDB | pgvector | FAISS | Pinecone |
|--|---------|---------|-------|---------|
| Setup | Embedded/server | Postgres extension | Python library | Cloud service |
| Persistence | Yes | Yes | Manual | Yes |
| Metadata filtering | Yes | SQL | No | Yes |
| Production scale | Medium | High | High | Very high |
| Cost | Free | Free (Postgres) | Free | Paid |
| Multi-process | Single (file lock) | Yes | No | Yes |

**Usage in codebase:** `rag/service.py` — `PersistentClient`, `collection.add()`, `collection.query()`.

**Pitfalls:**
- `PersistentClient` acquires a file lock — only one process can open it. Incompatible with multi-worker Gunicorn.
- ChromaDB returns `distances` not `similarities`. For cosine distance, relevance = `1 - distance`.
- Collection `metadata={"hnsw:space": "cosine"}` must be set at creation and cannot be changed later. Changing the distance metric requires deleting and recreating the collection.
- ChromaDB 0.5.x changed the client API from 0.4.x — `Client()` constructor removed, replaced with `PersistentClient()`, `EphemeralClient()`, `HttpClient()`.

> **💡 Senior Tip:** ChromaDB silently creates the collection on first `get_or_create_collection()` with whatever metadata you pass. If the collection already exists with different metadata (e.g., different distance metric), the existing metadata is used. Always verify collection metadata matches your intent: `collection.metadata`.

---

## `opentelemetry-sdk==1.28.1`

**What it is:** The core OpenTelemetry SDK — `TracerProvider`, `BatchSpanProcessor`, `ConsoleSpanExporter`, and the `trace` API.

**Why chosen:** OTel is the CNCF standard — vendor-neutral, works with Jaeger, Tempo, Honeycomb, Datadog, and every other observability platform. Write once, export anywhere.

**Usage in codebase:** `telemetry/setup.py` — `TracerProvider`, `BatchSpanProcessor`, `Resource`.

**Pitfalls:**
- `BatchSpanProcessor` has a queue. On crash, buffered spans are lost. Flush with `trace.get_tracer_provider().force_flush()` before shutdown.
- `ConsoleSpanExporter` prints JSON to stdout — useful for debugging, noisy in production.
- `otel_enabled=False` by default — OTel is completely disabled with zero overhead until explicitly enabled.

> **💡 Senior Tip:** Add trace context to your structured logs (§37). With trace IDs in both logs and traces, you can jump from a log line in Grafana Loki to the corresponding trace in Tempo in one click — this cuts incident MTTR dramatically.

---

## `opentelemetry-instrumentation-fastapi==0.49b1`

**What it is:** Auto-instrumentation for FastAPI — monkey-patches Starlette to create spans for every HTTP request automatically.

**Why chosen:** Zero-code observability — no manual span creation needed for HTTP-level tracing.

**Usage in codebase:** `telemetry/setup.py` — `FastAPIInstrumentor().instrument()`.

**Pitfalls:**
- `0.49b1` is a beta release — API may change in 0.50+.
- `try/except ImportError` in `setup.py` handles the case where the package isn't installed.
- Auto-instrumentation doesn't trace internal business logic (DB queries, LLM calls) — only HTTP request/response boundaries.

> **💡 Senior Tip:** Combine `FastAPIInstrumentor` with `SQLAlchemyInstrumentor` and `httpx` instrumentation to get DB query spans and outbound HTTP spans automatically: `SQLAlchemyInstrumentor().instrument(engine=engine.sync_engine)`.

---

## `httpx==0.27.2`

**What it is:** Modern async HTTP client for Python. Drop-in async replacement for `requests`. Used in tests via `pytest-httpx`.

**Why chosen over `requests`:**

| | `httpx` | `requests` | `aiohttp` |
|--|---------|-----------|-----------|
| Async | Yes (`AsyncClient`) | No | Yes |
| HTTP/2 | Yes | No | No |
| Type hints | Full | Partial | Partial |
| Test mocking | `pytest-httpx` | `responses` | `aioresponses` |
| API similarity to requests | High | — | Low |

**Usage in codebase:** `tests/conftest.py` — `AsyncClient(transport=ASGITransport(app=app))` for test HTTP client.

**Pitfalls:**
- `AsyncClient` should be reused across requests (connection pooling). Creating per-request in production wastes connection setup time.
- `pytest-httpx==0.32.0` must match `httpx==0.27.x` — version mismatch causes `TypeError` in test setup.
- `httpx.AsyncClient()` default timeout is 5 seconds — increase for LLM API calls.

> **💡 Senior Tip:** For production shared client, initialize in lifespan and store on `app.state`: `app.state.http_client = httpx.AsyncClient(timeout=30.0)`. Access in endpoints via `request.app.state.http_client`. Close in lifespan teardown: `await app.state.http_client.aclose()`.

---

## `pytest==8.3.3`

**What it is:** The Python testing framework. Fixture system, parameterization, markers, and plugin ecosystem.

**Why chosen:** Universal standard for Python testing. Plugin ecosystem covers everything needed: `pytest-asyncio` for async, `pytest-httpx` for HTTP mocking, `pytest-cov` for coverage.

**Usage in codebase:** `tests/test_auth.py`, `tests/test_rag.py`, `tests/conftest.py`. Configuration in `pytest.ini`.

**Pitfalls:**
- `pytest.ini` must set `asyncio_mode = auto` for async tests to work with `pytest-asyncio>=0.21`.
- Fixtures must be explicitly imported or in `conftest.py` — pytest doesn't auto-discover fixtures from arbitrary files.
- `@pytest.mark.parametrize` with async fixtures requires `pytest-asyncio` aware parametrize patterns.

> **💡 Senior Tip:** Use `pytest -x` (stop on first failure) during development, `pytest --tb=short` for CI output. Add `addopts = -x --tb=short` to `pytest.ini` for consistent behavior.

---

## `pytest-asyncio==0.24.0`

**What it is:** pytest plugin enabling `async def` test functions and async fixtures.

**Why chosen:** Required for testing FastAPI's async endpoints with `AsyncClient`.

**Usage in codebase:** `tests/conftest.py` — `@pytest_asyncio.fixture` decorator. `pytest.ini` — `asyncio_mode = auto`.

**Pitfalls:**
- `asyncio_mode = auto` (in `pytest.ini`) makes all async tests/fixtures async-aware without explicit marks.
- `asyncio_mode = strict` (new default in 0.21+) requires `@pytest.mark.asyncio` on every async test.
- Fixture scope with async: `scope="session"` fixtures share one event loop; `scope="function"` creates a new loop per test.

> **💡 Senior Tip:** `@pytest_asyncio.fixture` (from `pytest_asyncio` package) is the correct decorator for async fixtures. Plain `@pytest.fixture` works in `asyncio_mode = auto` but emits a deprecation warning. Use `@pytest_asyncio.fixture` explicitly to be unambiguous.

---

## `pytest-httpx==0.32.0`

**What it is:** pytest plugin that intercepts `httpx.AsyncClient` requests and allows you to return mock responses — essential for testing code that calls external APIs.

**Why chosen:** Your codebase calls Anthropic and Gemini APIs. Tests must not hit real APIs (cost, reliability, determinism). `pytest-httpx` intercepts at the `httpx` transport layer.

**Usage in codebase:** Available in test suite. Currently the embedding test-mode gate (`sk-ant-test` prefix) bypasses the API call entirely, so `pytest-httpx` isn't used in existing tests — but it's in `requirements.txt` for future use.

**Pitfalls:**
- Must match `httpx` version: `pytest-httpx==0.32.0` requires `httpx~=0.27`.
- Unmatched requests (real calls not mocked) raise `httpx.ConnectError` by default in test mode — catches accidental real API calls.
- `httpx_mock.add_response()` matches by URL. If URL has query params, match precisely or use `url=re.compile(...)`.

> **💡 Senior Tip:** `httpx_mock` fixture is function-scoped by default — mocks are reset after each test. For shared mocks, use `@pytest.fixture(scope="module")` and pass the mock fixture. This keeps tests independent while avoiding repetition.

---

## `pypdf==4.3.1`

**What it is:** Pure-Python PDF parser. Extracts text, metadata, images, and annotations from PDF files.

**Why chosen over alternatives:**
- `pypdf` is lightweight, no system dependencies (no Ghostscript, no Poppler)
- Works on any platform including Docker
- For more complex PDFs: `pdfplumber` (better tables), `pymupdf` (MuPDF binding, handles scanned)

**Usage in codebase:** In `requirements.txt` but not yet imported. Planned for PDF document ingestion.

**Pitfalls:**
- Returns empty string for scanned (image-only) PDFs — needs OCR for those.
- Multi-column PDFs produce garbled text — reading order doesn't match visual order.
- `extraction_mode="layout"` (pypdf 4.x) improves multi-column handling.

> **💡 Senior Tip:** Always check `len(extracted_text.strip()) < 100` after extraction. If too short for a multi-page document, the PDF is likely scanned. Log a warning and inform the uploader that OCR processing would be needed.
