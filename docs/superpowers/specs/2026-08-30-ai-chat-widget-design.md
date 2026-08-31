# AI Chat Widget — Design Spec

**Goal:** Add a customer-facing AI chat widget to Ceylon Bellezza that answers questions about real salons and services using the Claude API, available on every public page.

**Non-goals:**
- No booking creation via chat — the assistant answers questions and points the user to the relevant salon page; it never calls the booking API on the user's behalf.
- No salon-owner-facing assistant — customer-facing only for this phase.
- No conversation persistence — each browser session's chat history lives in client-side React state only; nothing is stored server-side or in the database.
- No streaming responses — a single request/response per message, matching this repo's existing (non-streaming) API conventions.
- No authentication — the widget is available to anonymous visitors, same as the rest of the public site.

## Architecture

Two additive pieces, no changes to existing routes:

1. **Backend**: a new public `POST /chat` endpoint that grounds Claude's answers in the live salon/service dataset and is rate-limited per IP.
2. **Frontend**: a new floating `ChatWidget` component mounted once in the root layout, so it appears on every page without per-page wiring.

### Backend: `POST /chat`

New file `backend/app/routers/chat.py`, registered in `main.py` alongside the other routers.

Request: `{ "message": str, "history": [{"role": "user" | "assistant", "content": str}] }` — `history` is the prior turns of the current widget session, capped by the frontend to the last 10 entries before sending.

The handler:
1. Applies the per-IP rate limiter (see below) before doing anything else; on limit exceeded, returns `429` with `{"detail": "Too many messages — please wait a moment."}`.
2. Queries the DB for all active salons and their services (same `Salon`/`Service` models the public `/salons` endpoints already use), and serializes them into a compact system-prompt block: for each active salon, its name, city, category, and each service's name/category/price. This is fetched fresh on every request — the dataset is small (under a few dozen salons), so no caching layer is needed.
3. Calls `client.messages.create(model="claude-haiku-4-5", max_tokens=1024, system=<grounding text + instructions>, messages=history + [{"role": "user", "content": message}])`. The system prompt instructs Claude to answer only from the given salon data, say it doesn't know rather than invent a salon/price, and suggest visiting the relevant salon's page (by name) when relevant — never claim it can create a booking itself.
4. On success, returns `{"reply": <the response's text content>}`.
5. On any Anthropic SDK error (`RateLimitError`, `APIStatusError`, `APIConnectionError`, etc.), catches it, logs it server-side, and returns a `502` with `{"detail": "The assistant is temporarily unavailable."}` — never leaks the raw SDK exception to the client.

**Rate limiter**: a small in-process helper (`backend/app/chat_rate_limit.py`), a plain `dict[str, list[float]]` mapping client IP (`request.client.host`) to a list of recent request timestamps, pruned on each check. Limit: 10 requests per 60-second window per IP. This is process-local (won't coordinate across multiple backend workers/instances), which is an accepted limitation for this phase — the goal is blocking casual scripted abuse on a single small deployment, not a distributed-systems-grade limiter.

### Config

`backend/app/config.py`: add `anthropic_api_key: str = ""` to `Settings`, following the exact pattern of the existing `resend_api_key`/`google_maps_api_key` fields.

`backend/requirements.txt`: add `anthropic==<latest stable 1.x>` (resolved at implementation time via `pip install anthropic` and pinned to whatever version that installs, matching this repo's convention of pinning every dependency to an exact version).

The actual key value is written to `backend/.env` (confirmed `.gitignore`d) only — never appears in any file that gets committed, and the client is constructed as `anthropic.Anthropic(api_key=settings.anthropic_api_key)`.

### Frontend: `ChatWidget.tsx`

New file `frontend/components/ChatWidget.tsx`, `"use client"`. Local state: `messages: {role: "user" | "assistant", content: string}[]`, `input: string`, `open: boolean`, `loading: boolean`.

- Collapsed state: a circular floating button, bottom-right, fixed position, champagne background, a chat-bubble icon (from the already-installed `lucide-react`).
- Expanded state: a panel (white, `shadow-floating`, rounded corners) with a scrollable message list (user messages right-aligned/`bg-accent`, assistant messages left-aligned/`bg-surface`), a text input, and a send button.
- On send: appends the user message locally, POSTs `{ message, history: <last 10 messages before this one> }` to `${API_URL}/chat`, appends the assistant's reply on success. Shows a loading indicator (reusing the existing `Skeleton`-style pulsing pattern, or a simple "..." bubble) while awaiting the response.
- On error (non-2xx or network failure): appends a local, client-only assistant-styled message reading the server's `detail` string if present, otherwise a generic "Sorry, something went wrong — try again." This error message is never sent back to the API as part of `history`.

Mounted once in `frontend/app/layout.tsx`, inside `<ToastProvider>`, so every page gets it without individual page changes.

## Error Handling

- Rate-limit (429) and upstream-API-failure (502) cases are both handled server-side with clean, generic JSON error bodies — no stack traces or SDK internals ever reach the client.
- The frontend distinguishes no case specially beyond showing the server's message when present; a network-level failure (fetch throws) falls back to the generic client-side message.
- The widget never blocks or interferes with the rest of the page — it's a fixed-position overlay, not a modal, and has no effect on booking, search, or navigation flows.

## Testing

- Backend: new `backend/tests/test_chat.py` — mocks `anthropic.Anthropic.messages.create` (via `unittest.mock`, consistent with this repo's existing test conventions) to verify: a normal request returns `{"reply": ...}` with the mocked text; the system prompt passed to the mock contains the names of seeded active salons (grounding actually happens) and excludes any seeded *suspended* salon (mirrors the existing `test_list_active_salons_excludes_suspended` pattern); a simulated Anthropic SDK exception results in a 502 with the generic detail message; and a rate-limit test that fires 11 requests from the same test client within the window and asserts the 11th returns 429.
- Frontend: no automated tests, per this repo's established convention. Manual verification: open the widget on the landing page, `/search`, and a salon profile page, send a message about a real seeded salon and confirm a grounded answer, send enough messages quickly to trigger the 429 path and confirm the widget shows a sensible message, and confirm the widget's open/closed state and message history persist correctly across a single page's lifetime (not required to persist across a full page reload, since there is no server-side storage).

## Self-Review Notes

- **Spec coverage**: all decisions from brainstorming (customer-facing, grounded Q&A only, no booking via chat, global floating widget, per-IP rate limiting, Haiku 4.5) are reflected in the architecture above.
- **Placeholder scan**: no TBD/TODO. The exact `anthropic` package version is deliberately left to be resolved at implementation time (whatever `pip install anthropic` currently resolves), consistent with how this repo's other dependencies were originally pinned — not a placeholder, a documented resolution step.
- **Internal consistency**: the "never claim it can book" instruction in the system prompt (Architecture section) matches the stated non-goal (no booking creation via chat).
- **Scope check**: one cohesive feature (grounded chat endpoint + widget), sized similarly to other single-plan features in this repo.
- **Ambiguity check**: rate-limit numbers (10 req/60s), model, message-history cap (10 turns), and error-response shapes are stated concretely.
