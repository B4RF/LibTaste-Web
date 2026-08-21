# LibTaste web application

React and TypeScript single-page application for the public LibTaste landing surface, Steam authentication, Steam
profile and library management, pairwise game comparisons, personalized recommendations, personal, Steam-friend, and
global game leaderboards, and account/security controls.

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
- Cookie-backed rotation includes credentials, echoes the `libtaste_csrf` cookie in `X-CSRF-Token`, and aborts after a
  ten-second deadline.
- Concurrent and delayed expired-token responses share one bounded rotation operation. Confirmed session loss clears
  protected state, while transient failures hide protected content and offer an explicit session-check retry.
- Session loss clears user-scoped TanStack Query caches while public cache entries can remain.
- User-visible errors expose only safe Problem Details fields; request IDs stay inside expandable support details.

OpenAPI types are generated from `openapi/openapi.yaml`:

```powershell
npm run openapi:generate
npm run openapi:check
```

The check fails with the regeneration command if the committed representation is stale.

## Steam profile and library

Authenticated routes place the external Steam profile link first, Library second, and Account & Security last in a
compact profile disclosure. Only active or failed library synchronization occupies persistent shell space. Active
durable jobs poll with bounded backoff, pause in hidden documents, and stop after success, failure, or sign-out. The
Library route:

- explains private or unavailable Steam game details and links to official Steam privacy guidance;
- supports one-at-a-time manual synchronization with safe cooldown and Problem Details feedback;
- sends URL-addressable name, effective-eligibility, and explicit-override filters to the API and retains them for every
  opaque cursor request;
- appends opaque cursor pages in server order while retaining successful content after later failures;
- renders artwork lazily, links available artwork to the exact Steam store page in a new tab, and uses off-viewport
  containment for pages of up to 100 games; and
- changes Default, Include, or Exclude eligibility without replacing the displayed server-confirmed state until the API
  succeeds.

## Pairwise comparisons

The protected Compare route restores the exact server-issued left/right pair and submits `LEFT_WIN`, `RIGHT_WIN`,
`DRAW`, or `SKIP` immediately. Outcome controls lock synchronously, uncertain requests can only retry the identical
comparison ID and outcome, and successful submissions briefly announce the result before requesting the next pair.
The previous pair remains in a locked, stable stage while that next allocation is pending, avoiding a collapse-induced
scroll jump. Either displayed game can also be excluded directly: Compare confirms the server-backed `EXCLUDED`
eligibility update, retires the current pair as `SKIP` without a rating change, and loads the next pair. Uncertain
exclusion and retirement requests expose only their safe identical retry. Comparison metadata, ordinary expiry, and
shortcut help use accessible disclosures below the controls. Large landscape artwork uses contained scaling to avoid
cropping, with compact Draw and Skip controls stacked between the two game choices. Comparison outcomes remain visually
stronger than the one-time-per-game Exclude utilities, and each game offers a quiet link to its exact Steam store page
in a new tab.

Keyboard shortcuts use the familiar WASD layout: W for draw, A for left, S for skip, and D for right. They remain inactive when another
interactive or text-entry control has focus. Expired or conflicting pairs are discarded, and allocation failures expose
distinct synchronization, eligibility, rate-limit, and no-pair recovery states using stable Problem Details types.

## Game leaderboards

The public Global route reads the contributed-games leaderboard without restoring a session, sending credentials, or
creating user-scoped cache data. The protected My Ranking route displays every current game plus ranked historical
games automatically, without a client-side history filter. Both leaderboards:

- preserve the API's rank and entry order while appending opaque cursor pages;
- retain completed pages and retry the same cursor after a later-page failure;
- distinguish loading, empty, rate-limited, retry, and terminal states;
- render lazy artwork, status, evidence counts, and locale-aware scores with at most two fractional digits in responsive
  semantic tables; and
- give a concise score distinction up front while keeping detailed status and non-comparability help in a disclosure;
- link every game name to its exact official Steam store page in a safe new tab.

Friend leaderboard sharing is disabled by default and controlled from Account & Security. Enabling it allows a user to
discover current Steam friends who also opted in and open their deliberately scoreless ranked-game order. Steam friends
are fetched only when a friend feature is opened; successful relationship data is cached by the API for no more than
15 minutes. Friend pages expose only opaque route identifiers, display name, optional Steam profile presentation, and
ranked game order. Disabling sharing immediately cancels and removes friend data from the browser cache.
When Steam reports that the signed-in user's friend list is private, the Friends route explains how to open Steam's
Profile, Edit Profile, and Privacy Settings controls, set Friends List to Public, follow official Steam privacy help,
and retry discovery.

## Game recommendations

The protected Recommendations route requests the API-default personalized result set without pagination or a count
override. It preserves server order and explains predicted personal rank, similar-game and anonymous-player sources,
applicable support counts, and item seed games without exposing raw model scores or other-user evidence.

Successful results remain fresh in the private user-scoped cache for 60 seconds. Completed comparisons, library
eligibility changes, and successful library synchronization invalidate them; session clearing cancels and removes them
with other protected data. Distinct successful empty states explain insufficient personal evidence, limited rating
variation, insufficient community evidence, or an exhausted eligible catalog.

## Account and security

The protected Account & Security route (kept at `/settings`) controls reciprocal friend-leaderboard sharing, can end the
current browser session, explicitly confirm revocation of every LibTaste session, or permanently delete the LibTaste
account after exact `DELETE` confirmation. Destructive requests use bearer, credential, and CSRF protection and are
sent only once; an uncertain deletion checks ordinary cookie-backed session state without automatically repeating the
request.

Confirmed session clearing cancels protected queries and polling, removes user-scoped profile, library, comparison, and
personal-leaderboard caches, clears transient PKCE data, and leaves only non-sensitive public caches such as the global
leaderboard. Protected history then passes through the normal signed-out route guard.

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

The image writes non-secret runtime config at container startup and serves it without caching. Nginx makes browsers
revalidate the HTML application shell, keeps hashed assets immutable, and provides SPA route fallback, gzip
compression, a `/healthz` endpoint, CSP, and browser security headers.

To probe a running container:

```powershell
$env:LIBTASTE_CONTAINER_URL = "http://127.0.0.1:8080"
node apps/web/scripts/verify-container.mjs
```
