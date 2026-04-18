# Logging Design — MediAssist Frontend

**Date:** 2026-04-18
**Scope:** Development-only request/response and auth logging

## Goal

Add comprehensive dev-only logging so every HTTP request, response, auth event, and streaming SSE event is visible in the browser DevTools console. No-ops in production.

## Architecture

### `src/lib/logger.ts` — Logger Utility

A single exported `logger` object. All methods check `process.env.NODE_ENV !== 'production'` and are no-ops in production.

**Methods:**

| Method | Purpose |
|--------|---------|
| `logger.request(method, url, body?)` | Outgoing HTTP request — logs method, URL, body |
| `logger.response(method, url, status, body?)` | Incoming HTTP response — logs status, body |
| `logger.stream(event, data?)` | SSE stream event — chunk, tool-call, done, error, aborted |
| `logger.auth(event, detail?)` | Auth lifecycle — tokens-set, tokens-cleared, token-read, token-refresh, session-expired |

Uses `console.group` / `console.groupEnd` with colored labels (`→` for requests, `←` for responses) for readable DevTools output.

## Instrumentation Points

### `src/lib/api.ts`

- `fetchWithAuth`: log request before fetch, log response after (method, url, status, body)
- Token refresh flow: log `token-refresh` start, success, and failure
- Session expiry redirect: log `session-expired`

### `src/lib/auth.ts`

- `setTokens`: log `tokens-set`
- `clearTokens`: log `tokens-cleared`
- `getAccessToken` / `getRefreshToken`: log `token-read`

### `src/hooks/useStreamingChat.ts`

- Before SSE fetch: log request (POST, url, body)
- Each SSE chunk received: log `stream chunk`
- Tool call events (`[Using tool:`): log `stream tool-call`
- `[DONE]` signal: log `stream done`
- `[ERROR]` signal: log `stream error`
- AbortError catch: log `stream aborted`

## Constraints

- **Dev-only:** All log calls are no-ops when `NODE_ENV === 'production'`
- **No new dependencies:** Uses only browser `console` APIs
- **No sensitive data exposure concern in prod:** Logger is fully disabled in production builds
- **Response body logging:** Bodies are cloned/consumed carefully to avoid breaking the response stream
