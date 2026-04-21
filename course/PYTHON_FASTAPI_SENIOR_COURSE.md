# MediAssist — Senior Python & FastAPI Course

> **Audience:** Ahmed Adel — Senior Mobile Engineer (Flutter / Swift / React Native), B.Sc. Systems & Biomedical Engineering.  
> Every section maps Python concepts onto Dart/Flutter analogues you already own. No syntax lectures. Deep *why*.

---

## Table of Contents

- [Part I — Python Foundations for a Dart/TS Senior](#part-i--python-foundations-for-a-dartts-senior)
  - [§1 Python's Execution Model](#1-pythons-execution-model)
  - [§2 The Type System](#2-the-type-system)
  - [§3 Variables, Scope, and Name Binding](#3-variables-scope-and-name-binding)
  - [§4 Data Model Deep Dive](#4-data-model-deep-dive)
  - [§5 Functions as First-Class Citizens](#5-functions-as-first-class-citizens)
  - [§6 Context Managers](#6-context-managers)
  - [§7 Iterators, Generators, Async Generators](#7-iterators-generators-async-generators)
  - [§8 Error Handling](#8-error-handling)
- [Part II — Async Python](#part-ii--async-python)
  - [§9 Sync vs Async Mental Model](#9-sync-vs-async-mental-model)
  - [§10 The Event Loop](#10-the-event-loop)
  - [§11 async def vs def in FastAPI](#11-async-def-vs-def-in-fastapi)
  - [§12 Structured Concurrency](#12-structured-concurrency)
  - [§13 Async I/O in Practice](#13-async-io-in-practice)
- [Part III — FastAPI Deep Dive](#part-iii--fastapi-deep-dive)
  - [§14 ASGI vs WSGI](#14-asgi-vs-wsgi)
  - [§15 Request Lifecycle](#15-request-lifecycle)
  - [§16 Routing & Path Operations](#16-routing--path-operations)
  - [§17 Pydantic v2 in FastAPI](#17-pydantic-v2-in-fastapi)
  - [§18 Dependency Injection](#18-dependency-injection)
  - [§19 Pydantic Settings](#19-pydantic-settings)
  - [§20 Request Parsing & File Uploads](#20-request-parsing--file-uploads)
  - [§21 Authentication & Security](#21-authentication--security)
  - [§22 Background Tasks](#22-background-tasks)
  - [§23 WebSockets & Streaming](#23-websockets--streaming)
  - [§24 Lifespan Events](#24-lifespan-events)
  - [§25 Exception Handlers](#25-exception-handlers)
  - [§26 OpenAPI & Docs](#26-openapi--docs)
- [Part IV — Data Layer](#part-iv--data-layer)
  - [§27 SQLAlchemy 2.0 Async](#27-sqlalchemy-20-async)
  - [§28 aiosqlite](#28-aiosqlite)
  - [§29 Session Management Patterns](#29-session-management-patterns)
  - [§30 Migrations — The Missing Alembic](#30-migrations--the-missing-alembic)
- [Part V — The AI Layer](#part-v--the-ai-layer)
  - [§31 Anthropic SDK](#31-anthropic-sdk)
  - [§32 Google Generative AI SDK](#32-google-generative-ai-sdk)
  - [§33 ChromaDB](#33-chromadb)
  - [§34 RAG Pipeline End-to-End](#34-rag-pipeline-end-to-end)
  - [§35 pypdf](#35-pypdf)
- [Part VI — Observability](#part-vi--observability)
  - [§36 OpenTelemetry](#36-opentelemetry)
  - [§37 Structured Logging](#37-structured-logging)
- [Part VII — Testing](#part-vii--testing)
  - [§38 Pytest Foundations](#38-pytest-foundations)
  - [§39 Testing FastAPI](#39-testing-fastapi)
  - [§40 Test DB Strategy](#40-test-db-strategy)
- [Part VIII — Production Concerns](#part-viii--production-concerns)
  - [§41 Uvicorn in Production](#41-uvicorn-in-production)
  - [§42 Concurrency Model Recap](#42-concurrency-model-recap)
  - [§43 Security Checklist](#43-security-checklist)
  - [§44 Performance Gotchas](#44-performance-gotchas)
- [Part IX — Codebase Walkthrough](#part-ix--codebase-walkthrough)
  - [§45 File-by-File Tour with Dependency Graph](#45-file-by-file-tour-with-dependency-graph)
  - [§46 End-to-End Request Traces](#46-end-to-end-request-traces)
- [Part X — Senior Playbook](#part-x--senior-playbook)
  - [§47 Design Patterns in This Codebase](#47-design-patterns-in-this-codebase)
  - [§48 Honest Refactor Critique](#48-honest-refactor-critique)
  - [§49 Senior Code Review Checklist](#49-senior-code-review-checklist)
- [Part XI — Dependency Deep Dives](#part-xi--dependency-deep-dives)
- [Part XII — 10 Mastery Exercises](#part-xii--10-mastery-exercises)

---

# Part I — Python Foundations for a Dart/TS Senior

## §1 Python's Execution Model

### CPython, Bytecode, and the GIL

Python (CPython, the reference implementation) compiles `.py` source to `.pyc` bytecode, then runs it on a stack-based virtual machine. Unlike Dart's ahead-of-time (AOT) compiled native code or the Dart VM's just-in-time (JIT) compilation, CPython never JIT-compiles. Every Python line you write is interpreted.

```
source.py  →  compile  →  __pycache__/source.cpython-311.pyc  →  CPython VM
```

The **Global Interpreter Lock (GIL)** is the most important thing to understand about CPython. It is a mutex that allows only one thread to execute Python bytecode at a time, even on multi-core hardware.

> **🔁 Dart Analogy:** Dart's isolates are completely separate memory spaces — no shared state, no locks needed. CPython is the opposite: all threads share memory but are serialized by the GIL. The practical consequence: Python threads don't speed up CPU-bound work. They help only with I/O-bound work (the GIL is released during syscalls).

```
┌──────────────────────────────────────────────────────────────┐
│  Process                                                      │
│  ┌────────────┐   ┌────────────┐   ┌────────────┐            │
│  │  Thread 1  │   │  Thread 2  │   │  Thread 3  │            │
│  │  (running) │   │ (waiting   │   │ (waiting   │            │
│  │            │←─ │  for GIL)  │   │  for GIL)  │            │
│  └────────────┘   └────────────┘   └────────────┘            │
│         ↑                                                     │
│       GIL (only one can run Python bytecode at a time)       │
└──────────────────────────────────────────────────────────────┘
```

**Reference Counting** is Python's primary memory management strategy. Every object has a `ob_refcnt` field. When it hits 0, the object is immediately freed — no GC pause needed for most objects. Cycles (A→B→A) are handled by a separate cyclic garbage collector that runs periodically.

```python
import sys
x = []
print(sys.getrefcount(x))  # 2 (x + the getrefcount argument)
y = x
print(sys.getrefcount(x))  # 3
del y
print(sys.getrefcount(x))  # 2
```

> **💡 Senior Tip:** `__del__` finalizers are unreliable in CPython because the cyclic GC doesn't call them in any guaranteed order. Use context managers (`with`) for deterministic resource cleanup instead — exactly what `database.py:get_db` does with `async with AsyncSessionLocal() as session`.

### Relevance to MediAssist

`uvicorn[standard]` installs `uvloop` (optional event loop based on libuv, written in C) which replaces asyncio's default event loop. The GIL still exists, but since async code only runs one coroutine at a time anyway, the GIL is mostly irrelevant for the async path. Where it matters: `bcrypt.hashpw` in `auth/service.py` is synchronous CPU-bound work — it holds the GIL while hashing. FastAPI deals with this by running sync functions in a threadpool executor (covered in [§11](#11-async-def-vs-def-in-fastapi)).

---

## §2 The Type System

Python's type system is **optional and gradual** — annotations are metadata, not enforcement. At runtime, `x: int = "hello"` is perfectly valid Python. Type checkers (mypy, pyright) enforce them statically, not the interpreter.

### Core Annotation Types

```python
from typing import Optional, Union, Literal, TypeVar, Generic, Protocol, TypedDict, Annotated
from collections.abc import Callable, AsyncGenerator, Sequence
```

| Python | Dart Equivalent | Notes |
|--------|----------------|-------|
| `Optional[str]` | `String?` | Exactly `str \| None` since Python 3.10 can write `str \| None` directly |
| `Union[str, int]` | No direct equivalent | `str \| int` in 3.10+ |
| `Literal["admin", "doctor"]` | Dart enums (sort of) | Only these exact values pass type checking |
| `TypeVar("T")` | `<T>` generics | Allows writing generic functions/classes |
| `Protocol` | Dart `interface` (abstract) | Structural subtyping — duck typing made explicit |
| `TypedDict` | `Map<String, dynamic>` with shape | Dict with known keys + types, no class needed |
| `Annotated[str, Field(min_length=3)]` | No equivalent | Attaches metadata to a type — Pydantic uses this heavily |

### How Your Codebase Uses These

`auth/models.py` uses `Mapped[str]` and `Mapped[bool]` — these are SQLAlchemy 2.0's type-annotated columns that combine the Python type hint with the ORM column declaration:

```python
# auth/models.py
class User(Base):
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
```

`Mapped[str]` tells SQLAlchemy (and the type checker) this column returns a `str`, never `None`. `Mapped[Optional[str]]` would allow NULL. This is purely a 2.0 feature — in SQLAlchemy 1.x this would be `Column(String)` with no type information.

`auth/dependencies.py` uses `require_role` which returns a dependency function — the return type here is `Callable[..., Coroutine[User]]` but annotated loosely. This is a place where a stronger type would help.

### `Annotated` — The Superpower

FastAPI uses `Annotated` to pack both the type and its dependency/validator into one expression:

```python
# Modern FastAPI style (not yet in this codebase, but the pattern to know)
from typing import Annotated
from fastapi import Depends

CurrentUser = Annotated[User, Depends(get_current_user)]

@router.get("/me")
async def get_me(user: CurrentUser) -> UserResponse:
    ...
```

> **💡 Senior Tip:** `Annotated[X, metadata]` is just a container — at runtime `Annotated[str, "anything"]` is still a `str`. Only tools that explicitly inspect `__metadata__` (Pydantic, FastAPI, mypy plugins) act on the extra data.

---

## §3 Variables, Scope, and Name Binding

### LEGB Rule

Python resolves names in this order: **L**ocal → **E**nclosing → **G**lobal → **B**uilt-in.

```python
x = "global"

def outer():
    x = "enclosing"

    def inner():
        # x here resolves to "enclosing" (E before G)
        print(x)  # "enclosing"

    inner()
```

> **🔁 Dart Analogy:** Dart has the same lexical scoping. The difference: Python has `global` and `nonlocal` keywords to *write* to outer scopes, Dart closures just capture by reference automatically.

```python
counter = 0

def increment():
    global counter   # without this: UnboundLocalError on counter += 1
    counter += 1

def make_adder(n: int):
    def add(x: int) -> int:
        nonlocal n   # only needed if you're reassigning n, not just reading
        return x + n
    return add
```

### The Mutable Default Argument Bug

One of Python's most famous footguns:

```python
def append_item(item, container=[]):   # BAD: [] is created ONCE at function definition
    container.append(item)
    return container

append_item(1)  # [1]
append_item(2)  # [1, 2]  ← same list!
append_item(3)  # [1, 2, 3]

# Correct idiom:
def append_item(item, container=None):
    if container is None:
        container = []
    container.append(item)
    return container
```

Why? In Python, `def` is an *executable statement*. The default value expression `[]` is evaluated once when `def` runs, not each time the function is called. The `[]` becomes a persistent attribute of the function object: `append_item.__defaults__`.

> **🔁 Dart Analogy:** Dart named parameters with default values work the same risky way for mutable defaults, but in practice Dart encourages immutable defaults so it's rarer to hit.

**Your codebase does this correctly:** `conversation_history: list[ConversationMessage] = []` in `agents/router.py`'s `ChatRequest` is a Pydantic `BaseModel` field, not a function default. Pydantic handles this safely — it creates a new list for each model instance.

### Name Binding vs Assignment

Python doesn't have variable declarations — `=` binds a name to an object. The name `x` in `x = 5` is just a label pointing to the integer object `5`. `del x` removes the label, not the object (the object lives until its refcount hits 0).

```python
a = [1, 2, 3]
b = a        # b and a point to the SAME list
b.append(4)
print(a)     # [1, 2, 3, 4] — same object

b = [1, 2, 3]  # now b points to a NEW list
b.append(4)
print(a)     # [1, 2, 3] — a unchanged
```

> **🔁 Dart Analogy:** Identical to Dart reference semantics for objects. `var b = a` copies the reference, not the value. `final` in Dart prevents rebinding the name; Python has no equivalent (you can always rebind). `const` in Dart is compile-time immutability — Python has no equivalent.

---

## §4 Data Model Deep Dive

Python's data model is the set of special methods (`__dunder__` methods) that hook into language syntax. When you write `obj + other`, Python calls `obj.__add__(other)`. When you write `async with ctx:`, Python calls `await ctx.__aenter__()`.

### Key Dunders for Backend Work

| Dunder | Triggered by | Relevance in MediAssist |
|--------|-------------|------------------------|
| `__init__` | `ClassName(args)` | `RAGService.__init__`, `MedicalAgent.__init__` |
| `__call__` | `instance(args)` | FastAPI dependencies are callables; `require_role(...)` returns a callable |
| `__enter__` / `__exit__` | `with stmt:` | Sync context managers |
| `__aenter__` / `__aexit__` | `async with stmt:` | `AsyncSession`, `AsyncClient`, `lifespan` |
| `__iter__` / `__next__` | `for x in iterable:` | Synchronous iteration |
| `__aiter__` / `__anext__` | `async for x in iterable:` | `agent.stream()` returns an `AsyncGenerator` |
| `__repr__` | `repr(obj)`, logs | Makes objects readable in logs |
| `__eq__` / `__hash__` | `==`, dict keys | Pydantic models implement these |
| `__get__` / `__set__` | Attribute access | SQLAlchemy `InstrumentedAttribute` uses descriptors |

### Descriptors

A descriptor is any object that defines `__get__`, `__set__`, or `__delete__`. SQLAlchemy's `mapped_column()` returns a descriptor. When you access `user.email`, Python calls `User.email.__get__(user, User)` — the descriptor intercepts the attribute access and can return anything (the actual column value, a query proxy, etc.).

```python
class Descriptor:
    def __get__(self, obj, objtype=None):
        if obj is None:
            return self   # class-level access
        return obj.__dict__.get('_value', None)

    def __set__(self, obj, value):
        obj.__dict__['_value'] = value

class MyClass:
    attr = Descriptor()   # class-level descriptor

m = MyClass()
m.attr = 42       # calls Descriptor.__set__
print(m.attr)     # calls Descriptor.__get__ → 42
```

> **🔁 Dart Analogy:** Dart has no descriptors but has `get`/`set` properties on classes. Python descriptors are more powerful — they're reusable across classes and form the foundation of SQLAlchemy's ORM, Pydantic's field validation, and `property`.

### `__slots__`

By default, Python objects store instance attributes in a `__dict__` (a hash map). `__slots__` replaces this with a fixed-size C struct, saving memory and speeding up attribute access:

```python
class WithDict:
    def __init__(self, x, y):
        self.x = x
        self.y = y

class WithSlots:
    __slots__ = ('x', 'y')   # no __dict__
    def __init__(self, x, y):
        self.x = x
        self.y = y

import sys
print(sys.getsizeof(WithDict(1, 2)))    # ~48 bytes + dict overhead (~232 bytes)
print(sys.getsizeof(WithSlots(1, 2)))  # ~56 bytes, no dict
```

Pydantic v2 uses `__slots__` internally for performance. You'd use this in hot-path data structures, not general application code.

---

## §5 Functions as First-Class Citizens

### Decorators

A decorator is a function that takes a function and returns a function. The `@` syntax is sugar:

```python
@decorator
def func(): ...
# identical to:
func = decorator(func)
```

FastAPI's path operations are decorators that register routes:

```python
# auth/router.py
@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(data: UserRegister, db: AsyncSession = Depends(get_db)):
    ...
# Under the hood:
# register = router.post("/register", status_code=201)(register)
# router.post(...) returns a decorator; that decorator wraps `register`
# and registers it in the router's route table
```

### `functools.wraps` — Why It Matters

When you write a decorator without `@wraps`, you lose the original function's `__name__`, `__doc__`, and `__module__`:

```python
from functools import wraps

def my_decorator(func):
    @wraps(func)          # preserves func's identity metadata
    def wrapper(*args, **kwargs):
        print("before")
        result = func(*args, **kwargs)
        print("after")
        return result
    return wrapper
```

FastAPI inspects function signatures (via `inspect.signature`) to build dependency injection and OpenAPI schemas. If you forget `@wraps` in a custom decorator wrapping a FastAPI endpoint, the route's parameters disappear from the OpenAPI docs and DI stops working.

### `functools.lru_cache` — Memoization

```python
from functools import lru_cache

@lru_cache(maxsize=128)
def expensive(n: int) -> int:
    ...  # computed once per unique n, then cached

# For methods on instances, use functools.cached_property instead
# lru_cache on methods causes memory leaks (holds reference to self)
```

> **💡 Senior Tip:** `get_rag_service()` in `rag/service.py` implements manual memoization with a module-level `_rag_service` global. `lru_cache` on a top-level function would be cleaner, but the manual pattern allows resetting during tests.

### Closures

A closure is a function that captures variables from its enclosing scope. `require_role` in `auth/dependencies.py` returns a closure:

```python
# auth/dependencies.py
def require_role(*roles: UserRole):
    async def check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role == UserRole.ADMIN:
            return current_user
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient role")
        return current_user
    return check   # check closes over `roles`
```

`check` captures `roles` from `require_role`'s scope. Each call to `require_role(UserRole.DOCTOR)` creates a new closure with a different `roles` tuple bound in.

---

## §6 Context Managers

A context manager controls setup and teardown around a block of code. `with` calls `__enter__` on entry, `__exit__` on exit (even if an exception fires).

### `contextlib.contextmanager` and `asynccontextmanager`

Writing a class with `__enter__`/`__exit__` is verbose. `contextlib` lets you write a generator-based context manager:

```python
from contextlib import contextmanager, asynccontextmanager

@contextmanager
def managed_resource():
    resource = acquire()    # setup
    try:
        yield resource      # body of `with` block executes here
    finally:
        release(resource)   # teardown, guaranteed to run

# Async version:
@asynccontextmanager
async def managed_async_resource():
    resource = await acquire_async()
    try:
        yield resource
    finally:
        await release_async(resource)
```

### FastAPI's `lifespan` — The Real Pattern

`main.py` uses exactly this:

```python
# main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: runs BEFORE the first request
    await init_db()
    setup_telemetry()
    yield
    # Shutdown: runs AFTER the last request, on SIGTERM/SIGINT
    # (nothing explicit here, but you'd close connection pools, flush spans, etc.)

app = FastAPI(title="MediAssist AI", lifespan=lifespan)
```

Before `lifespan`, FastAPI used `@app.on_event("startup")` / `@app.on_event("shutdown")`. Those are deprecated. The `lifespan` pattern is superior because:
1. Resources acquired in startup are automatically in scope for shutdown (closure)
2. It's a standard Python pattern, not FastAPI-specific API
3. Compatible with pytest's `AsyncClient` fixture via `ASGITransport`

> **💡 Senior Tip:** If `init_db()` raises during startup, the server exits immediately with a non-zero code — exactly the right behavior. You want fail-fast on startup, not silent degradation.

### `get_db` — Async Context Manager as Dependency

`database.py:get_db` is a yield-based async generator used as a FastAPI dependency:

```python
# database.py
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session       # FastAPI injects this into the endpoint
        except HTTPException:
            raise               # don't rollback on HTTP errors, re-raise
        except Exception as exc:
            logger.error("DB session error: %s", exc, exc_info=True)
            raise
        finally:
            await session.close()
```

`async with AsyncSessionLocal() as session` calls `session.__aenter__()` (which begins a transaction context) and `session.__aexit__()` on exit (which rolls back if there was an unhandled exception, or commits if clean). `finally: await session.close()` is defensive belt-and-suspenders.

---

## §7 Iterators, Generators, Async Generators

### Synchronous Generators

A generator function uses `yield` to produce values lazily:

```python
def chunker(text: str, size: int = 500):
    start = 0
    while start < len(text):
        yield text[start:start + size]
        start += size

# Memory: holds only ONE chunk in memory at a time
for chunk in chunker(huge_text):
    process(chunk)
```

`rag/service.py:_chunk_text` implements a sliding-window chunker manually (returns a list rather than a generator — an optimization opportunity covered in [§48](#48-honest-refactor-critique)).

### `yield from` — Generator Delegation

```python
def chain(*iterables):
    for it in iterables:
        yield from it   # delegates to sub-iterator; StopIteration propagates up

list(chain([1, 2], [3, 4]))  # [1, 2, 3, 4]
```

### Async Generators — The SSE Story

`agents/service.py:MedicalAgent.stream` is an `async def` with `yield` — an **async generator**:

```python
# agents/service.py
async def stream(
    self,
    message: str,
    conversation_history: list[dict],
) -> AsyncGenerator[str, None]:
    # ...agentic loop...
    for part in response.parts:
        if hasattr(part, "text") and part.text:
            for word in part.text.split(" "):
                yield word + " "
```

The caller in `agents/router.py` iterates it with `async for`:

```python
# agents/router.py
async def event_generator():
    async for chunk in agent.stream(data.message, history):
        yield f"data: {chunk}\n\n"   # SSE format
    yield "data: [DONE]\n\n"

return StreamingResponse(event_generator(), media_type="text/event-stream")
```

> **🔁 Dart Analogy:** `AsyncGenerator[str, None]` is Python's `Stream<String>`. `async for chunk in stream` is `await for (chunk in stream)` in Dart. The `yield` inside `async def` creates an `AsyncGenerator`; `yield` inside a regular `def` creates a `Generator`.

| Dart | Python | Returns |
|------|--------|---------|
| `Future<T>` | `async def f() -> T` (no yield) | Single value |
| `Stream<T>` | `async def f() -> AsyncGenerator[T, None]` (has yield) | Multiple values |
| `Iterable<T>` | `def f() -> Generator[T, None, None]` (has yield) | Lazy synchronous sequence |

---

## §8 Error Handling

### Exception Hierarchy

```
BaseException
├── SystemExit              # sys.exit() — never catch broadly
├── KeyboardInterrupt       # Ctrl+C — never swallow
├── GeneratorExit           # generator.close() called
└── Exception               # ← everything user code raises/catches
    ├── ValueError          # wrong value type ("hello" to int())
    ├── TypeError           # wrong type passed
    ├── KeyError            # missing dict key
    ├── AttributeError      # missing attribute
    ├── RuntimeError        # general runtime fault
    ├── OSError / IOError   # file/network errors
    ├── HTTPException       # FastAPI — maps to HTTP responses
    └── YourCustomException # domain exceptions
```

**Never** catch `BaseException` or `Exception` broadly without re-raising, logging, or handling every case. `auth/service.py` decodes JWT with:

```python
# auth/service.py
def decode_token(token: str) -> dict:
    return jose.jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
```

`jose.jwt.decode` raises `JWTError` on failure. The caller in `auth/dependencies.py:get_current_user` catches it:

```python
try:
    payload = decode_token(credentials.credentials)
except Exception:
    raise HTTPException(status_code=403, detail="Invalid token")
```

This broad `except Exception` is acceptable at a boundary (translating library errors to HTTP errors), but it masks library-specific error types. A senior refactor would catch `jose.JWTError` specifically.

### `raise ... from`

```python
try:
    result = db.execute(query)
except sqlalchemy.exc.OperationalError as exc:
    raise RuntimeError("Database unavailable") from exc
    #                                           ^^^^^^^^ chains exceptions
    # The original exc is stored in RuntimeError.__cause__
    # Traceback shows BOTH exceptions
```

`raise X from None` explicitly suppresses the chain (used when you deliberately don't want to show the original).

### FastAPI's `HTTPException` vs Domain Exceptions

`HTTPException` is FastAPI-specific and carries HTTP semantics (`status_code`, `detail`, `headers`). Domain exceptions should be pure Python, then translated at the boundary:

```python
# domain layer — no FastAPI import
class InsufficientRoleError(Exception):
    def __init__(self, required: list[str], actual: str):
        self.required = required
        self.actual = actual

# boundary layer (FastAPI)
@app.exception_handler(InsufficientRoleError)
async def handle_role_error(request, exc: InsufficientRoleError):
    return JSONResponse(status_code=403, content={"detail": f"Need {exc.required}, got {exc.actual}"})
```

`authz/policies.py` currently raises `HTTPException` directly inside `PolicyEngine` — a layering violation (the domain layer knows about HTTP). Covered in [§48](#48-honest-refactor-critique).

---

# Part II — Async Python

## §9 Sync vs Async Mental Model

### The Analogy That Actually Works

Dart's event loop and Python's `asyncio` event loop are architecturally identical. Both are single-threaded cooperative multitasking engines.

| Concept | Dart | Python |
|---------|------|--------|
| Event loop | `dart:async` event loop | `asyncio` event loop |
| Async function | `Future<T>` returning `async` fn | `async def` returning `Coroutine[T]` |
| Suspension point | `await` | `await` |
| Parallel futures | `Future.wait([f1, f2])` | `asyncio.gather(c1, c2)` |
| Background task | `unawaited(future)` | `asyncio.create_task(coro())` |
| Isolate (separate thread) | `Isolate.spawn(...)` | `loop.run_in_executor(...)` |
| Streams | `Stream<T>` | `AsyncGenerator[T, None]` |

### What "Cooperative" Means

In cooperative multitasking, tasks voluntarily yield control at `await` points. The event loop can only switch to another coroutine when the current one hits an `await`. There is no preemption.

```
Coroutine A: ────work────await──────────────────work──await─────
Coroutine B:                 ────work────await──────────────────
                             ^                  ^
                             │ event loop switches
```

If `Coroutine A` never hits `await` (a blocking call, CPU-bound loop), `Coroutine B` is completely starved. This is the **#1 async mistake** — covered in [§11](#11-async-def-vs-def-in-fastapi).

### When Python Needs Threads vs Async

```
┌─────────────────────────────────────────────────────┐
│ Type of work       │ Solution                       │
├────────────────────┼────────────────────────────────┤
│ I/O-bound async    │ async/await (no threads needed)│
│ I/O-bound sync lib │ run_in_executor (thread)       │
│ CPU-bound          │ ProcessPoolExecutor (process)  │
│ Blocking C ext     │ run_in_executor (thread)       │
└─────────────────────────────────────────────────────┘
```

In MediAssist, `bcrypt.hashpw` is CPU-bound and synchronous. FastAPI's `def` endpoint detection handles this (see [§11](#11-async-def-vs-def-in-fastapi)).

---

## §10 The Event Loop

### Coroutines, Tasks, Futures

```python
import asyncio

# A coroutine object — NOT yet running
async def greet(name: str) -> str:
    await asyncio.sleep(1)   # suspension point
    return f"Hello {name}"

coro = greet("Ahmed")    # creates coroutine object, doesn't run yet
# To run it:
result = await coro      # suspends current coroutine until greet finishes

# asyncio.Task wraps a coroutine and schedules it on the event loop
task = asyncio.create_task(greet("Ahmed"))  # starts running concurrently
result = await task

# asyncio.Future is a lower-level promise (rarely used directly)
future = asyncio.get_event_loop().create_future()
future.set_result("value")
result = await future   # "value"
```

> **🔁 Dart Analogy:** `Coroutine` = `Future<T>` that hasn't started yet. `asyncio.Task` = a running `Future`. `asyncio.Future` = `Completer<T>.future`. `await` is identical.

### `asyncio.gather` — Fan-Out Pattern

```python
import asyncio

async def fetch_user(user_id: str): ...
async def fetch_permissions(user_id: str): ...

# Sequential — 400ms if each takes 200ms
user = await fetch_user("123")
perms = await fetch_permissions("123")

# Concurrent — 200ms
user, perms = await asyncio.gather(
    fetch_user("123"),
    fetch_permissions("123"),
)
```

`gather` returns a list of results in the same order as the inputs, regardless of completion order. If any coroutine raises, `gather` cancels all others and re-raises by default.

### `asyncio.TaskGroup` (Python 3.11+) — Structured Concurrency Done Right

```python
async def process_documents(docs: list[str]):
    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(embed_and_store(doc)) for doc in docs]
    # all tasks guaranteed complete here; any exception cancels siblings
    results = [t.result() for t in tasks]
```

`TaskGroup` is superior to `gather` because it enforces structured concurrency — tasks can't outlive their scope. This is the Python equivalent of Dart's `FutureGroup` or Swift's `withTaskGroup`.

> **⚠️ Gotcha:** `TaskGroup` requires Python 3.11+. Check your deployment target. `asyncio.gather` is the 3.9/3.10-compatible equivalent (with slightly worse error propagation semantics).

### How the Event Loop Runs in Production

```
uvicorn main:app
    │
    └─ asyncio event loop (uvloop in production)
           │
           ├─ accept TCP connections (non-blocking)
           ├─ parse HTTP (httptools)
           ├─ dispatch to FastAPI ASGI app
           │       │
           │       ├─ run async endpoint coroutine
           │       ├─ await DB queries (aiosqlite)
           │       ├─ await LLM API calls (httpx)
           │       └─ stream response back
           └─ repeat
```

---

## §11 `async def` vs `def` in FastAPI

This is the section that separates beginners from experienced FastAPI engineers.

### What FastAPI Actually Does

FastAPI inspects every endpoint's signature. If it's `async def`, it `await`s the coroutine directly on the event loop thread. If it's `def`, it runs the function in a **threadpool executor** (via `asyncio.run_in_executor`).

```python
# FastAPI internal pseudocode (simplified):
if asyncio.iscoroutinefunction(endpoint):
    result = await endpoint(**params)
else:
    result = await loop.run_in_executor(None, functools.partial(endpoint, **params))
```

### The #1 Beginner Mistake

```python
# WRONG — blocks the entire event loop
@router.post("/chat")
async def chat(data: ChatRequest):
    # time.sleep is synchronous — holds the event loop hostage
    time.sleep(5)      # NEVER do this in async code
    return {"done": True}

# WRONG — requests.get is synchronous I/O
@router.post("/fetch")
async def fetch(url: str):
    response = requests.get(url)   # blocks event loop for the whole network call
    return response.json()

# CORRECT — use async I/O
@router.post("/fetch")
async def fetch(url: str):
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
    return response.json()

# CORRECT — sync CPU-bound work in a def endpoint (FastAPI threadpools it)
@router.post("/hash")
def hash_password_endpoint(password: str):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt())
```

### When to Use `def` vs `async def`

| Use `async def` when... | Use `def` when... |
|------------------------|-------------------|
| Awaiting DB queries | Pure CPU computation (bcrypt, JSON serialization) |
| Calling external APIs with httpx | Calling synchronous libraries with no async alternative |
| Streaming responses | Simple sync utilities |
| Awaiting LLM APIs | Tests that don't use the event loop |

> **💡 Senior Tip:** Making a `def` endpoint that calls an `async def` function doesn't work — you can't `await` inside a regular function. The correct approach: either make the endpoint `async def` too, or use `asyncio.run()` (which creates a new event loop — wrong inside an already-running loop). FastAPI's threadpool is the right escape hatch for sync-only libraries.

### In MediAssist

`auth/service.py:hash_password` and `verify_password` call `bcrypt` synchronously. They're called from `async def` endpoints in `auth/router.py` — this holds the event loop briefly. Under low load this is fine; under high load, these should be moved to `def` endpoints or wrapped in `run_in_executor`. The bcrypt work factor (`bcrypt.gensalt()` default rounds=12) takes ~100ms — significant blocking time.

---

## §12 Structured Concurrency

### Cancellation

When you cancel a task, Python injects a `CancelledError` at the next `await` point:

```python
task = asyncio.create_task(long_operation())
await asyncio.sleep(1)
task.cancel()
try:
    await task
except asyncio.CancelledError:
    print("task was cancelled")
    # cleanup here
```

If your coroutine catches `CancelledError` without re-raising, the cancellation is swallowed — the task acts as if it's done but the calling code is stuck. Always re-raise `CancelledError`:

```python
async def careful_operation():
    try:
        result = await some_io()
    except asyncio.CancelledError:
        await cleanup()   # do cleanup
        raise             # MUST re-raise
    return result
```

### `asyncio.timeout` (Python 3.11+)

```python
import asyncio

async def call_llm(prompt: str) -> str:
    async with asyncio.timeout(30.0):   # 30 second timeout
        return await anthropic_client.messages.create(...)
    # raises asyncio.TimeoutError if exceeded
```

For 3.9/3.10 compatibility: `asyncio.wait_for(coro, timeout=30.0)`.

`agents/service.py` currently has no timeout on Gemini calls — a production risk. An unresponsive Gemini API would hold the connection open indefinitely.

---

## §13 Async I/O in Practice

### `httpx.AsyncClient` — The Async `requests`

```python
import httpx

# WRONG — creates a new client per request (connection pool not reused)
async def fetch():
    async with httpx.AsyncClient() as client:
        response = await client.get("https://api.example.com")

# CORRECT for production — shared client at module level
_client: httpx.AsyncClient | None = None

async def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=30.0)
    return _client
```

`httpx` vs `requests`:

| | `requests` | `httpx` |
|--|-----------|---------|
| Async support | No | Yes (`AsyncClient`) |
| HTTP/2 | No | Yes |
| Type hints | Partial | Full |
| Used in tests | Yes (via pytest-httpx) | Yes |
| Streams | Partial | Full async streaming |

### `aiosqlite` — Async SQLite

`aiosqlite` wraps SQLite's synchronous C library in a background thread, exposing an `async`/`await` API. SQLAlchemy's `aiosqlite` dialect uses this under the hood. Your connection string `sqlite+aiosqlite:///./mediassist.db` in `config.py` wires these together.

```python
# What SQLAlchemy+aiosqlite does internally:
import aiosqlite

async with aiosqlite.connect("mediassist.db") as conn:
    async with conn.execute("SELECT * FROM users") as cursor:
        rows = await cursor.fetchall()
```

### Streaming LLM Responses — Anthropic

`agents/service.py` doesn't use Anthropic for generation (it uses Gemini), but `rag/service.py` uses Anthropic for embeddings. The streaming pattern for Anthropic generation looks like:

```python
from anthropic import AsyncAnthropic

client = AsyncAnthropic(api_key=settings.anthropic_api_key)

async def stream_response(prompt: str):
    async with client.messages.stream(
        model="claude-opus-4-7",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        async for text in stream.text_stream:
            yield text
```

### Streaming LLM Responses — Gemini

`agents/service.py:MedicalAgent.stream` uses `chat.send_message_async` which returns a complete response (no streaming from Gemini in this implementation — the word-by-word yield is simulated by splitting on spaces):

```python
# agents/service.py — simulated streaming
for part in response.parts:
    if hasattr(part, "text") and part.text:
        for word in part.text.split(" "):
            yield word + " "
```

True Gemini streaming would use `model.generate_content_async(prompt, stream=True)` and iterate `async for chunk in response`.
