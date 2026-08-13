# SPEC-0005: Account and session settings

Status: Verified
Owner: Product owner  
Created: 2026-08-09  
Last updated: 2026-08-12
Supersedes: None  
Superseded by: None

## Problem

Authenticated users need explicit control over the current browser session, all LibTaste sessions, and permanent
account deletion. Without an Account & Security experience, security and privacy capabilities already provided by the
API are inaccessible, and stale user-specific state could remain visible in the browser after a destructive action.

## Desired outcome

An authenticated user can log out the current session, revoke all sessions, or permanently delete the LibTaste account
through clear, accessible safeguards. Successful actions reliably remove all user-specific browser state and return to
the public application without affecting public global leaderboard access.

## Scope

- Authenticated Account & Security page at the stable `/settings` route and concise explanation of each session/account
  action.
- Current-session logout and all-session logout.
- Permanent account deletion with explicit impact disclosure and typed confirmation.
- Pending, success, authentication-expired, rate-limited, recoverable-failure, and uncertain-result handling.
- Clearing authentication state, user-specific query caches, transient PKCE data, and protected route state.

## Non-goals

- Restoring a deleted account, exporting account data, changing Steam identity, or deleting Steam data.
- Managing or naming individual remote sessions because the API exposes only current-session and all-session revocation.
- Deleting non-user-specific game catalog records or promising removal beyond the API's documented account boundary.

## Functional requirements

- **FR-001:** Account & Security shall require authentication and present distinct actions for Log out this device, Log
  out all devices, and Delete account, with consequences explained before activation. Navigation and the page heading
  shall use Account & Security while the existing `/settings` URL remains valid.
- **FR-002:** Log out this device shall call `POST /auth/logout` with the authenticated and CSRF-protected web request,
  prevent duplicate submissions, and clear local authenticated state whether the API confirms success or reports that
  the session is already unauthenticated.
- **FR-003:** Log out all devices shall require an explicit confirmation step, call `POST /auth/logout-all`, prevent
  duplicate submissions, and on confirmed or already-unauthenticated completion clear the current browser session.
- **FR-004:** Delete account shall open an accessible modal describing permanent removal of identity, profile, library,
  synchronization, sessions, comparisons, personal ratings, and current global contributions while noting that shared
  non-user-specific game catalog data remains.
- **FR-005:** The deletion action shall remain disabled until the user types the exact confirmation text `DELETE`; the
  text shall be reset whenever the dialog closes or after a failed attempt that invalidates authentication.
- **FR-006:** Confirmed deletion shall call `DELETE /me` exactly once while pending. A `204` response shall clear all
  authenticated and user-specific browser state and navigate to the public landing page with a completion message.
- **FR-007:** A recoverable logout or deletion failure shall keep the user on Account & Security, preserve authenticated
  state when still valid, re-enable a safe retry, and display Problem Details support information without claiming the
  action succeeded.
- **FR-008:** When the result of deletion is uncertain because the connection ends after submission, the app shall not
  automatically repeat the destructive request; it shall attempt ordinary session recovery and explain whether the
  account appears deleted or the user must explicitly retry.
- **FR-009:** Clearing a session shall cancel protected requests and polling, remove user profile, library, comparison,
  and personal leaderboard caches, clear one-time auth transaction data, and retain only non-sensitive public data such
  as the global leaderboard cache.
- **FR-010:** After logout or deletion, browser history navigation to a protected route shall invoke the normal
  signed-out guard and shall not reveal a previously rendered protected screen.

## Non-functional requirements

- **NFR-001:** Confirmation dialogs, typed confirmation, progress announcements, and focus restoration shall meet the
  accessibility, keyboard, reduced-motion, and responsive requirements of SPEC-0001.
- **NFR-002:** Logout and deletion requests shall use the shared bearer, credential, exact-origin, CSRF, and one-refresh
  rules from SPEC-0001 and shall never expose cookie or token values in UI, telemetry, or logs.
- **NFR-003:** Destructive-action tests shall assert request cardinality, cache cleanup, polling cancellation, stale
  history behavior, and uncertain-result recovery with deterministic mocked browser scenarios.
- **NFR-004:** Settings copy shall distinguish deleting a LibTaste account from deleting or modifying the user's Steam
  account and shall not promise recovery of deleted LibTaste data.

## Acceptance scenarios

### AC-001: Log out this device

**Given** a user is authenticated in the current browser  
**When** the user activates Log out this device and the API completes or says the session is already unauthenticated  
**Then** protected work and user data are cleared and the public landing page is shown in a signed-out state

### AC-002: Log out all devices

**Given** a user confirms revocation of all sessions  
**When** the all-session logout succeeds  
**Then** the current browser is also signed out and protected state cannot be restored from its cache or history

### AC-003: Deletion confirmation safeguard

**Given** the account-deletion dialog is open  
**When** the confirmation field does not exactly contain `DELETE`  
**Then** no account deletion request can be submitted and the full consequence text remains available

### AC-004: Delete the account

**Given** an authenticated user has typed the exact confirmation  
**When** the API returns `204` for one deletion request  
**Then** all user-specific browser state is removed and the public landing page confirms completion without offering
restore

### AC-005: Recoverable deletion failure

**Given** a deletion request returns a recoverable Problem Details response and authentication remains valid  
**When** the response is handled  
**Then** the app does not claim deletion, retains the Settings context, and permits an explicit retry

### AC-006: Uncertain deletion result

**Given** the connection ends after the deletion request was sent  
**When** the app checks the ordinary session state  
**Then** it does not automatically send another delete and explains completion when credentials are invalid or offers
an explicit retry when the account remains authenticated

### AC-007: Protected history after session clearing

**Given** logout or deletion has cleared authenticated state  
**When** the user navigates backward to a protected URL  
**Then** the route guard shows the signed-out experience without rendering cached protected content

### AC-008: Reach Account & Security from the profile disclosure

**Given** an authenticated user opens the profile disclosure
**When** they activate Account & Security
**Then** the protected `/settings` route opens with Account & Security as its page heading and all existing session and
account actions remain available

## Interfaces and data

- Consumes `POST /api/v1/auth/logout`, `POST /api/v1/auth/logout-all`, and `DELETE /api/v1/me`.
- Uses bearer authentication, web refresh/CSRF cookies, and RFC 9457 `Problem` behavior defined by
  `openapi/openapi.yaml` and SPEC-0001.
- Account deletion stores no new persistent client data. The literal `DELETE` confirmation exists only in component
  state and is cleared with the dialog.

## Compatibility and rollout

Requires SPEC-0001 and LibTaste API version 1.4.0. The API is the authority for revocation and deletion. The client
clears local state after confirmed completion or an already-invalid session but does not treat arbitrary server or
network errors as successful destructive actions.

## Related specifications and conflicts

- SPEC-0001 supplies authentication recovery, route protection, CSRF transport, and public navigation.
- SPEC-0002, SPEC-0003, and SPEC-0004 own user-specific caches and ongoing work that this specification clears or
  cancels. Public global leaderboard data from SPEC-0004 may remain cached because it contains no user-specific data.

## Open questions and assumptions

None.

## Implementation notes

- Centralize signed-out cleanup so ordinary expiry, both logout actions, and deletion cannot diverge in which protected
  state they remove.
- Use a focused accessible dialog primitive only if native dialog behavior cannot satisfy focus containment,
  announcement, dismissal, and restoration requirements across supported browsers.

## Verification matrix

| ID | Verification type | Test or evidence | Result |
|---|---|---|---|
| AC-001 | Browser/component test | `apps/web/src/features/settings/SettingsPage.test.tsx`; `apps/web/e2e/settings.spec.ts` current-device logout and guarded-navigation journey | Passed 2026-08-10 |
| AC-002 | Browser/component test | `SettingsPage.test.tsx`; `settings.spec.ts` explicit all-device confirmation and local sign-out journey | Passed 2026-08-10 |
| AC-003 | Browser accessibility test | `SettingsPage.test.tsx`; `settings.spec.ts` exact typed confirmation, consequence-copy, focus-restoration, and Escape cases | Passed 2026-08-10 |
| AC-004 | Component/transport test | `SettingsPage.test.tsx` pending cardinality and `204` completion; `apps/web/src/api/client.test.ts` one-shot destructive request | Passed 2026-08-10 |
| AC-005 | Integration test | `SettingsPage.test.tsx` recoverable Problem Details and explicit retry case | Passed 2026-08-10 |
| AC-006 | Browser/component test | `SettingsPage.test.tsx`; `settings.spec.ts` connection-end recovery without automatic `DELETE` replay | Passed 2026-08-10 |
| AC-007 | Browser test | `SettingsPage.test.tsx`; `settings.spec.ts` protected navigation after session clearing | Passed 2026-08-10 |
| AC-008 | Component/browser navigation test | `apps/web/src/app/App.test.tsx`, `SettingsPage.test.tsx`, `apps/web/e2e/settings.spec.ts` | Passed 2026-08-12 |
| NFR-001 | Automated accessibility test | `SettingsPage.test.tsx` axe audit, keyboard focus restoration, and exact typed confirmation; five-project responsive browser journey | Passed 2026-08-10 |
| NFR-002 | Request-security test | `client.test.ts`; `settings.spec.ts` bearer, credential, CSRF, and one-request assertions | Passed 2026-08-10 |
| NFR-003 | Browser suite review | `AuthContext.test.tsx`, `SettingsPage.test.tsx`, and `settings.spec.ts` cover cardinality, cancellation, cache isolation, stale navigation, and uncertain recovery | Passed 2026-08-10 |
| NFR-004 | Content review | `SettingsPage.test.tsx` asserts permanent LibTaste/Steam account boundary and no restore offer | Passed 2026-08-10 |

## Verification commands

| Command | Result | Date |
|---|---|---|
| `node scripts/validate-specs.mjs` | Passed | 2026-08-10 |
| `npm.cmd run verify` | Passed: format, lint, typecheck, 74 tests, coverage (89.59% statements, 83.11% branches, 91.42% functions, 91.76% lines), OpenAPI drift check, and production build | 2026-08-10 |
| `npm.cmd run e2e --workspace apps/web -- --workers=1` | Passed: 80 tests across Chromium, Firefox, WebKit, mobile Chrome, and mobile Safari | 2026-08-10 |
| `npm.cmd run verify` | Passed: 92 tests, coverage gates, OpenAPI drift check, and production build | 2026-08-12 |
| Profile-to-Account & Security journeys across five Playwright projects | Passed | 2026-08-12 |

## Completion checklist

- [x] The specification was approved before implementation started.
- [x] Tests were derived from every acceptance criterion.
- [x] The implementation satisfies the requirements and non-goals.
- [x] Applicable contract, web and spec checks pass.
- [x] Required README, changelog, and ADR updates are complete.
- [x] The verification matrix contains no pending entries.
- [x] Status is `Verified` only after every item above is complete.
