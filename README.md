# MediAssist AI

Healthcare AI platform with RAG-powered clinical decision support.

## Quick start

### Prerequisites
- Python 3.11+
- Node.js 18+
- An Anthropic API key

### Option A: Docker Compose (recommended)
```bash
cp .env.example .env
# Edit .env with your ANTHROPIC_API_KEY and SECRET_KEY
docker-compose up
```
Open http://localhost:3000

### Option B: Run manually

**Backend**
```bash
cd backend
python -m venv venv && source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # fill in ANTHROPIC_API_KEY and SECRET_KEY
uvicorn main:app --reload
```

**Frontend** (new terminal)
```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open http://localhost:3000

## Default accounts after first run

Register through the UI. First user to register with role `admin` gets full access.

## API documentation

- Backend Swagger UI: http://localhost:8000/docs
- Backend health check: http://localhost:8000/health

## Running tests

```bash
cd backend
pip install pytest pytest-asyncio httpx
pytest tests/ -v
```

## Architecture

```
mediassist/
├── backend/          FastAPI + SQLAlchemy + ChromaDB + Anthropic SDK
│   ├── auth/         JWT auth (register, login, refresh, me)
│   ├── authz/        RBAC + ABAC + ReBAC policy engine
│   ├── rag/          Document indexing + vector search (voyage-medical-2)
│   ├── agents/       ReAct agent loop with SSE streaming
│   ├── admin/        User management (admin only)
│   └── telemetry/    OpenTelemetry setup
└── frontend/         Next.js 14 App Router + Tailwind + Zustand
    ├── (auth)/       Login + Register pages
    └── (dashboard)/  Chat, Documents, Admin pages
```

## Environment variables

### Backend (`backend/.env`)
| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | JWT signing key (min 32 chars) |
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `DATABASE_URL` | SQLite URL (default: `sqlite+aiosqlite:///./mediassist.db`) |
| `CHROMA_PERSIST_DIRECTORY` | ChromaDB data dir (default: `./chroma_db`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT access token TTL (default: 60) |
| `OTEL_ENABLED` | Enable OpenTelemetry (default: false) |

### Frontend (`frontend/.env.local`)
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend URL (default: `http://localhost:8000`) |
