# MediAssist AI — Complete Study Guide

A deep-dive reference for understanding every part of this application: what was built, why each decision was made, and how all the pieces connect.

---

## Table of Contents

1. [Big Picture: What Is This System?](#1-big-picture)
2. [Repository Layout](#2-repository-layout)
3. [Backend Deep Dive](#3-backend-deep-dive)
   - 3.1 [Config & Settings](#31-config--settings)
   - 3.2 [Database Layer](#32-database-layer)
   - 3.3 [Authentication](#33-authentication)
   - 3.4 [Authorization](#34-authorization)
   - 3.5 [RAG Pipeline](#35-rag-pipeline)
   - 3.6 [AI Agent](#36-ai-agent)
   - 3.7 [Admin API](#37-admin-api)
   - 3.8 [Telemetry](#38-telemetry)
   - 3.9 [main.py — wiring it all together](#39-mainpy)
4. [Frontend Deep Dive](#4-frontend-deep-dive)
   - 4.1 [Next.js App Router](#41-nextjs-app-router)
   - 4.2 [Auth State (Zustand)](#42-auth-state-zustand)
   - 4.3 [API Client](#43-api-client)
   - 4.4 [Streaming Chat Hook](#44-streaming-chat-hook)
   - 4.5 [UI Component Library](#45-ui-component-library)
   - 4.6 [Pages & Routing](#46-pages--routing)
5. [Cross-Cutting Concepts](#5-cross-cutting-concepts)
   - 5.1 [JWT Authentication Flow](#51-jwt-authentication-flow)
   - 5.2 [RAG — Retrieval-Augmented Generation](#52-rag--retrieval-augmented-generation)
   - 5.3 [ReAct Agent Loop](#53-react-agent-loop)
   - 5.4 [SSE Streaming](#54-sse-streaming)
   - 5.5 [RBAC / ABAC / ReBAC](#55-rbac--abac--rebac)
6. [Data Flow Walkthroughs](#6-data-flow-walkthroughs)
   - 6.1 [User registers and logs in](#61-user-registers-and-logs-in)
   - 6.2 [Doctor uploads a protocol document](#62-doctor-uploads-a-protocol-document)
   - 6.3 [Nurse asks the AI a question](#63-nurse-asks-the-ai-a-question)
7. [Testing Strategy](#7-testing-strategy)
8. [Docker & Deployment](#8-docker--deployment)
9. [Key Design Decisions & Tradeoffs](#9-key-design-decisions--tradeoffs)
10. [Glossary](#10-glossary)

---

## 1. Big Picture

### What problem does this solve?

Hospitals have thousands of pages of clinical protocols (dosing guidelines, emergency procedures, infection control). Doctors and nurses need quick, reliable answers — but reading a PDF under pressure is slow and error-prone. MediAssist AI lets staff upload those documents and ask natural language questions. The AI answers strictly from the uploaded documents, never from its general knowledge, so answers are traceable and auditable.

### System components

```
┌─────────────────────────────────────────────────────────┐
│  Browser (Next.js frontend — port 3000)                 │
│  • Login / Register                                     │
│  • Chat interface (streaming AI responses)              │
│  • Document upload                                      │
│  • Admin dashboard                                      │
└────────────────────┬────────────────────────────────────┘
                     │  HTTP / Server-Sent Events
                     │  (proxied via next.config.js rewrites)
┌────────────────────▼────────────────────────────────────┐
│  FastAPI backend (Python — port 8000)                   │
│  • JWT authentication                                   │
│  • Role-based access control                            │
│  • RAG pipeline (chunk → embed → store → search)       │
│  • AI agent (ReAct loop with Claude claude-opus-4-5)         │
│  • Admin user management                               │
└──────────┬────────────────────┬───────────────────────-─┘
           │                    │
    ┌──────▼──────┐    ┌───────▼──────┐
    │  SQLite DB  │    │   ChromaDB   │
    │ (users,     │    │ (vector      │
    │  sessions)  │    │  embeddings) │
    └─────────────┘    └──────────────┘
```

### Why these technology choices?

| Choice | Why |
|--------|-----|
| **FastAPI** | Async-native, auto-generates OpenAPI docs, excellent for SSE streaming, Pydantic integration |
| **SQLAlchemy 2.0 async** | Production-grade ORM with async support; SQLite is fine for a single-node deployment |
| **ChromaDB** | Embedded vector database — no separate service needed, persistent on disk |
| **Anthropic SDK** | Claude models for reasoning; voyage-medical-2 embeddings are purpose-built for medical text |
| **Next.js 14 App Router** | React Server Components, built-in routing, easy API proxy via rewrites |
| **Zustand** | Tiny, simple global state for auth — no boilerplate compared to Redux |
| **TanStack Query** | Server-state caching, background refetch, loading/error states out of the box |
| **Tailwind CSS** | Utility-first, no runtime — fast to write, easy to keep consistent |

---

## 2. Repository Layout

```
mediassist/
├── backend/                ← Python FastAPI application
│   ├── main.py             ← App factory, middleware, router registration
│   ├── config.py           ← All env vars in one place (Pydantic Settings)
│   ├── database.py         ← SQLAlchemy engine, session factory, init_db
│   ├── requirements.txt    ← Python dependencies
│   ├── auth/               ← Everything about who you are
│   │   ├── models.py       ← SQLAlchemy User model + all Pydantic schemas
│   │   ├── service.py      ← bcrypt, JWT create/decode, DB queries
│   │   ├── dependencies.py ← FastAPI Depends() helpers (get_current_user)
│   │   └── router.py       ← /register /login /refresh /me endpoints
│   ├── authz/
│   │   └── policies.py     ← What you're allowed to do (RBAC/ABAC/ReBAC)
│   ├── rag/
│   │   ├── service.py      ← Chunking, embedding, ChromaDB operations
│   │   └── router.py       ← /upload /query /stats endpoints
│   ├── agents/
│   │   ├── service.py      ← MedicalAgent ReAct loop, tool implementations
│   │   └── router.py       ← /chat/stream (SSE) and /chat endpoints
│   ├── admin/
│   │   └── router.py       ← Paginated user list, patch, soft-delete
│   ├── telemetry/
│   │   └── setup.py        ← OpenTelemetry wiring
│   └── tests/
│       ├── conftest.py     ← Test fixtures (in-memory DB, test client)
│       ├── test_auth.py    ← Auth + authorization integration tests
│       └── test_rag.py     ← Policy engine unit tests + health check
│
└── frontend/               ← Next.js 14 application
    ├── next.config.js      ← API proxy rewrite rule
    ├── tailwind.config.ts  ← Brand color palette
    └── src/
        ├── app/            ← Next.js App Router pages (file = route)
        │   ├── layout.tsx  ← Root layout (wraps QueryClient provider)
        │   ├── providers.tsx ← TanStack Query client setup
        │   ├── (auth)/     ← Route group — no shared layout
        │   │   ├── login/page.tsx
        │   │   └── register/page.tsx
        │   └── (dashboard)/ ← Route group — shares sidebar+topnav layout
        │       ├── layout.tsx   ← AuthGuard + Sidebar + TopNav
        │       ├── chat/page.tsx
        │       ├── documents/page.tsx
        │       └── admin/page.tsx
        ├── components/
        │   ├── ui/         ← Reusable primitives (Button, Input, Card…)
        │   ├── chat/       ← Chat-specific components
        │   ├── documents/  ← Upload + list components
        │   └── layout/     ← Sidebar, TopNav, AuthGuard
        ├── hooks/          ← Custom React hooks
        │   ├── useAuth.ts          ← Zustand store
        │   ├── useStreamingChat.ts ← SSE streaming state machine
        │   └── useDocuments.ts     ← TanStack Query wrappers
        ├── lib/
        │   ├── api.ts      ← Typed fetch wrapper with auto-refresh
        │   ├── auth.ts     ← localStorage token helpers
        │   └── logger.ts   ← Client-side structured logging
        └── types/index.ts  ← All shared TypeScript interfaces
```

**Key principle:** Each directory has a single responsibility. The `auth/` module only knows about identity. The `authz/` module only knows about permissions. The `rag/` module only knows about documents. They interact through well-defined imports — not circular dependencies.

---

## 3. Backend Deep Dive

### 3.1 Config & Settings

**File:** `backend/config.py`

```python
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", ...)
    secret_key: str = "dev-secret-key..."
    anthropic_api_key: str = ""
    database_url: str = "sqlite+aiosqlite:///./mediassist.db"
    ...

settings = Settings()
```

**Why Pydantic BaseSettings?**

- Reads from `.env` file automatically, falls back to environment variables, then to the defaults you write in code.
- Type-validated: if you set `ACCESS_TOKEN_EXPIRE_MINUTES=abc` it throws an error on startup, not at runtime.
- A single `settings` singleton imported everywhere — no scattered `os.getenv()` calls.
- In tests, you override env vars before importing the app.

**The `settings` object is a module-level singleton.** Python caches module imports, so `from config import settings` always returns the same object.

---

### 3.2 Database Layer

**File:** `backend/database.py`

```python
engine = create_async_engine(settings.database_url, echo=settings.debug)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

async def get_db():           # FastAPI dependency
    async with AsyncSessionLocal() as session:
        yield session

async def init_db():          # called at startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
```

**Why async SQLAlchemy?**

FastAPI is built on asyncio. If your database calls are blocking (synchronous), they block the entire event loop — no other requests can be served while one is waiting for a DB response. `aiosqlite` + async SQLAlchemy 2.0 makes DB calls non-blocking.

**`expire_on_commit=False`:** By default SQLAlchemy "expires" objects after a commit, meaning accessing any attribute triggers another SQL query. In async code that causes `MissingGreenlet` errors because there's no active session. Disabling expiry means attributes are readable after commit without a second query.

**`echo=settings.debug`:** When DEBUG=true, every SQL statement is printed to stdout. Very useful for development.

**`get_db` as a FastAPI dependency:** FastAPI's `Depends(get_db)` calls this generator. The `yield` hands the session to the route handler. When the handler finishes (success or error), execution continues after `yield` — so the session is always closed. This is the "dependency injection with cleanup" pattern.

**`init_db`:** Called once at startup via `lifespan`. It reads all `Base` subclasses (your models) and creates their tables if they don't exist. This is development-friendly; in production you'd use Alembic migrations.

---

### 3.3 Authentication

**Files:** `backend/auth/`

#### Models (`auth/models.py`)

```python
class UserRole(str, Enum):
    ADMIN = "admin"
    DOCTOR = "doctor"
    NURSE = "nurse"
    PATIENT = "patient"
```

`str, Enum` means the enum values are plain strings in JSON and the database — `"admin"` not `<UserRole.ADMIN: 'admin'>`.

```python
class User(Base):           # SQLAlchemy ORM model
    id: Mapped[str]         # UUID stored as string
    email: Mapped[str]      # unique index for fast lookups
    hashed_password: Mapped[str]
    role: Mapped[str]
    is_active: Mapped[bool]
    created_at: Mapped[datetime]
```

**Why UUID as string?** SQLite doesn't have a native UUID column type. Storing as a string (VARCHAR) works everywhere. We use Python's `uuid.uuid4()` to generate it.

```python
class UserRegister(BaseModel):       # Pydantic — for incoming requests
    email: EmailStr
    password: str

    @field_validator("password")
    def validate_password(cls, v):
        if len(v) < 8: raise ValueError("...")
        if not any(c.isupper() for c in v): raise ValueError("...uppercase...")
        if not any(c.isdigit() for c in v): raise ValueError("...digit...")
        return v

class UserResponse(BaseModel):       # Pydantic — for outgoing responses
    id: str
    email: str
    role: UserRole
    model_config = {"from_attributes": True}
```

**Two separate classes for the same entity** is important: `UserRegister` has `password`, `UserResponse` never does. This ensures you can never accidentally serialize a password into a response, no matter how you code the endpoint.

`from_attributes = True` lets Pydantic read from SQLAlchemy model attributes directly — so `UserResponse.model_validate(user_orm_object)` works without manually mapping fields.

#### Service (`auth/service.py`)

```python
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)      # bcrypt with random salt

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)
```

**bcrypt** is a deliberately slow hashing algorithm. Even if an attacker steals your database, cracking bcrypt hashes takes years on modern hardware. Never store plain-text passwords.

```python
ALGORITHM = "HS256"

def create_access_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(minutes=60)
    payload["type"] = "access"
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)
```

**JWT (JSON Web Token):** A self-contained token. The payload (`{"sub": user_id, "role": "doctor", "exp": ...}`) is base64-encoded and signed with your secret key. The server can verify the signature without hitting the database — that's why JWTs are fast for authentication.

**Two token types:**
- `access_token` — short-lived (60 min). Used for API calls.
- `refresh_token` — long-lived (7 days). Used only to get a new access token when it expires.

This way, if an access token is stolen, it's only valid for 60 minutes.

#### Dependencies (`auth/dependencies.py`)

```python
bearer_scheme = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials   # extracts from "Authorization: Bearer xxx"
    payload = decode_token(token)     # verifies signature + expiry
    user = await get_user_by_id(db, payload["sub"])
    return user
```

**`Depends(bearer_scheme)`** — FastAPI automatically extracts the `Authorization: Bearer <token>` header. If it's missing, FastAPI returns 403 before your code runs.

**`require_role` factory:**
```python
def require_role(*roles: UserRole):
    async def check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles and current_user.role != UserRole.ADMIN:
            raise HTTPException(403, ...)
        return current_user
    return check

require_doctor = require_role(UserRole.DOCTOR)
require_medical_staff = require_role(UserRole.DOCTOR, UserRole.NURSE)
```

This is the **factory pattern** for FastAPI dependencies. `require_doctor` is a ready-made dependency that you pass to any endpoint — it ensures the caller is a doctor (or admin). Admins bypass all role checks.

---

### 3.4 Authorization

**File:** `backend/authz/policies.py`

Three types of access control:

#### RBAC — Role-Based Access Control

"Can this role do this action?"

```python
policy_engine.assert_role(user, UserRole.DOCTOR)
# → raises 403 if user is not a doctor or admin
```

Used for: endpoint-level access (only doctors can upload documents).

#### ABAC — Attribute-Based Access Control

"Does this user own this resource?"

```python
policy_engine.assert_owns_document(user, document.owner_id)
# → raises 403 if user.id != document.owner_id (unless admin)
```

Used for: doctors can only delete their own documents, not other doctors' documents.

#### ReBAC — Relationship-Based Access Control

"Does a relationship exist between these entities?"

```python
policy_engine.assert_nurse_patient_access(nurse, patient.assigned_nurse_ids)
# → raises 403 if nurse.id not in the patient's assigned nurse list
```

Used for: nurses can only access records of patients assigned to them.

**Why three types?** Real healthcare access control is complex. RBAC alone can't capture "you can read your own records but not others." ABAC can't capture team-based relationships. Using all three gives fine-grained, auditable control.

---

### 3.5 RAG Pipeline

**File:** `backend/rag/service.py`

RAG = Retrieval-Augmented Generation. The idea: before asking the AI your question, retrieve relevant document chunks and include them in the prompt. The AI answers from those chunks, not its general knowledge.

#### Step 1: Chunking

```python
def _chunk_text(self, text: str) -> list[str]:
    # Split text into overlapping windows of ~500 characters
    # Prefer to break at sentence boundaries (". ", "! ", "? ")
    # Drop chunks shorter than 20 characters
```

**Why chunk?**
- LLMs have context limits — you can't fit a 50-page protocol into one prompt.
- Vector search finds similar *passages*, not whole documents. Smaller chunks = more precise retrieval.

**Why overlap (50 chars)?** A sentence that spans a chunk boundary would be split in half. With 50-char overlap, both adjacent chunks contain the full sentence.

**Why sentence boundaries?** A chunk that starts mid-sentence is harder to understand. Aligning to sentences makes retrieved chunks more coherent.

#### Step 2: Embedding

```python
async def _get_embedding(self, text: str) -> list[float]:
    response = await self.anthropic.embeddings.create(
        model="voyage-medical-2",
        input=text,
    )
    return response.embeddings[0].embedding  # list of 1024 floats
```

An **embedding** converts text into a vector of numbers (e.g. 1024 floats). Similar texts have vectors that point in similar directions. This is what makes semantic search possible — you're not matching keywords, you're comparing meaning.

**`voyage-medical-2`** is trained on medical literature, so "MI" and "myocardial infarction" will have similar vectors, even though they share no keywords.

**Fallback for testing:**
```python
if settings.anthropic_api_key.startswith("sk-ant-test"):
    # Deterministic hash-based pseudo-embeddings
    seed = int(hashlib.md5(text.encode()).hexdigest(), 16) % (2**32)
    rng = random.Random(seed)
    return [rng.gauss(0, 1) for _ in range(384)]
```

The same text always produces the same pseudo-embedding (deterministic), so tests are reproducible without an API key.

#### Step 3: Store in ChromaDB

```python
self.collection.add(
    ids=["docid_0", "docid_1", ...],
    embeddings=[[0.1, -0.3, ...], ...],
    documents=["chunk text 0", "chunk text 1", ...],
    metadatas=[{"filename": "...", "doc_id": "..."}, ...],
)
```

**ChromaDB** is a vector database. It stores embeddings and supports fast approximate nearest-neighbour search using the HNSW algorithm. `"hnsw:space": "cosine"` means similarity is measured by cosine distance (angle between vectors, ignoring magnitude).

#### Step 4: Query

```python
results = self.collection.query(
    query_embeddings=[question_embedding],
    n_results=5,
    include=["documents", "metadatas", "distances"],
)
# distance 0 = identical, distance 2 = opposite
# relevance_score = 1 - cosine_distance  (0 to 1, higher = more relevant)
```

The database finds the 5 stored chunks whose embeddings are closest (most similar) to your question's embedding. Returns the chunk text, its metadata, and the cosine distance.

---

### 3.6 AI Agent

**File:** `backend/agents/service.py`

#### ReAct Loop

The agent follows the ReAct (Reasoning + Acting) pattern:

```
Think → Act (call a tool) → Observe (tool result) → Think → Act → ... → Answer
```

```python
while iterations < MAX_ITERATIONS:
    response = await anthropic.messages.create(
        model="claude-opus-4-5",
        tools=TOOL_DEFINITIONS,
        messages=messages,
    )

    # If Claude returned text → stream it to the user
    # If Claude called a tool → execute it, append result, loop again
    if response.stop_reason == "end_turn":
        break
```

**Why an agent instead of a single prompt?** A single prompt can only retrieve documents once. An agent can:
1. Search for "aspirin dosing protocol"
2. Read the results
3. Decide it also needs "contraindications for aspirin"
4. Search again
5. Calculate a dose with `calculate_dose`
6. Produce a complete, accurate answer

#### The Three Tools

```python
TOOL_DEFINITIONS = [
    {
        "name": "rag_search",
        "description": "Search indexed medical documents...",
        "input_schema": {"query": str, "n_results": int}
    },
    {
        "name": "calculate_dose",
        "input_schema": {"medication": str, "weight_kg": float, "dose_mg_per_kg": float}
    },
    {
        "name": "flag_urgent",
        "input_schema": {"reason": str, "severity": "high" | "critical"}
    }
]
```

Claude decides when to call each tool. The tool definitions describe what the tool does — Claude reads those descriptions to reason about which to use.

#### Streaming

```python
async def stream(self, message, history) -> AsyncGenerator[str, None]:
    async for chunk in agent.stream(...):
        yield chunk   # each word, or a [Using tool:...] marker
```

The router wraps this in an SSE response:
```python
async def event_generator():
    async for chunk in agent.stream(...):
        yield f"data: {chunk}\n\n"
    yield "data: [DONE]\n\n"
```

**Special markers the frontend listens for:**
- `[Using tool: rag_search...]` → show spinning indicator
- `[DONE]` → stop the loading cursor
- `[ERROR] message` → show error state

---

### 3.7 Admin API

**File:** `backend/admin/router.py`

Standard CRUD with pagination:

```python
@router.get("/users")
async def list_users(page: int = 1, page_size: int = 20, role: UserRole | None = None, ...):
    total = await db.execute(select(func.count()).select_from(query.subquery()))
    users = await db.execute(query.offset((page-1)*page_size).limit(page_size))
    return {"items": [...], "total": total, "page": page, "total_pages": ceil(total/page_size)}
```

**Soft delete:** `DELETE /users/:id` sets `is_active = False` rather than removing the row. Why? Deleted users may be referenced in audit logs. Hard-deleting creates orphaned references; soft-deleting preserves history.

**Admin-only access:** Every route has `Depends(require_admin)`. If the caller's role is not `admin`, FastAPI returns 403 before the handler body runs.

---

### 3.8 Telemetry

**File:** `backend/telemetry/setup.py`

```python
def setup_telemetry():
    if not settings.otel_enabled:
        return
    provider = TracerProvider(resource=Resource.create({"service.name": "mediassist-api"}))
    if settings.otel_endpoint:
        exporter = OTLPSpanExporter(endpoint=settings.otel_endpoint)  # → Jaeger/Tempo
    else:
        exporter = ConsoleSpanExporter()                               # → stdout
    FastAPIInstrumentor().instrument()   # auto-traces all requests
```

**OpenTelemetry** is a vendor-neutral observability standard. It produces *traces* (timelines of what happened during a request) and *metrics*. By exporting to an OTLP collector you can use Jaeger, Grafana Tempo, or any compatible backend to visualize performance.

**`FastAPIInstrumentor`** automatically creates a span for every HTTP request — no manual instrumentation needed.

---

### 3.9 main.py

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()        # create tables
    setup_telemetry()      # wire OTel
    yield                  # app runs
    # shutdown code would go after yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(LoggingMiddleware)     # structured request/response logs
app.add_middleware(CORSMiddleware, ...)  # allow frontend at localhost:3000

app.include_router(auth_router)
app.include_router(rag_router)
app.include_router(agents_router)
app.include_router(admin_router)
```

**`lifespan`** replaces the old `@app.on_event("startup")` pattern. It's a context manager — startup code runs before `yield`, shutdown code after. FastAPI calls it once when the process starts.

**Middleware order matters:** Middleware is applied in reverse order of registration. `LoggingMiddleware` is registered first, so it wraps everything including CORS. That means the log sees the full request including CORS headers.

---

## 4. Frontend Deep Dive

### 4.1 Next.js App Router

Next.js 14's App Router uses **file-based routing** inside `src/app/`:

| File path | URL |
|-----------|-----|
| `app/page.tsx` | `/` |
| `app/(auth)/login/page.tsx` | `/login` |
| `app/(dashboard)/chat/page.tsx` | `/chat` |
| `app/(dashboard)/layout.tsx` | wraps `/chat`, `/documents`, `/admin` |

**Route groups** `(auth)` and `(dashboard)` are folders whose names don't appear in the URL. They exist purely to share a layout:
- `(auth)` pages get no shared layout (just the page)
- `(dashboard)` pages all get `Sidebar + TopNav + AuthGuard`

**Server vs. Client Components:**
- By default, App Router components are *Server Components* (rendered on the server, no JS sent to browser).
- Add `'use client'` to use React hooks, browser APIs, or event handlers.
- Our pages are mostly client components because they use `useState`, `useEffect`, and browser APIs.

**API Proxy (`next.config.js`):**
```js
rewrites: () => [{ source: '/api/:path*', destination: 'http://localhost:8000/api/:path*' }]
```
The frontend never talks to `http://localhost:8000` directly. All fetch calls use `/api/v1/...`. Next.js rewrites these to the backend URL. This means:
- No CORS issues (same origin from browser's perspective)
- Backend URL is a server-side config, not exposed to clients
- Easy to change backend URL without touching component code

---

### 4.2 Auth State (Zustand)

**File:** `src/hooks/useAuth.ts`

```typescript
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isLoading: true,
  isAuthenticated: false,

  initialize: async () => {
    const token = getAccessToken()      // read from localStorage
    if (!token) { set({ isLoading: false }); return }
    const user = await api.get('/api/v1/auth/me')  // validate token
    set({ user, isAuthenticated: true, isLoading: false })
  },

  login: async (email, password) => {
    const data = await api.post('/api/v1/auth/login', { email, password })
    setTokens(data.access_token, data.refresh_token)  // persist to localStorage
    const user = await api.get('/api/v1/auth/me')
    set({ user, isAuthenticated: true })
  },

  logout: () => {
    clearTokens()
    set({ user: null, isAuthenticated: false })
  },
}))
```

**Why Zustand instead of Context?** React Context re-renders every consumer when any value changes. Zustand uses subscriptions — a component only re-renders when the specific slice it subscribes to changes. For auth state that's fine either way, but Zustand has much less boilerplate.

**`initialize` is called in `AuthGuard`** (on mount). It runs once when the dashboard layout loads.

---

### 4.3 API Client

**File:** `src/lib/api.ts`

```typescript
async function fetchWithAuth(url, options): Promise<Response> {
  // 1. Attach Authorization header
  headers.set('Authorization', `Bearer ${getAccessToken()}`)

  let res = await fetch(url, { ...options, headers })

  // 2. If 401, try to refresh
  if (res.status === 401) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`)
      res = await fetch(url, { ...options, headers })   // retry once
    } else {
      window.location.href = '/login'   // refresh failed → force re-login
    }
  }

  return res
}
```

**Auto-refresh is transparent:** Components call `api.get(...)` and never know a token refresh happened. The client handles the 401 → refresh → retry cycle internally.

**Concurrent refresh protection:**
```typescript
let isRefreshing = false
let refreshQueue: Array<(token: string) => void> = []
```
If two requests fire simultaneously and both get 401, only one refresh call goes out. The second waits in the queue and gets the new token when the first refresh completes. Without this, you'd get two simultaneous refresh calls, potentially invalidating each other.

---

### 4.4 Streaming Chat Hook

**File:** `src/hooks/useStreamingChat.ts`

This is the most complex piece of the frontend. It manages the entire chat lifecycle:

```typescript
export function useStreamingChat(): UseStreamingChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = async (text: string) => {
    // 1. Append user message
    // 2. Append empty assistant message (isStreaming: true)
    // 3. Open fetch stream
    // 4. Read chunks from response body
    // 5. Parse SSE lines: "data: content\n\n"
    // 6. Handle [Using tool:...], [DONE], [ERROR] markers
    // 7. Append text to assistant message
    // 8. On [DONE]: set isStreaming: false
  }
}
```

**Why not `EventSource`?** The browser's native `EventSource` API only supports GET requests. Our endpoint needs a POST (to send the message and history). So we use `fetch` with streaming body reading instead.

**Reading a streaming response:**
```typescript
const reader = res.body!.getReader()
const decoder = new TextDecoder()
let buffer = ''

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  buffer += decoder.decode(value, { stream: true })
  const lines = buffer.split('\n\n')
  buffer = lines.pop() ?? ''   // keep incomplete last chunk in buffer
  for (const line of lines) { /* parse "data: ..." */ }
}
```

The key insight: network chunks don't align with SSE messages. One `reader.read()` might give you half an SSE line, or two complete ones. The `buffer` accumulates data until `\n\n` (the SSE message delimiter) is found.

**AbortController:** Stored in a `ref` (not state, so setting it doesn't cause re-render). When the user clicks "Stop", `abortRef.current.abort()` cancels the fetch — the `catch` block sees `AbortError` and returns cleanly.

---

### 4.5 UI Component Library

All components in `src/components/ui/` follow the same pattern:

```typescript
// Button.tsx — variant + size props, forwarded ref, disabled + loading states
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, ...props }, ref) => {
    return <button ref={ref} className={clsx(variantClasses[variant], sizeClasses[size], ...)} {...props} />
  }
)
```

**`forwardRef`:** Allows a parent to get a ref to the underlying DOM element. Important for focus management and form libraries.

**`clsx`:** A tiny utility to conditionally combine class names without string concatenation bugs.

**`variantClasses` object:** Maps variant names to Tailwind class strings. This pattern avoids template literal conditionals and is easier to extend.

---

### 4.6 Pages & Routing

#### AuthGuard

```typescript
// src/components/layout/AuthGuard.tsx
export function AuthGuard({ children }) {
  const { isAuthenticated, isLoading, initialize } = useAuthStore()
  const router = useRouter()

  useEffect(() => { initialize() }, [])   // check token on mount

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login')
  }, [isLoading, isAuthenticated])

  if (isLoading) return <Spinner />
  if (!isAuthenticated) return null       // don't flash protected content
  return children
}
```

**Two effects, not one:** The first runs once on mount to initialize. The second reacts to auth state changes — if `isAuthenticated` becomes false (e.g. logout), it redirects immediately.

**Three render states:**
1. `isLoading: true` → show spinner (checking token validity)
2. `isAuthenticated: false` → render nothing (redirect is happening)
3. `isAuthenticated: true` → render children

This prevents a flash of the dashboard before the redirect fires.

#### Admin page role guard

```typescript
// src/app/(dashboard)/admin/page.tsx
useEffect(() => {
  if (user && user.role !== 'admin') router.push('/chat')
}, [user, router])

if (!user || user.role !== 'admin') return null
```

Even if someone navigates directly to `/admin`, they're redirected if they're not an admin. The backend also enforces this — the double-guard is defense in depth.

---

## 5. Cross-Cutting Concepts

### 5.1 JWT Authentication Flow

```
Login Request
─────────────
Client → POST /api/v1/auth/login {email, password}
Server → verifies bcrypt hash
Server → creates access_token (exp: 60min) + refresh_token (exp: 7d)
Client → stores both in localStorage

Authenticated Request
─────────────────────
Client → GET /api/v1/auth/me
         Authorization: Bearer <access_token>
Server → decodes JWT (no DB query needed!)
Server → checks exp, validates signature
Server → returns user data

Token Expiry
────────────
Client → GET /api/v1/documents/stats
         Authorization: Bearer <expired_access_token>
Server → returns 401
Client (api.ts) → POST /api/v1/auth/refresh {refresh_token}
Server → issues new access_token + refresh_token
Client → retries original request with new token
```

**JWT structure:** `header.payload.signature` — all base64 encoded. The signature is `HMAC-SHA256(header + "." + payload, secret_key)`. Without the secret key, you cannot forge a valid token.

**Why two tokens?** If you made the access token long-lived, a stolen token would be valid for days. If you made it short-lived (60min), users would have to log in every hour. Refresh tokens solve this: access tokens expire quickly (low risk if stolen), but the refresh token silently renews them (good UX).

---

### 5.2 RAG — Retrieval-Augmented Generation

```
Document Upload
───────────────
"The standard aspirin dose for ACS is 300mg loading dose..."
         ↓ chunk (500 chars, overlap 50)
["The standard aspirin dose for ACS is 300mg loading dose...", ...]
         ↓ embed (voyage-medical-2)
[[0.12, -0.34, 0.78, ...], ...]     ← 1024-dimensional vectors
         ↓ store in ChromaDB
{id: "doc123_0", embedding: [...], document: "The standard...", metadata: {...}}

Query
─────
"What is the aspirin dose for heart attack?"
         ↓ embed (same model)
[0.11, -0.31, 0.80, ...]
         ↓ cosine similarity search in ChromaDB
Top 5 chunks: ["The standard aspirin dose for ACS is 300mg...", ...]
         ↓ include in prompt to Claude
"Based on these documents: [chunks] — answer: What is the aspirin dose...?"
         ↓ Claude generates answer grounded in the documents
"According to the cardiac protocol, the standard aspirin loading dose for ACS is 300mg..."
```

**Why cosine similarity?** It measures the angle between vectors, not their magnitude. This means a short chunk and a long chunk about the same topic will still score as similar — length doesn't dominate the score.

**Relevance score:** `1 - cosine_distance`. ChromaDB returns distances (0 = identical), we convert to scores (1 = identical) for readability.

---

### 5.3 ReAct Agent Loop

```
User: "What's the aspirin dose for a 70kg patient with ACS?"

Iteration 1:
  Claude thinks: "I need to find the aspirin dosing protocol."
  Claude calls:  rag_search(query="aspirin dose ACS protocol")
  Tool returns:  "Standard loading dose: 300mg, maintenance: 75mg daily..."

Iteration 2:
  Claude thinks: "I have the protocol. Now I should calculate the dose."
  Claude calls:  calculate_dose(medication="aspirin", weight_kg=70, dose_mg_per_kg=4.28)
  Tool returns:  "aspirin: 300mg (based on 70 kg × 4.28 mg/kg)"

Iteration 3:
  Claude thinks: "I have all I need to answer."
  Claude generates: "Based on the cardiac protocol, the aspirin loading dose for this
                     70kg patient is 300mg (confirmed by the weight-based calculation)."
  stop_reason: "end_turn"
```

The key is that Claude sees the tool results and can decide to call more tools or stop. This makes the agent adaptive — it doesn't follow a rigid script.

**`MAX_ITERATIONS = 10`:** A safety limit. Without it, a confused agent could loop forever calling tools.

---

### 5.4 SSE Streaming

Server-Sent Events (SSE) is a protocol for pushing data from server to client over HTTP:

```
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache

data: Based \n\n
data: on \n\n
data: the \n\n
data: [Using tool: rag_search...]\n\n
data: protocol, \n\n
data: the \n\n
data: dose \n\n
data: is \n\n
data: 300mg.\n\n
data: [DONE]\n\n
```

**Why SSE instead of WebSocket?**
- SSE is one-directional (server → client), which is all we need.
- SSE is plain HTTP — no upgrade handshake, works through proxies and load balancers.
- SSE automatically reconnects if the connection drops (with EventSource; we use fetch instead for POST support).

**The `\n\n` delimiter:** The SSE spec says each event ends with a blank line. Our parser splits on `\n\n` to separate events.

---

### 5.5 RBAC / ABAC / ReBAC

| Type | Question | Example |
|------|----------|---------|
| **RBAC** — Role-Based | Can this *role* do this? | "Only doctors can upload documents" |
| **ABAC** — Attribute-Based | Does this *resource attribute* match? | "You can only delete documents you uploaded" |
| **ReBAC** — Relationship-Based | Does a *relationship* exist? | "You can only access patients assigned to you" |

**They compose:** A nurse accessing a patient record must pass:
1. RBAC: role is `nurse` (medical staff can access patient data) ✓
2. ReBAC: `nurse.id in patient.assigned_nurse_ids` ✓

Either check failing → 403.

---

## 6. Data Flow Walkthroughs

### 6.1 User registers and logs in

```
1. User fills register form → clicks "Create account"
2. Frontend: POST /api/v1/auth/register {full_name, email, password, role}
3. Next.js proxy rewrites to http://localhost:8000/api/v1/auth/register
4. FastAPI: Pydantic validates request body (EmailStr, password validator)
5. auth/service: checks email not already in DB
6. auth/service: bcrypt.hash(password) → hashed_password
7. auth/service: INSERT INTO users ... → returns User ORM object
8. auth/router: serializes to UserResponse (no password field)
9. Frontend: receives 201, redirects to /login

10. User fills login form → clicks "Sign in"
11. Frontend: POST /api/v1/auth/login {email, password}
12. auth/service: SELECT user WHERE email = ? → found
13. auth/service: bcrypt.verify(password, hashed_password) → True
14. auth/service: create_access_token({sub: user.id, role: user.role})
15. auth/service: create_refresh_token({sub: user.id, role: user.role})
16. Frontend: receives {access_token, refresh_token}
17. lib/auth.ts: localStorage.setItem('mediassist_access_token', ...)
18. Frontend: GET /api/v1/auth/me (with Bearer token)
19. Zustand: set({ user, isAuthenticated: true })
20. Router: push('/chat')
```

### 6.2 Doctor uploads a protocol document

```
1. Doctor drags PDF onto drop zone
2. DocumentUpload: setSelectedFile(file)
3. Doctor clicks "Upload and Index"
4. useDocumentUpload.mutate(file)
5. api.uploadFile('/api/v1/documents/upload', file)
   → FormData with file
   → Authorization: Bearer <token>
6. FastAPI: require_doctor dependency runs
   → get_current_user: decode JWT, fetch user from DB
   → assert role is doctor (or admin)
7. rag/router: reads file bytes, decodes UTF-8
8. rag/service._chunk_text(): splits into ~500-char chunks
9. For each chunk:
   rag/service._get_embedding(): calls voyage-medical-2 API
   → returns 1024-float vector
10. ChromaDB: add(ids, embeddings, documents, metadatas)
11. Returns: {doc_id, filename, chunks_created: 12}
12. Frontend: shows "protocol.pdf indexed into 12 searchable chunks"
13. TanStack Query: invalidates 'document-stats' → refetches stats
```

### 6.3 Nurse asks the AI a question

```
1. Nurse types "What is the aspirin dose for ACS?" → Enter
2. useStreamingChat.sendMessage(text)
3. Appends user message and empty assistant message to state
4. fetch('/api/v1/agent/chat/stream', {method: 'POST', body: {message, history}})
5. FastAPI: require_medical_staff → nurse role passes ✓
6. agents/router: creates MedicalAgent(rag_service)
7. agents/router: returns StreamingResponse with event_generator

8. MedicalAgent.stream() — Iteration 1:
   → anthropic.messages.create(model="claude-opus-4-5", tools=TOOL_DEFINITIONS, ...)
   → Claude responds with tool_use: rag_search(query="aspirin ACS protocol")
   → yields "[Using tool: rag_search...]\n"
   → executes rag_search → queries ChromaDB → returns chunks
   → appends tool result to messages

9. Iteration 2:
   → anthropic.messages.create(... with tool result in messages)
   → Claude generates text: "Based on the cardiac protocol, aspirin..."
   → yields each word: "Based " "on " "the " ...
   → stop_reason: "end_turn"
   → yields nothing more

10. event_generator: yields "data: [DONE]\n\n"

11. Frontend reader.read() loop:
    → accumulates "data: [Using tool: rag_search...]\n\n"
    → sets toolCalls on assistant message (shows spinner)
    → accumulates "data: Based \n\n", "data: on \n\n", ...
    → appends each word to message content (text grows in real time)
    → receives "data: [DONE]\n\n"
    → sets isStreaming: false (cursor disappears)
```

---

## 7. Testing Strategy

**File:** `backend/tests/`

### Test types

#### Integration tests (`test_auth.py`)

These test the full HTTP stack: HTTP request → FastAPI → SQLAlchemy → SQLite → response. They use a real (in-memory) database, not mocks.

```python
# conftest.py — the test fixture
@pytest_asyncio.fixture
async def client(db_engine):
    async def override_get_db():
        async with test_session() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db   # swap real DB for test DB
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
```

`ASGITransport` makes `httpx` call the FastAPI app directly (no network). `dependency_overrides` replaces `get_db` with a version that uses a fresh in-memory SQLite database for each test.

**Why in-memory SQLite for tests?** Fast (no disk I/O), isolated (each test gets a clean DB), no cleanup needed (destroyed when connection closes).

#### Unit tests (`test_rag.py` → `TestDocumentPolicy`, `TestPatientRecordPolicy`)

These test the policy engine in isolation — no HTTP, no database, no network:

```python
class _FakeUser:
    def __init__(self, role, user_id="user-1"):
        self.role = role
        self.id = user_id

def test_doctor_owns_document():
    doctor = _FakeUser(UserRole.DOCTOR, user_id="doc-1")
    assert policy.check_owns_document(doctor, "doc-1")   # True
    assert not policy.check_owns_document(doctor, "doc-2") # False
```

Pure Python — fast, no infrastructure needed.

### Why both?

- Unit tests verify logic in isolation. Fast to write, fast to run.
- Integration tests verify the pieces work together. Catch wiring bugs unit tests miss (e.g. a dependency not being registered correctly).

### `pytest.ini`

```ini
[pytest]
asyncio_mode = auto
testpaths = tests
```

`asyncio_mode = auto` makes pytest-asyncio automatically treat `async def test_*` functions as async tests — no `@pytest.mark.asyncio` needed on every function.

---

## 8. Docker & Deployment

### Dockerfile (backend)

```dockerfile
FROM python:3.11-slim
WORKDIR /app
RUN apt-get install build-essential  # needed for some Python package compilation
COPY requirements.txt .
RUN pip install -r requirements.txt  # cached layer — only re-runs if requirements.txt changes
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Layer caching:** Docker builds images in layers. The `COPY requirements.txt` + `RUN pip install` layer is only re-built if `requirements.txt` changes. Source code changes don't invalidate the dependency layer. This makes rebuilds fast.

**`0.0.0.0`:** Binds to all network interfaces. Required inside Docker — `127.0.0.1` would only be reachable from inside the container.

### docker-compose.yml

```yaml
services:
  backend:
    volumes:
      - ./backend:/app        # live reload: changes on host appear in container
      - mediassist_db:/app/data
      - mediassist_chroma:/app/chroma_db
    command: uvicorn main:app --reload    # override CMD for dev

  frontend:
    volumes:
      - ./frontend:/app
      - /app/node_modules     # anonymous volume: keeps container's node_modules
      - /app/.next            # don't override with host's empty .next folder
```

**Named volumes (`mediassist_db`, `mediassist_chroma`):** Data persists across container restarts. Without this, the SQLite database and ChromaDB files would be lost every time the container stops.

**Anonymous volume for `node_modules`:** The `./frontend:/app` mount would override `node_modules` with the host's (possibly incompatible) version. The anonymous volume `/app/node_modules` takes precedence — it keeps the container's installed modules.

---

## 9. Key Design Decisions & Tradeoffs

| Decision | Why we made it | Tradeoff |
|----------|---------------|----------|
| **SQLite** (not PostgreSQL) | Zero setup, file-based, perfect for dev and single-node | Doesn't scale horizontally (can't have multiple backend instances sharing one DB) |
| **ChromaDB** embedded | No separate service to run | Can't share vector store across multiple backend instances |
| **JWT stateless auth** | No session store needed; horizontally scalable | Can't invalidate individual tokens before expiry (logout is client-side only) |
| **Soft delete** | Preserves audit history | Grows the table over time; need to filter `is_active=False` in all queries |
| **Chunking before embedding** | LLMs have context limits; smaller chunks = more precise retrieval | A fact split across a chunk boundary may be missed |
| **voyage-medical-2** | Domain-specific embeddings understand medical terminology | Requires Anthropic API; adds cost; needs fallback for testing |
| **Streaming via fetch (not EventSource)** | EventSource only supports GET; we need POST | More complex client-side parsing code |
| **No document list endpoint** | ChromaDB doesn't natively support "list all documents" by file | Users see stats but not individual files |
| **`from_attributes = True` on Pydantic** | Lets Pydantic read SQLAlchemy objects directly | Couples Pydantic schemas to ORM — can't easily swap to a different ORM |

---

## 10. Glossary

| Term | Definition |
|------|-----------|
| **ABAC** | Attribute-Based Access Control — access decisions based on resource properties |
| **bcrypt** | Slow cryptographic hash function designed for passwords |
| **ChromaDB** | Embedded vector database; stores and searches embeddings |
| **Cosine similarity** | Measure of angle between two vectors; 1 = identical, 0 = unrelated |
| **Embedding** | Dense numerical vector representation of text; similar texts → similar vectors |
| **FastAPI** | Python async web framework; generates OpenAPI docs automatically |
| **HNSW** | Hierarchical Navigable Small World — the algorithm ChromaDB uses for fast nearest-neighbor search |
| **JWT** | JSON Web Token — signed, self-contained auth token |
| **Lifespan** | FastAPI context manager for startup/shutdown logic |
| **ORM** | Object-Relational Mapper — maps Python classes to database tables (SQLAlchemy) |
| **OTLP** | OpenTelemetry Protocol — standard wire format for traces/metrics |
| **Pydantic** | Python data validation library; powers FastAPI's request/response models |
| **RAG** | Retrieval-Augmented Generation — augment AI prompts with retrieved documents |
| **RBAC** | Role-Based Access Control — access decisions based on user role |
| **ReAct** | Reasoning + Acting — agent pattern: think, call tool, observe, repeat |
| **ReBAC** | Relationship-Based Access Control — access based on entity relationships |
| **Refresh token** | Long-lived token used only to obtain new access tokens |
| **Route group** | Next.js folder syntax `(name)` — groups routes without affecting URL |
| **SQLAlchemy** | Python SQL toolkit and ORM |
| **SSE** | Server-Sent Events — HTTP protocol for server-to-client streaming |
| **Soft delete** | Mark record inactive instead of removing it |
| **Zustand** | Lightweight React state management library |
| **`aiosqlite`** | Async wrapper for SQLite — makes DB calls non-blocking in asyncio |
| **`clsx`** | Utility for conditionally joining CSS class names |
| **`forwardRef`** | React API to expose a child component's DOM node to its parent |
