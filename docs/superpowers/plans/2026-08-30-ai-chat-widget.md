# AI Chat Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a customer-facing AI chat widget, backed by the Claude API, that answers questions about real salons and services and is available on every public page.

**Architecture:** A new public `POST /chat` FastAPI endpoint grounds Claude Haiku 4.5 in the live salon/service dataset and enforces a per-IP rate limit; a new floating `ChatWidget` React component, mounted once in the root layout, talks to that endpoint.

**Tech Stack:** FastAPI, SQLAlchemy, `anthropic` Python SDK (1.2.0), Next.js 14, `lucide-react` (already a dependency).

**Spec:** docs/superpowers/specs/2026-08-30-ai-chat-widget-design.md

## Global Constraints

- Model: `claude-haiku-4-5`, `max_tokens=1024`.
- Rate limit: 10 requests per 60-second window per client IP, in-process (no new dependency, no cross-instance coordination).
- The Anthropic API key lives only in `backend/.env` (gitignored) as `ANTHROPIC_API_KEY` — never hardcoded in source, never committed.
- No booking creation via chat; the system prompt must explicitly tell the model it cannot create bookings.
- No conversation persistence — chat history lives only in frontend React state, capped to the last 10 messages sent per request.
- No streaming — single request/response per message.
- No new frontend npm dependency (`lucide-react` already installed).

---

### Task 1: Backend config, dependency, and rate limiter

**Files:**
- Modify: `backend/app/config.py`
- Modify: `backend/requirements.txt`
- Create: `backend/app/chat_rate_limit.py`
- Test: `backend/tests/test_chat_rate_limit.py`

**Interfaces:**
- Produces: `Settings.anthropic_api_key: str` (empty-string default, same pattern as `resend_api_key`). `is_rate_limited(client_ip: str) -> bool` and the module-level `_requests: dict[str, list[float]]` dict (tests reset it directly between runs) in `app.chat_rate_limit` — consumed by Task 2.

- [ ] **Step 1: Add `anthropic_api_key` to `Settings`**

In `backend/app/config.py`, add a new field to the `Settings` class, directly below the existing `resend_api_key: str = ""` line:

```python
    anthropic_api_key: str = ""
```

- [ ] **Step 2: Add the `anthropic` dependency**

Append to `backend/requirements.txt`:

```
anthropic==1.2.0
```

Run: `cd backend && source .venv/bin/activate && pip install -r requirements.txt`
Expected: installs cleanly (already installed in this environment during planning, so this should be a no-op confirming the pin matches).

- [ ] **Step 3: Write the failing test for the rate limiter**

Create `backend/tests/test_chat_rate_limit.py`:

```python
from app.chat_rate_limit import _requests, is_rate_limited


def test_allows_up_to_ten_requests_then_blocks():
    _requests.clear()
    client_ip = "1.2.3.4"

    for _ in range(10):
        assert is_rate_limited(client_ip) is False

    assert is_rate_limited(client_ip) is True


def test_different_ips_are_tracked_independently():
    _requests.clear()

    for _ in range(10):
        assert is_rate_limited("1.1.1.1") is False

    assert is_rate_limited("1.1.1.1") is True
    assert is_rate_limited("2.2.2.2") is False
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd backend && source .venv/bin/activate && pytest tests/test_chat_rate_limit.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.chat_rate_limit'`

- [ ] **Step 5: Implement the rate limiter**

Create `backend/app/chat_rate_limit.py`:

```python
import time
from collections import defaultdict

_WINDOW_SECONDS = 60
_MAX_REQUESTS = 10
_requests: dict[str, list[float]] = defaultdict(list)


def is_rate_limited(client_ip: str) -> bool:
    now = time.time()
    timestamps = _requests[client_ip]
    cutoff = now - _WINDOW_SECONDS
    while timestamps and timestamps[0] < cutoff:
        timestamps.pop(0)
    if len(timestamps) >= _MAX_REQUESTS:
        return True
    timestamps.append(now)
    return False
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend && source .venv/bin/activate && pytest tests/test_chat_rate_limit.py -v`
Expected: PASS (2 passed)

- [ ] **Step 7: Commit**

```bash
git add backend/app/config.py backend/requirements.txt backend/app/chat_rate_limit.py backend/tests/test_chat_rate_limit.py
git commit -m "feat: add anthropic_api_key setting and per-IP chat rate limiter"
```

---

### Task 2: `POST /chat` endpoint

**Files:**
- Create: `backend/app/routers/chat.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_chat.py`

**Interfaces:**
- Consumes: `is_rate_limited(client_ip: str) -> bool` from `app.chat_rate_limit` (Task 1); `Settings.anthropic_api_key` from `app.config.settings` (Task 1); existing `Salon`, `Service` models from `app.models`; existing `get_db` dependency from `app.database`.
- Produces: `POST /chat` route returning `{"reply": str}` on success, `429` on rate limit, `502` on upstream Anthropic failure. The module-level `client` object in `app.routers.chat` (an `anthropic.Anthropic` instance) is the patch target for tests.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_chat.py`:

```python
from unittest.mock import MagicMock, patch

import anthropic

from app.chat_rate_limit import _requests
from app.models import Salon, Service


def _mock_response(text: str):
    block = MagicMock()
    block.type = "text"
    block.text = text
    response = MagicMock()
    response.content = [block]
    return response


def test_chat_returns_reply_grounded_in_active_salons(client, db_session):
    active = Salon(
        slug="glamour-lk", name="Glamour Salon", category="unisex", address="Addr", city="Colombo", status="active"
    )
    suspended = Salon(
        slug="closed-salon", name="Closed Salon", category="unisex", address="Addr", city="Galle", status="suspended"
    )
    db_session.add_all([active, suspended])
    db_session.commit()
    db_session.add(Service(salon_id=active.id, name="Haircut", category="hair", price=1500.0, duration_minutes=30))
    db_session.commit()

    _requests.clear()
    with patch(
        "app.routers.chat.client.messages.create",
        return_value=_mock_response("Glamour Salon offers a Haircut for Rs. 1500."),
    ) as mock_create:
        response = client.post("/chat", json={"message": "What salons do haircuts?", "history": []})

    assert response.status_code == 200
    assert response.json() == {"reply": "Glamour Salon offers a Haircut for Rs. 1500."}

    system_prompt = mock_create.call_args.kwargs["system"]
    assert "Glamour Salon" in system_prompt
    assert "Closed Salon" not in system_prompt


def test_chat_returns_502_on_anthropic_failure(client, db_session):
    _requests.clear()
    error = anthropic.APIConnectionError(request=MagicMock())
    with patch("app.routers.chat.client.messages.create", side_effect=error):
        response = client.post("/chat", json={"message": "Hello", "history": []})

    assert response.status_code == 502
    assert response.json() == {"detail": "The assistant is temporarily unavailable."}


def test_chat_rate_limits_after_ten_requests(client, db_session):
    _requests.clear()
    with patch("app.routers.chat.client.messages.create", return_value=_mock_response("ok")):
        for _ in range(10):
            response = client.post("/chat", json={"message": "hi", "history": []})
            assert response.status_code == 200

        response = client.post("/chat", json={"message": "hi", "history": []})

    assert response.status_code == 429
    assert response.json() == {"detail": "Too many messages — please wait a moment."}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && source .venv/bin/activate && pytest tests/test_chat.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.routers.chat'`

- [ ] **Step 3: Implement the endpoint**

Create `backend/app/routers/chat.py`:

```python
import anthropic
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.chat_rate_limit import is_rate_limited
from app.config import settings
from app.database import get_db
from app.models import Salon, Service

router = APIRouter(tags=["chat"])

client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

MODEL = "claude-haiku-4-5"


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str


def build_system_prompt(db: Session) -> str:
    salons = db.query(Salon).filter(Salon.status == "active").all()
    lines = [
        "You are a helpful assistant for Ceylon Bellezza, a Sri Lankan salon booking website. "
        "Answer questions ONLY using the salon data below. If you don't know something from this "
        "data, say so honestly instead of guessing. When relevant, point the user to the named "
        "salon's page so they can book there themselves — you cannot create a booking.",
        "",
        "Salons:",
    ]
    for salon in salons:
        services = db.query(Service).filter(Service.salon_id == salon.id).all()
        service_lines = (
            ", ".join(f"{s.name} ({s.category}, Rs. {s.price})" for s in services) or "no services listed"
        )
        lines.append(f"- {salon.name} ({salon.category}, {salon.city}): {service_lines}")
    return "\n".join(lines)


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    if is_rate_limited(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many messages — please wait a moment."
        )

    system_prompt = build_system_prompt(db)
    messages = [{"role": m.role, "content": m.content} for m in payload.history[-10:]]
    messages.append({"role": "user", "content": payload.message})

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=1024,
            system=system_prompt,
            messages=messages,
        )
    except (anthropic.APIStatusError, anthropic.APIConnectionError):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="The assistant is temporarily unavailable."
        )

    reply = "".join(block.text for block in response.content if block.type == "text")
    return ChatResponse(reply=reply)
```

- [ ] **Step 4: Register the router**

In `backend/app/main.py`, add `chat` to the import line:

```python
from app.routers import auth, bookings_dashboard, chat, content, gallery, leads, public, salons, services, staff
```

and add, alongside the other `app.include_router(...)` calls:

```python
app.include_router(chat.router)
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && source .venv/bin/activate && pytest tests/test_chat.py -v`
Expected: PASS (3 passed)

- [ ] **Step 6: Run the full backend test suite to confirm nothing else broke**

Run: `cd backend && source .venv/bin/activate && pytest -q`
Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/chat.py backend/app/main.py backend/tests/test_chat.py
git commit -m "feat: add POST /chat endpoint grounded in live salon data"
```

---

### Task 3: `ChatWidget` frontend component

**Files:**
- Create: `frontend/components/ChatWidget.tsx`
- Modify: `frontend/app/layout.tsx`

**Interfaces:**
- Consumes: `POST {NEXT_PUBLIC_API_URL}/chat` (Task 2) — request `{ message: string, history: {role: "user"|"assistant", content: string}[] }`, response `{ reply: string }` on 2xx or `{ detail: string }` on error.
- Produces: `ChatWidget()` default export, no props — consumed by Task 3's own `layout.tsx` change (no other task depends on it).

- [ ] **Step 1: Create `frontend/components/ChatWidget.tsx`**

```tsx
"use client";

import { useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const history = messages.slice(-10);
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const detail = body?.detail ?? "Sorry, something went wrong — try again.";
        setMessages((prev) => [...prev, { role: "assistant", content: detail }]);
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: body.reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong — try again." }]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-champagne text-ink shadow-floating"
        aria-label="Open chat"
      >
        <MessageCircle size={24} strokeWidth={2.5} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 flex h-[480px] w-[340px] flex-col overflow-hidden rounded-xl bg-white shadow-floating">
      <div className="flex items-center justify-between border-b border-hairline bg-accent px-4 py-3">
        <p className="font-serif text-lg font-semibold text-white">Ask Ceylon.lk</p>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="text-white">
          <X size={20} strokeWidth={2.5} />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && <p className="text-sm text-taupe">Ask me about salons, services, or prices.</p>}
        {messages.map((message, index) => (
          <div
            key={index}
            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              message.role === "user" ? "ml-auto bg-accent text-white" : "bg-surface text-ink"
            }`}
          >
            {message.content}
          </div>
        ))}
        {loading && <div className="max-w-[85%] rounded-lg bg-surface px-3 py-2 text-sm text-taupe">...</div>}
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-hairline p-3">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Type a message..."
          className="min-h-[40px] flex-1 rounded-md border border-hairline px-3 text-sm text-ink placeholder:text-taupe focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white disabled:opacity-50"
          aria-label="Send message"
        >
          <Send size={16} strokeWidth={2.5} />
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Mount it in `frontend/app/layout.tsx`**

Replace the full file with:

```tsx
import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import ChatWidget from "@/components/ChatWidget";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ceylon Bellezza",
  description: "Find and book the best salons near you.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${dmSans.variable}`}>
      <body className="min-h-screen bg-bg font-sans text-ink">
        <ToastProvider>
          {children}
          <ChatWidget />
        </ToastProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify types**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS, no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/ChatWidget.tsx frontend/app/layout.tsx
git commit -m "feat: add floating AI chat widget to every public page"
```

---

### Task 4: Manual verification (no code)

- [ ] **Step 1:** Confirm `backend/.env` has a real `ANTHROPIC_API_KEY` set (out-of-band, not part of this repo's history).
- [ ] **Step 2:** Start the backend (`cd backend && source .venv/bin/activate && uvicorn app.main:app --port 8002`) and frontend (`cd frontend && npm run dev`) against seeded data.
- [ ] **Step 3:** On the landing page, click the floating chat bubble bottom-right; confirm the panel opens with the placeholder prompt text.
- [ ] **Step 4:** Ask a question about a real seeded salon (e.g. "What does Royal Barber Co. offer?"); confirm a grounded, accurate answer referencing real seeded services/prices.
- [ ] **Step 5:** Ask something outside the data (e.g. "What's the weather today?"); confirm the assistant says it doesn't know rather than inventing an answer.
- [ ] **Step 6:** Navigate to `/search` and a salon profile page; confirm the widget is present and its state (open/closed, message history) persists across client-side navigation within the same page load.
- [ ] **Step 7:** Send 11 messages in under a minute; confirm the 11th shows the rate-limit message instead of a normal reply.
