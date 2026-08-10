# LibTaste web application

React and TypeScript single-page application for the public LibTaste landing surface, Steam authentication, Steam
profile and library management, pairwise game comparisons, and protected product routes.

## Development

From the repository root:

```powershell
npm ci
npm run dev --workspace apps/web
```

Vite serves the app and proxies `/api` to `LIBTASTE_API_PROXY_ORIGIN`. The proxy defaults to
`http://localhost:8080`, so development does not depend on a sibling API checkout path.

The browser loads `/config.json` before mounting the application. Local defaults live in `public/config.json`:

```json
{
  "apiBaseUrl": "http://localhost:8080/api/v1",
  "webClientId": "libtaste-web-local",
  "environmentLabel": "Local"
}
```

`apiBaseUrl` and `webClientId` are required and non-secret. `environmentLabel` is optional. The callback URI is always
derived as the current browser origin plus `/auth/callback`; it is never accepted from runtime configuration.

## Authentication and API boundary

- Steam sign-in uses a cryptographically random one-time PKCE verifier and S256 challenge.
- Only allowlisted protected paths are retained as post-login destinations.
- Access tokens exist only inside the in-memory `SessionManager`.
- Cookie-backed rotation includes credentials and echoes the `libtaste_csrf` cookie in `X-CSRF-Token`.
- Concurrent and delayed expired-token responses share one rotation operation.
- Session loss clears user-scoped TanStack Query caches while public cache entries can remain.
- User-visible errors expose only safe Problem Details fields; request IDs stay inside expandable support details.

OpenAPI types are generated from `openapi/openapi.yaml`:

```powershell
npm run openapi:generate
npm run openapi:check
```

The check fails with the regeneration command if the committed representation is stale.

## Steam profile and library

Authenticated routes share a persistent Steam profile and library-synchronization summary. Active durable jobs poll
with bounded backoff, pause in hidden documents, and stop after success, failure, or sign-out. The Library route:

- explains private or unavailable Steam game details and links to official Steam privacy guidance;
- supports one-at-a-time manual synchronization with safe cooldown and Problem Details feedback;
- appends opaque cursor pages in server order while retaining successful content after later failures;
- renders artwork lazily and uses off-viewport containment for pages of up to 100 games; and
- changes Default, Include, or Exclude eligibility without replacing the displayed server-confirmed state until the API
  succeeds.

## Pairwise comparisons

The protected Compare route restores the exact server-issued left/right pair and submits `LEFT_WIN`, `RIGHT_WIN`,
`DRAW`, or `SKIP` immediately. Outcome controls lock synchronously, uncertain requests can only retry the identical
comparison ID and outcome, and successful submissions briefly announce the result before requesting the next pair.

Keyboard shortcuts are L for left, R for right, D for draw, and S for skip. They remain inactive when another
interactive or text-entry control has focus. Expired or conflicting pairs are discarded, and allocation failures expose
distinct synchronization, eligibility, rate-limit, and no-pair recovery states using stable Problem Details types.

## Verification

```powershell
npm run format
npm run lint
npm run typecheck
npm run test
npm run coverage
npm run build
npm run e2e
```

Coverage thresholds are 80% for statements, branches, functions, and lines. Playwright projects cover Chromium,
Firefox, WebKit, mobile Chrome, and mobile Safari with deterministic network interception.

## Production container

Build from the repository root:

```powershell
docker build --file apps/web/Dockerfile --tag libtaste-web .
docker run --rm --publish 8080:8080 `
  --env LIBTASTE_API_BASE_URL=https://api.example.com/api/v1 `
  --env LIBTASTE_WEB_CLIENT_ID=libtaste-web `
  --env LIBTASTE_ENVIRONMENT_LABEL=Production `
  libtaste-web
```

The image writes non-secret runtime config at container startup and serves it without caching. Nginx provides SPA route
fallback, gzip compression, a `/healthz` endpoint, immutable hashed assets, CSP, and browser security headers.

To probe a running container:

```powershell
$env:LIBTASTE_CONTAINER_URL = "http://127.0.0.1:8080"
node apps/web/scripts/verify-container.mjs
```
