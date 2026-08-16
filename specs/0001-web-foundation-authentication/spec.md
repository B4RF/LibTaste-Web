# SPEC-0001: Web foundation and Steam authentication

Status: Verified
Owner: Product owner  
Created: 2026-08-09  
Last updated: 2026-08-16
Supersedes: None  
Superseded by: None

## Problem

LibTaste has no browser application through which a visitor can understand the product, authenticate through Steam, or
reach authenticated features. A web client also needs a secure session model, a versioned API integration boundary,
and a production-ready build and runtime foundation before feature pages can be implemented safely.

## Desired outcome

A visitor can open a responsive public LibTaste application, start and complete Steam authentication, remain signed in
through short-lived access-token rotation, and reach protected routes. The same verified artifact can run locally or as
a publicly deployed static container using environment-specific, non-secret runtime configuration.

## Scope

- React and TypeScript single-page application foundation and feature-oriented package structure.
- Public landing page, application shell, navigation, callback route, protected-route behavior, and not-found handling.
- Steam OpenID authorization-code flow with S256 PKCE and safe post-login destination restoration.
- In-memory access-token session, cookie-backed refresh, CSRF handling, and signed-out recovery.
- Typed integration with the repository's OpenAPI contract.
- Responsive visual foundation, accessibility baseline, production container, and continuous integration checks.

## Non-goals

- Steam library, comparison, leaderboard, recommendation, and account-management feature behavior.
- Server-side rendering, search-engine-specific rendering, offline/PWA behavior, or native mobile clients.
- Third-party analytics, advertising, tracking cookies, or remote browser error-reporting services.
- Deployment-provider configuration, DNS, TLS certificate provisioning, publishing, or deployment.

## Functional requirements

- **FR-001:** The application shall provide public routes for the landing page and global leaderboard entry point, a
  callback route at `/auth/callback`, and protected routes for Compare, Recommendations, My Ranking, Library, and
  Account & Security. Primary navigation shall expose Compare and Recommendations directly, group My Ranking and Global
  beneath a Leaderboards disclosure, and expose the external Steam-profile link first, Library second, and Account &
  Security last beneath an authenticated profile disclosure. Moving Library shall not change its `/library` route or
  prevent feature recovery actions from linking to it directly.
- **FR-002:** The landing page shall explain pairwise game ranking and Steam authentication and shall offer only real
  product actions: signing in through Steam and opening the public global leaderboard.
- **FR-003:** Starting authentication shall generate a cryptographically random PKCE verifier, derive an S256 challenge,
  preserve an allowlisted internal destination, and navigate to `GET /api/v1/auth/steam/authorize` using the configured
  client ID, the current origin plus `/auth/callback` as the exact return URI, and the required challenge parameters.
- **FR-004:** The callback route shall exchange a returned authorization code and the one-time PKCE verifier through
  `POST /api/v1/auth/token`, clear transient login data after use, and navigate to the preserved protected destination
  or Compare when no destination exists.
- **FR-005:** Access tokens shall exist only in memory. A page load or expired access token shall trigger at most one
  concurrent cookie-based refresh request with credentials and the CSRF value from the readable `libtaste_csrf` cookie.
  Every refresh request shall have a ten-second deadline and shall release the shared in-flight operation after success,
  failure, or cancellation.
- **FR-006:** When refresh succeeds, waiting protected requests shall continue with the new bearer token. When the API
  confirms that the session is invalid, authenticated state and user-specific caches shall be cleared, the intended
  internal destination shall be retained, and sign-in shall be offered. A timeout or other transient refresh failure
  shall instead leave protected content hidden, end the checking state, and show a safe session-recovery explanation
  with a control that retries the session check.
- **FR-007:** Unauthenticated access to a protected route shall display a sign-in path and shall never render protected
  content or redirect to an unvalidated external destination.
- **FR-008:** User-visible API failures shall use safe Problem Details fields, keep recoverable screen state intact, offer
  retry where applicable, and expose the request ID only in expandable support details.
- **FR-009:** Startup shall load the API base URL, web client ID, and optional environment label from non-secret runtime
  configuration, derive the callback URI from the current origin, and show a clear configuration-error screen rather
  than starting with missing or malformed required values.
- **FR-010:** OpenAPI TypeScript types shall be generated from `openapi/openapi.yaml`; verification shall fail when the
  committed generated representation is stale.
- **FR-011:** The production image shall serve the static SPA with route fallback, compression, security headers, runtime
  configuration, and a container health endpoint. The HTML application shell shall require browser revalidation, runtime
  configuration shall remain non-cacheable, and fingerprinted assets shall remain immutable. Local development shall
  proxy API traffic to a configurable origin defaulting to `http://localhost:8080` without depending on the sibling API
  checkout.
- **FR-012:** Missing artwork or profile images shall render a neutral fallback without preventing navigation or exposing
  broken-image text as the accessible name.
- **FR-013:** Navigation disclosures shall be operable by pointer, touch, and keyboard, shall expose their expanded
  state, shall close through Escape and focus-safe dismissal, and shall never require hover. Hover may open a disclosure
  only as an additional desktop interaction that remains dismissible, hoverable, and persistent.

## Non-functional requirements

- **NFR-001:** The application shall use React with Vite, React Router, TanStack Query, a small authentication context,
  local component or URL state, CSS Modules, and shared design tokens; no general-purpose global state or full UI
  framework shall be introduced without a demonstrated need.
- **NFR-002:** The interface shall be dark-first, use deep blue or charcoal surfaces with restrained cyan accents, meet
  WCAG 2.2 AA, support keyboard-only use and reduced motion, and remain usable at viewport widths from 360px upward.
- **NFR-003:** The app shall support the latest two stable versions of Chrome, Edge, Firefox, and Safari, including
  current mobile Chrome and Safari, and shall not claim support for Internet Explorer.
- **NFR-004:** Production browser policy shall restrict scripts, connections, frames, and images to the minimum required
  application, configured API, Steam authentication, and HTTPS artwork sources. Credentials, tokens, raw server
  responses, and exception details shall not be written to production logs.
- **NFR-005:** User-facing copy shall be English-only for this release and organized so a future localization feature
  does not require redesigning feature components.
- **NFR-006:** npm shall be used with a committed lockfile. Formatting, linting, strict type checking, tests, coverage,
  production build, and container build shall be reproducible from documented commands.
- **NFR-007:** Automated coverage shall be at least 80 percent for statements, branches, functions, and lines, excluding
  generated contract types and configuration-only entrypoints; every acceptance scenario still requires explicit
  evidence independent of aggregate coverage.
- **NFR-008:** CI shall validate specifications and OpenAPI generation and run formatting, linting, type checking, unit
  and component tests, deterministic mocked browser journeys, coverage, production build, and container build without
  publishing or deploying artifacts.
- **NFR-009:** Product routes shall use a compact visual hierarchy distinct from the expressive landing hero. At a
  1280-by-720 viewport, an ordinary loaded product route shall show its heading and the beginning of its primary task
  content in the initial viewport without reducing normal body copy below its one-rem baseline or shrinking interactive
  targets below the established accessible sizes.

## Acceptance scenarios

### AC-001: Public landing page

**Given** a visitor has no LibTaste session  
**When** the visitor opens the application root at a 360px or larger viewport  
**Then** the accessible landing page explains pairwise ranking and offers Steam sign-in and the public global leaderboard

### AC-002: Start Steam authentication

**Given** valid runtime configuration and a requested protected destination  
**When** the visitor chooses Steam sign-in  
**Then** the browser starts authorization with the configured client, exact derived callback, S256 challenge, and a
safely stored internal destination without putting an API credential in the URL

### AC-003: Complete Steam authentication

**Given** the callback contains a valid single-use authorization code and a matching PKCE transaction  
**When** the token exchange succeeds  
**Then** the access token is retained only in memory, transient login material is removed, and the visitor reaches the
original protected destination or Compare

### AC-004: Reject an invalid callback

**Given** the callback is missing a code or matching PKCE transaction, or the token exchange returns Problem Details  
**When** the callback route is loaded  
**Then** no authenticated session is created and the visitor receives a safe retryable sign-in explanation with support
details when a request ID exists

### AC-005: Restore a cookie-backed session

**Given** the browser has a valid refresh and CSRF cookie but no in-memory access token  
**When** the app starts or a protected request requires authentication  
**Then** one refresh request obtains an access token and all waiting work continues without exposing the refresh token

### AC-006: Expired session recovery

**Given** one or more protected requests encounter an expired session and the refresh endpoint confirms it is invalid
**When** session recovery completes  
**Then** only one refresh attempt was made, protected data is cleared, and the user is offered sign-in with the intended
internal destination preserved

### AC-007: Invalid runtime configuration

**Given** required runtime configuration is missing or malformed  
**When** the app starts  
**Then** a clear configuration-error screen is rendered and no authentication or product API request is attempted

### AC-008: Production route fallback and health

**Given** the production container is running  
**When** a client requests a known SPA route directly or the health endpoint  
**Then** the route receives an application shell that browsers must revalidate, runtime configuration remains
non-cacheable, fingerprinted assets remain immutable, and the health endpoint reports the static server as healthy

### AC-009: Contract drift verification

**Given** the OpenAPI contract and generated TypeScript representation differ  
**When** repository verification runs  
**Then** verification fails with a reproducible regeneration command

### AC-010: Use grouped responsive navigation

**Given** a visitor or authenticated user is using pointer, touch, or keyboard input
**When** they open Leaderboards or the authenticated profile disclosure
**Then** the available route links can be reached and activated without hover, the disclosure state is announced, and
Escape returns focus safely to its trigger; for an authenticated user, the profile disclosure orders the Steam-profile
link first, Library second, and Account & Security last, with Library omitted as a primary-navigation peer of Compare
and Recommendations

### AC-011: Open a compact product route

**Given** an ordinary successful product route is rendered at 1280 by 720 CSS pixels
**When** its initial content is ready
**Then** its heading and the beginning of its primary task content are visible without vertical scrolling while body
copy and interactive controls retain the established accessible sizing

### AC-012: Recover from a stalled session check

**Given** a protected route is restoring a cookie-backed session and the refresh response does not complete
**When** the ten-second refresh deadline expires
**Then** the request is cancelled, protected content remains hidden, the checking screen is replaced by a safe
session-recovery explanation, and retry starts one new bounded session check without losing the intended destination

## Interfaces and data

- Consumes `GET /api/v1/auth/steam/authorize` and `POST /api/v1/auth/token` from `openapi/openapi.yaml`.
- Reads the non-HttpOnly `libtaste_csrf` cookie only to echo its value on protected refresh operations; refresh
  credentials remain inaccessible to JavaScript.
- Stores only one-time PKCE and internal-return transaction data in session-scoped browser storage. Access and refresh
  tokens are not persisted by application JavaScript.
- Runtime configuration contains `apiBaseUrl`, `webClientId`, and optional `environmentLabel`; it contains no secrets.
- Routes introduced here: `/`, `/auth/callback`, `/compare`, `/leaderboard/me`, `/leaderboard/global`, `/library`,
  `/settings`, and a not-found route. Feature specifications own the contents of product routes.

## Compatibility and rollout

The initial application targets LibTaste API contract version 1.4.0 under `/api/v1`. Its static image is configured per
environment at runtime. Public deployments must register the exact HTTPS web origin and callback with the API and must
route or allow credentialed API requests consistently with the API's origin and cookie policy.

## Related specifications and conflicts

- SPEC-0002, SPEC-0003, SPEC-0004, and SPEC-0005 use this application shell, API transport, session, design tokens, and
  verification foundation. Their feature behavior is additive and does not conflict with this specification.

## Open questions and assumptions

- Assumption for approval: Library remains a first-class protected route and recovery destination; only its routine
  navigation placement and explicit second position in the authenticated profile disclosure change.
- Assumption for this revision's approval: ten seconds is the session-refresh deadline; transient failures provide an
  explicit retry instead of treating the cookie-backed session as confirmed invalid.

## Implementation notes

- Use an npm workspace with the application under `apps/web`; keep generated API types in the application rather than
  introducing a reusable package.
- Follow the authentication boundary established by LibTaste API ADR-0002. The one-time PKCE verifier is not an API
  credential but still needs to be cleared on success, terminal failure, and restart of authentication.
- Use a thin typed transport around generated OpenAPI paths so bearer, credentials, CSRF, refresh deduplication, and
  Problem Details behavior have one implementation point.
- A web architecture ADR is expected when implementation makes the SPA, session, runtime-configuration, and container
  choices durable.

## Verification matrix

| ID | Verification type | Test or evidence | Result |
|---|---|---|---|
| AC-001 | Browser/component test | `apps/web/src/app/App.test.tsx`, `apps/web/e2e/foundation.spec.ts` | Passed 2026-08-10 |
| AC-002 | Browser/unit test | `apps/web/src/auth/pkce.test.ts`, `apps/web/e2e/foundation.spec.ts` | Passed 2026-08-10 |
| AC-003 | Browser test | `apps/web/src/auth/CallbackPage.test.tsx` | Passed 2026-08-10 |
| AC-004 | Browser test | `apps/web/src/auth/CallbackPage.test.tsx`, `apps/web/e2e/foundation.spec.ts` | Passed 2026-08-10 |
| AC-005 | Integration test | `apps/web/src/api/client.test.ts` | Passed 2026-08-10 |
| AC-006 | Integration test | `apps/web/src/api/client.test.ts`, `apps/web/src/app/App.test.tsx` | Passed 2026-08-10 |
| AC-007 | Browser test | `apps/web/src/bootstrap.test.tsx`, `apps/web/e2e/foundation.spec.ts` | Passed 2026-08-10 |
| AC-008 | Container verification | `apps/web/scripts/verify-container.mjs` | Passed 2026-08-16 |
| AC-009 | Script verification | `apps/web/scripts/check-openapi.mjs` | Passed 2026-08-10 |
| AC-010 | Component/browser navigation tests | `apps/web/src/app/App.test.tsx`, `apps/web/e2e/library.spec.ts` — Steam profile, Library, and Account & Security render in the required order while Library remains outside primary navigation | Passed 2026-08-13 |
| AC-011 | Browser layout test | `apps/web/e2e/foundation.spec.ts` | Passed 2026-08-12 |
| AC-012 | Integration/component test | `apps/web/src/api/client.test.ts`, `apps/web/src/app/App.test.tsx` | Passed 2026-08-16 |
| NFR-002 | Automated accessibility and viewport tests | `apps/web/src/app/App.test.tsx`, `apps/web/e2e/foundation.spec.ts` | Passed 2026-08-12 |
| NFR-003 | Browser project configuration | `apps/web/playwright.config.ts`, `apps/web/package.json#browserslist` | Passed 2026-08-10 |
| NFR-004 | Automated header and logging review | `apps/web/scripts/verify-container.mjs`, `apps/web/src/api/client.test.ts` | Passed 2026-08-16 |
| NFR-006 | Build verification | `apps/web/package.json`, `package-lock.json`, `apps/web/README.md` | Passed 2026-08-10 |
| NFR-007 | Coverage report | `apps/web/vitest.config.ts` (90.66% statements, 84.82% branches, 91.92% functions, 92.86% lines) | Passed 2026-08-16 |
| NFR-008 | CI configuration inspection | `.github/workflows/verify.yml` | Passed 2026-08-10 |
| NFR-009 | Browser layout and computed-style test | `apps/web/e2e/foundation.spec.ts` | Passed 2026-08-12 |

## Verification commands

| Command | Result | Date |
|---|---|---|
| `node scripts/validate-specs.mjs` | Passed | 2026-08-10 |
| `npm run verify` | Passed (36 tests; coverage above all 80% thresholds) | 2026-08-10 |
| `npx playwright test` | Passed (25 tests across Chromium, Firefox, WebKit, mobile Chrome, and mobile Safari) | 2026-08-10 |
| `docker build --file apps/web/Dockerfile --tag libtaste-web:spec-0001 .` | Passed | 2026-08-10 |
| `$env:LIBTASTE_CONTAINER_URL='http://127.0.0.1:8088'; node apps/web/scripts/verify-container.mjs` | Passed | 2026-08-10 |
| `npm.cmd run verify` | Passed: 92 tests, coverage gates, OpenAPI drift check, and production build | 2026-08-12 |
| Changed Playwright journeys across Chromium, Firefox, WebKit, mobile Chrome, and mobile Safari | Passed | 2026-08-12 |
| Focused profile-avatar and application navigation component tests | Passed (12 tests) | 2026-08-13 |
| Grouped-navigation Playwright journey in Chromium | Passed | 2026-08-13 |
| `npm.cmd run verify` | Passed: format, lint, typecheck, 93 tests, coverage gates, OpenAPI drift check, and production build | 2026-08-13 |
| `npm.cmd run verify` | Passed: format, lint, typecheck, 100 tests, coverage (90.43% statements, 84.52% branches, 92.17% functions, 92.59% lines), OpenAPI drift check, and production build | 2026-08-13 |
| Full Playwright matrix | Passed: 105 tests across Chromium, Firefox, WebKit, mobile Chrome, and mobile Safari | 2026-08-13 |
| `npm.cmd run verify` | Passed: format, lint, typecheck, 114 tests, coverage (90.66% statements, 84.82% branches, 91.92% functions, 92.86% lines), OpenAPI drift check, and production build | 2026-08-16 |
| `npx.cmd playwright test --workers=1` | Passed: 120 tests across Chromium, Firefox, WebKit, mobile Chrome, and mobile Safari | 2026-08-16 |
| `docker build --file apps/web/Dockerfile --tag libtaste-web:spec-0001 .` | Passed | 2026-08-16 |
| `$env:LIBTASTE_CONTAINER_URL='http://127.0.0.1:8088'; node apps/web/scripts/verify-container.mjs` | Passed: health, SPA fallback, cache policy, runtime configuration, compression, and security headers | 2026-08-16 |
| `node scripts/validate-specs.mjs` | Passed after revised evidence and lifecycle update | 2026-08-16 |
| `node scripts/validate-specs.mjs` | Passed after verification evidence and lifecycle update | 2026-08-13 |
| `npm.cmd run verify` | Passed: format, lint, typecheck, 101 tests, coverage (90.43% statements, 84.52% branches, 92.17% functions, 92.59% lines), OpenAPI drift check, and production build | 2026-08-13 |
| Full Playwright matrix | Passed: 105 tests across Chromium, Firefox, WebKit, mobile Chrome, and mobile Safari | 2026-08-13 |

## Completion checklist

- [x] The specification was approved before implementation started.
- [x] Tests were derived from every acceptance criterion.
- [x] The implementation satisfies the requirements and non-goals.
- [x] Applicable contract, web and spec checks pass.
- [x] Required README, changelog, and ADR updates are complete.
- [x] The verification matrix contains no pending entries.
- [x] Status is `Verified` only after every item above is complete.
