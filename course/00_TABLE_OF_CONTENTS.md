# MediAssist — Senior Python & FastAPI Course
## Master Table of Contents

> **Audience:** Ahmed Adel — Senior Mobile Engineer (Flutter / Swift / React Native).  
> Every section maps Python onto Dart/Flutter analogues. No syntax lectures. Deep *why*.  
> Codebase: `backend/` — FastAPI + SQLAlchemy 2.0 + ChromaDB + Gemini + Anthropic.

---

## How This Course Is Organized

Each Part is a standalone Markdown file. Read in order for the full picture, or jump to any section by anchor link below.

| File | Parts Covered | Sections |
|------|--------------|----------|
| [PYTHON_FASTAPI_SENIOR_COURSE.md](PYTHON_FASTAPI_SENIOR_COURSE.md) | Part I + Part II | §1–§13 |
| [Part_III_FastAPI_Deep_Dive.md](Part_III_FastAPI_Deep_Dive.md) | Part III | §14–§26 |
| [Part_IV_Data_Layer.md](Part_IV_Data_Layer.md) | Part IV | §27–§30 |
| [Part_V_AI_Layer.md](Part_V_AI_Layer.md) | Part V | §31–§35 |
| [Part_VI_VII_VIII_Observability_Testing_Production.md](Part_VI_VII_VIII_Observability_Testing_Production.md) | Parts VI–VIII | §36–§44 |
| [Part_IX_X_Walkthrough_Playbook.md](Part_IX_X_Walkthrough_Playbook.md) | Parts IX–X | §45–§49 |
| [Part_XI_Dependency_Deep_Dives.md](Part_XI_Dependency_Deep_Dives.md) | Part XI | All 18 packages |
| [Part_XII_Exercises.md](Part_XII_Exercises.md) | Part XII | 10 exercises + solutions |

---

## Full Section Index

### Part I — Python Foundations for a Dart/TS Senior
> File: [PYTHON_FASTAPI_SENIOR_COURSE.md](../PYTHON_FASTAPI_SENIOR_COURSE.md)

- [§1 Python's Execution Model](../PYTHON_FASTAPI_SENIOR_COURSE.md#1-pythons-execution-model) — CPython, GIL, bytecode, reference counting. Dart VM comparison.
- [§2 The Type System](../PYTHON_FASTAPI_SENIOR_COURSE.md#2-the-type-system) — `Optional`, `Union`, `Literal`, `TypeVar`, `Protocol`, `Annotated`. Runtime vs static.
- [§3 Variables, Scope, and Name Binding](../PYTHON_FASTAPI_SENIOR_COURSE.md#3-variables-scope-and-name-binding) — LEGB, mutable default arg bug, `nonlocal`/`global`.
- [§4 Data Model Deep Dive](../PYTHON_FASTAPI_SENIOR_COURSE.md#4-data-model-deep-dive) — Dunder methods, descriptors, `__slots__`. How SQLAlchemy ORM works under the hood.
- [§5 Functions as First-Class Citizens](../PYTHON_FASTAPI_SENIOR_COURSE.md#5-functions-as-first-class-citizens) — Decorators, closures, `functools.wraps`, `lru_cache`. FastAPI route registration.
- [§6 Context Managers](../PYTHON_FASTAPI_SENIOR_COURSE.md#6-context-managers) — `with`/`async with`, `asynccontextmanager`. FastAPI `lifespan` explained.
- [§7 Iterators, Generators, Async Generators](../PYTHON_FASTAPI_SENIOR_COURSE.md#7-iterators-generators-async-generators) — `yield`, `async for`, `AsyncGenerator`. Maps to Dart `Stream<T>`.
- [§8 Error Handling](../PYTHON_FASTAPI_SENIOR_COURSE.md#8-error-handling) — Exception hierarchy, `raise ... from`, `HTTPException` vs domain errors.

### Part II — Async Python (The Part That Matters Most)
> File: [PYTHON_FASTAPI_SENIOR_COURSE.md](../PYTHON_FASTAPI_SENIOR_COURSE.md)

- [§9 Sync vs Async Mental Model](../PYTHON_FASTAPI_SENIOR_COURSE.md#9-sync-vs-async-mental-model) — Dart event loop vs asyncio. Cooperative multitasking explained.
- [§10 The Event Loop](../PYTHON_FASTAPI_SENIOR_COURSE.md#10-the-event-loop) — Coroutines, Tasks, Futures. `asyncio.gather`, `TaskGroup`. How Uvicorn runs the loop.
- [§11 async def vs def in FastAPI](../PYTHON_FASTAPI_SENIOR_COURSE.md#11-async-def-vs-def-in-fastapi) — Threadpool for sync endpoints, the #1 beginner mistake (blocking the loop).
- [§12 Structured Concurrency](../PYTHON_FASTAPI_SENIOR_COURSE.md#12-structured-concurrency) — Cancellation, `asyncio.timeout`. Missing timeout on Gemini calls.
- [§13 Async I/O in Practice](../PYTHON_FASTAPI_SENIOR_COURSE.md#13-async-io-in-practice) — `httpx.AsyncClient`, `aiosqlite`, streaming LLM responses.

### Part III — FastAPI Deep Dive
> File: [Part_III_FastAPI_Deep_Dive.md](Part_III_FastAPI_Deep_Dive.md)

- [§14 ASGI vs WSGI](Part_III_FastAPI_Deep_Dive.md#14-asgi-vs-wsgi) — Why FastAPI needs Uvicorn, what `uvicorn[standard]` adds (uvloop, httptools).
- [§15 Request Lifecycle](Part_III_FastAPI_Deep_Dive.md#15-request-lifecycle) — Full sequence diagram: middleware → auth dep → endpoint → SSE response.
- [§16 Routing & Path Operations](Part_III_FastAPI_Deep_Dive.md#16-routing--path-operations) — `APIRouter`, `response_model`, status codes.
- [§17 Pydantic v2 in FastAPI](Part_III_FastAPI_Deep_Dive.md#17-pydantic-v2-in-fastapi) — `BaseModel`, validators, `ConfigDict`, v1→v2 migration table.
- [§18 Dependency Injection](Part_III_FastAPI_Deep_Dive.md#18-dependency-injection) — `Depends`, yield deps, full dep chain for `/agent/chat/stream`. Dart `GetIt` comparison.
- [§19 Pydantic Settings](Part_III_FastAPI_Deep_Dive.md#19-pydantic-settings) — `pydantic-settings`, `.env` loading, resolution order, `cors_origins` design flaw.
- [§20 Request Parsing & File Uploads](Part_III_FastAPI_Deep_Dive.md#20-request-parsing--file-uploads) — `python-multipart`, `UploadFile`, streaming large files.
- [§21 Authentication & Security](Part_III_FastAPI_Deep_Dive.md#21-authentication--security) — OAuth2 flow, JWT internals, bcrypt work factor, `HTTPBearer`. Critical gotchas.
- [§22 Background Tasks](Part_III_FastAPI_Deep_Dive.md#22-background-tasks) — `BackgroundTasks` vs Celery/ARQ comparison table.
- [§23 WebSockets & Streaming](Part_III_FastAPI_Deep_Dive.md#23-websockets--streaming) — `StreamingResponse`, SSE wire format, `LoggingMiddleware` SSE detection.
- [§24 Lifespan Events](Part_III_FastAPI_Deep_Dive.md#24-lifespan-events) — `main.py` lifespan, production-grade cleanup pattern.
- [§25 Exception Handlers](Part_III_FastAPI_Deep_Dive.md#25-exception-handlers) — `@app.exception_handler`, catch-all 500 handler (currently missing).
- [§26 OpenAPI & Docs](Part_III_FastAPI_Deep_Dive.md#26-openapi--docs) — Auto-schema, disabling docs in prod.

### Part IV — Data Layer
> File: [Part_IV_Data_Layer.md](Part_IV_Data_Layer.md)

- [§27 SQLAlchemy 2.0 Async](Part_IV_Data_Layer.md#27-sqlalchemy-20-async) — `select()`, `Mapped[]`, `DeclarativeBase`, async engine/session. 1.x vs 2.0 syntax table.
- [§28 aiosqlite](Part_IV_Data_Layer.md#28-aiosqlite) — Why it's the async SQLite driver, connection pool caveats, WAL mode.
- [§29 Session Management Patterns](Part_IV_Data_Layer.md#29-session-management-patterns) — `get_db` yield dependency, `expire_on_commit=False`, transaction lifecycle.
- [§30 Migrations — The Missing Alembic](Part_IV_Data_Layer.md#30-migrations--the-missing-alembic) — Why schema migrations aren't here, exact steps to add Alembic, async migration config.

### Part V — The AI Layer
> File: [Part_V_AI_Layer.md](Part_V_AI_Layer.md)

- [§31 Anthropic SDK](Part_V_AI_Layer.md#31-anthropic-sdk) — `AsyncAnthropic`, Voyage embeddings (`voyage-medical-2`), streaming, rate limits, retries.
- [§32 Google Generative AI SDK](Part_V_AI_Layer.md#32-google-generative-ai-sdk) — `GenerativeModel`, Gemini 2.5 Flash, `FunctionDeclaration`, agentic loop, tool use.
- [§33 ChromaDB](Part_V_AI_Layer.md#33-chromadb) — Vector store fundamentals, HNSW indexing, cosine vs L2, `PersistentClient`, metadata filtering.
- [§34 RAG Pipeline End-to-End](Part_V_AI_Layer.md#34-rag-pipeline-end-to-end) — Full traced flow: `pypdf` → chunking → embedding → Chroma → retrieval → Gemini generation. Mermaid diagram.
- [§35 pypdf](Part_V_AI_Layer.md#35-pypdf) — Extraction quirks, text vs layout, when to preprocess.

### Part VI — Observability
> File: [Part_VI_VII_VIII_Observability_Testing_Production.md](Part_VI_VII_VIII_Observability_Testing_Production.md)

- [§36 OpenTelemetry](Part_VI_VII_VIII_Observability_Testing_Production.md#36-opentelemetry) — Traces, spans, `BatchSpanProcessor`, OTLP gRPC exporter, `telemetry/setup.py` walkthrough.
- [§37 Structured Logging](Part_VI_VII_VIII_Observability_Testing_Production.md#37-structured-logging) — `_PrettyFormatter` + `_JsonFormatter`, log levels, silencing noisy libraries, trace correlation.

### Part VII — Testing
> File: [Part_VI_VII_VIII_Observability_Testing_Production.md](Part_VI_VII_VIII_Observability_Testing_Production.md)

- [§38 Pytest Foundations](Part_VI_VII_VIII_Observability_Testing_Production.md#38-pytest-foundations) — Fixtures, `conftest.py`, `pytest-asyncio`, `asyncio_mode`, parametrize, markers.
- [§39 Testing FastAPI](Part_VI_VII_VIII_Observability_Testing_Production.md#39-testing-fastapi) — `AsyncClient` + `ASGITransport`, DI overrides, `pytest-httpx` for mocking Anthropic/Gemini.
- [§40 Test DB Strategy](Part_VI_VII_VIII_Observability_Testing_Production.md#40-test-db-strategy) — In-memory SQLite per test, fixture-scoped engine, `Base.metadata.create_all`.

### Part VIII — Production Concerns
> File: [Part_VI_VII_VIII_Observability_Testing_Production.md](Part_VI_VII_VIII_Observability_Testing_Production.md)

- [§41 Uvicorn in Production](Part_VI_VII_VIII_Observability_Testing_Production.md#41-uvicorn-in-production) — Workers, `--loop uvloop`, `--http httptools`, Gunicorn+Uvicorn workers.
- [§42 Concurrency Model Recap](Part_VI_VII_VIII_Observability_Testing_Production.md#42-concurrency-model-recap) — Async + threadpool + processes. When each layer is needed.
- [§43 Security Checklist](Part_VI_VII_VIII_Observability_Testing_Production.md#43-security-checklist) — CORS, JWT rotation, bcrypt cost, input validation, secrets management.
- [§44 Performance Gotchas](Part_VI_VII_VIII_Observability_Testing_Production.md#44-performance-gotchas) — N+1 queries, blocking in async, Pydantic serialization overhead, connection pool sizing.

### Part IX — Codebase Walkthrough
> File: [Part_IX_X_Walkthrough_Playbook.md](Part_IX_X_Walkthrough_Playbook.md)

- [§45 File-by-File Tour with Dependency Graph](Part_IX_X_Walkthrough_Playbook.md#45-file-by-file-tour-with-dependency-graph) — Every module, its purpose, key functions, Mermaid dependency graph.
- [§46 End-to-End Request Traces](Part_IX_X_Walkthrough_Playbook.md#46-end-to-end-request-traces) — Two traces: document upload flow + `/agent/chat/stream` SSE flow.

### Part X — Senior Playbook
> File: [Part_IX_X_Walkthrough_Playbook.md](Part_IX_X_Walkthrough_Playbook.md)

- [§47 Design Patterns in This Codebase](Part_IX_X_Walkthrough_Playbook.md#47-design-patterns-in-this-codebase) — Repository, DI, PolicyEngine (RBAC+ABAC+ReBAC), Strategy for LLM providers.
- [§48 Honest Refactor Critique](Part_IX_X_Walkthrough_Playbook.md#48-honest-refactor-critique) — Specific improvement suggestions with before/after code.
- [§49 Senior Code Review Checklist](Part_IX_X_Walkthrough_Playbook.md#49-senior-code-review-checklist) — What to catch in PRs on this codebase.

### Part XI — Dependency Deep Dives
> File: [Part_XI_Dependency_Deep_Dives.md](Part_XI_Dependency_Deep_Dives.md)

| Package | Why chosen | Key gotcha |
|---------|-----------|-----------|
| `fastapi==0.115.0` | ASGI, automatic OpenAPI, Pydantic v2 native | Middleware order is reversed |
| `uvicorn[standard]==0.32.0` | ASGI server with uvloop + httptools | uvloop unavailable on Windows |
| `pydantic==2.9.2` | Rust core, v2 validators, Annotated support | `.dict()` → `.model_dump()` |
| `pydantic-settings==2.5.2` | 12-factor config, .env support | Module-level `Settings()` fails on missing vars |
| `email-validator==2.2.0` | Required for Pydantic email validation | Must be installed separately |
| `sqlalchemy==2.0.36` | Typed `Mapped[]`, async session, 2.0 style | 1.x syntax still works but deprecated |
| `aiosqlite==0.20.0` | Async SQLite driver | Single-writer limitation, no pool |
| `python-jose[cryptography]==3.3.0` | JWT encode/decode | `algorithms=[]` list required (security) |
| `bcrypt>=4.0.1` | Password hashing | Incompatible with passlib 1.7.x |
| `python-multipart==0.0.12` | Multipart form/file parsing | FastAPI won't parse files without it |
| `anthropic==0.39.0` | Official Anthropic SDK, async client, Voyage embeddings | Pseudo-random embeddings in test mode |
| `google-generativeai==0.8.3` | Gemini SDK, function calling / tool use | `role: "model"` not `"assistant"` |
| `chromadb==0.5.20` | Embedded vector DB, HNSW, cosine similarity | Persistent client not thread-safe across processes |
| `opentelemetry-sdk==1.28.1` | Traces, spans, exporters | Gated by `otel_enabled=False` default |
| `opentelemetry-instrumentation-fastapi==0.49b1` | Auto-instrumentation for routes | Beta — API may change |
| `httpx==0.27.2` | Async HTTP client, used in tests | Shared client > per-request client |
| `pytest==8.3.3` | Test framework | `asyncio_mode` must be set for async tests |
| `pytest-asyncio==0.24.0` | Async fixture + test support | Breaking change in 0.21: explicit mode required |
| `pytest-httpx==0.32.0` | Mock httpx calls in tests | Version must match httpx version |
| `pypdf==4.3.1` | PDF text extraction | Layout-dependent extraction, preprocess needed |

### Part XII — 10 Mastery Exercises
> File: [Part_XII_Exercises.md](Part_XII_Exercises.md)

1. Fix the bcrypt blocking call in an async endpoint
2. Implement a proper `asyncio.timeout` wrapper for Gemini calls
3. Refactor `PolicyEngine` to raise domain exceptions instead of `HTTPException`
4. Add Alembic to the project and write the first migration
5. Implement true Gemini streaming (not word-split simulation)
6. Add a `pytest-httpx` mock test for the Anthropic embedding call
7. Convert `cors_origins` setting from `str` to `list[str]`
8. Implement `exclude_unset=True` for the PATCH `/admin/users/{id}` endpoint
9. Add `asyncio.TaskGroup` parallel embedding for multi-chunk document indexing
10. Write an `@app.exception_handler(Exception)` catch-all with structured logging

---

*Course generated from actual codebase at `backend/`. All code examples reference real files and line numbers.*
