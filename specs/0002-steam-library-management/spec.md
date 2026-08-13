# SPEC-0002: Steam profile and library management

Status: Verified
Owner: Product owner  
Created: 2026-08-09  
Last updated: 2026-08-13
Supersedes: None  
Superseded by: None

## Problem

An authenticated user needs to understand whether their Steam profile and library are available before comparisons can
work. Without a web interface for synchronization, private-library recovery, library browsing, and eligibility choices,
the user cannot diagnose missing games or control which owned games enter comparisons.

## Desired outcome

An authenticated user can reach their Steam identity and synchronization state without a permanent profile strip,
request a permitted synchronization, search and filter every imported game page-by-page, and control each currently
owned game's comparison eligibility with clear, server-confirmed feedback.

## Scope

- Authenticated profile disclosure and compact globally visible actionable synchronization status.
- Durable job polling, terminal status, manual synchronization, throttling feedback, and private-library guidance.
- Cursor-paginated Steam library with artwork, ownership, playtime, and eligibility state.
- `DEFAULT`, `INCLUDED`, and `EXCLUDED` eligibility controls for applicable library entries.
- Server-backed case-insensitive name search, effective-eligibility filtering, and explicit-override filtering.
- Loading, empty, partial-image, retryable-error, and terminal-error states.

## Non-goals

- Editing Steam profile data, importing a non-Steam library, or changing Steam privacy settings from LibTaste.
- Client-selected comparison pairs, ranking calculations, leaderboard presentation, or game recommendations.
- Client-side persistence of a second library database or speculative eligibility state rejected by the API.

## Functional requirements

- **FR-001:** After authentication, the app shall read `/me`, place the available Steam display name, avatar, and
  external Steam-profile link in the authenticated profile disclosure, and display library state, last synchronization
  information, and current synchronization details on Library without exposing Steam ID as the primary user-facing
  name.
- **FR-002:** While synchronization is `PENDING`, `RUNNING`, or `RETRY_WAIT`, the app shall show a compact persistent
  status linked to Library and poll the durable job with bounded backoff. A failed latest job shall remain available as
  a compact actionable status, while successful or idle state shall not consume a permanent shell row. Polling shall
  stop on `SUCCEEDED`, `FAILED`, sign-out, or route disposal when no mounted feature requires the status.
- **FR-003:** The library page shall allow a user to request manual synchronization, explain the one-hour API throttle,
  reuse an equivalent active job returned by the API, and prevent duplicate submissions while a request is pending.
- **FR-004:** A private or unavailable Steam library shall leave the user signed in, explain that Steam game details must
  be public, link to safe Steam privacy guidance, and offer synchronization retry without claiming LibTaste can change
  Steam settings.
- **FR-005:** The library page shall retrieve `/me/library` through opaque cursors and display artwork or fallback, name,
  playtime, current or historical ownership, eligibility override, and effective eligibility for every loaded entry.
- **FR-006:** Each currently owned entry shall offer Default, Include, and Exclude behavior. The explanation of Default
  shall state that currently owned games with recorded playtime are eligible unless explicitly overridden.
- **FR-007:** Eligibility controls shall be disabled while their request is pending and shall display the server-returned
  library item only after success; a rejected update shall preserve the previous server-confirmed state and offer retry.
- **FR-008:** A cursor page may be loaded at most once per user action; repeated or delayed responses shall not duplicate
  entries, reorder the server's stable App-ID ordering, or replace newer eligibility responses.
- **FR-009:** Empty, loading, unavailable, failed-sync, end-of-library, and recoverable Problem Details states shall be
  distinguishable and shall retain already loaded usable library content where safe.
- **FR-010:** Library shall offer a clearable free-text name filter whose server result is a case-insensitive substring
  match over imported game names, plus filters for effective eligibility (`All`, `Eligible`, `Not eligible`) and explicit
  override (`All`, `Default`, `Included`, `Excluded`). The interface shall label the two eligibility concepts distinctly.
- **FR-011:** Filter state shall be represented in the URL, and any filter change shall discard incompatible pages and
  cursors before requesting the first matching server page. Name input shall be debounced so ordinary typing does not
  issue one request per keystroke.
- **FR-012:** Filtered pagination shall apply the same filter combination to every continuation request, preserve server
  order, and show a distinct no-matches state without implying that the imported library itself is empty.
- **FR-013:** Each library entry's available artwork shall link to the official Steam store page derived from its App ID.
  The link shall open in a new tab, identify the game and external destination accessibly, and remain separate from
  eligibility controls. Missing artwork shall retain the existing neutral fallback without fabricating an image link.

## Non-functional requirements

- **NFR-001:** Profile and library content shall meet the accessibility, responsive, browser, privacy, and logging
  requirements of SPEC-0001, including accessible labels for three-state eligibility controls.
- **NFR-002:** Polling shall pause when the document is not visible, avoid overlapping requests, use bounded intervals,
  and never continue after a terminal job state or sign-out.
- **NFR-003:** Library pages shall remain responsive with the API maximum of 100 entries per response and shall not
  perform image downloads or expensive rendering for entries outside a reasonable viewport buffer.
- **NFR-004:** Feature tests shall use contract-shaped responses generated or typed from `openapi/openapi.yaml`; Steam
  availability and synchronization timing shall be deterministic in automated tests.
- **NFR-005:** Filtering shall be performed by `GET /me/library` rather than only against already loaded client pages;
  the API shall bind opaque cursors to the active filter combination and reject incompatible cursor/filter reuse.
- **NFR-006:** Steam store destinations shall be constructed only as `https://store.steampowered.com/app/{appId}` from
  the contract-valid App ID and shall use safe external-link attributes without adding visit tracking.

## Acceptance scenarios

### AC-001: Active login synchronization

**Given** an authenticated profile contains an active synchronization job  
**When** the user navigates among protected pages  
**Then** a persistent status reflects server transitions and polling stops when the job succeeds or fails

### AC-002: Private Steam library recovery

**Given** `/me` reports `UNAVAILABLE` or a synchronization failure code of `LIBRARY_UNAVAILABLE`  
**When** the user opens Library  
**Then** the user remains signed in and sees privacy guidance and a manual retry action instead of an empty-success state

### AC-003: Request manual synchronization

**Given** no equivalent synchronization request is pending  
**When** the user requests synchronization and the API accepts or returns an active job  
**Then** that job becomes the displayed durable status and duplicate submission is prevented

### AC-004: Synchronization is throttled

**Given** the user is within the manual synchronization cooldown  
**When** the API rejects a new request with Problem Details  
**Then** the library remains usable and the user receives a safe cooldown explanation with request support details

### AC-005: Browse a multi-page library

**Given** the API returns a library page with a continuation cursor  
**When** the user chooses Load more  
**Then** the next stable page is appended once and the action disappears or becomes an end state when no cursor remains

### AC-006: Change game eligibility

**Given** a currently owned game has a server-confirmed eligibility state  
**When** the user selects another behavior and the API succeeds  
**Then** the row displays the returned override and effective eligibility and exposes the new state accessibly

### AC-007: Reject an eligibility change

**Given** a currently owned game has a server-confirmed eligibility state  
**When** an eligibility update fails  
**Then** the previous state remains displayed, other library content remains usable, and the user can retry

### AC-008: Historical ownership display

**Given** a loaded library entry is no longer owned  
**When** it is rendered  
**Then** it is clearly marked historical and cannot imply that it is currently eligible for a new comparison

### AC-009: Use the compact profile and synchronization controls

**Given** an authenticated profile is loaded
**When** no synchronization needs attention
**Then** the Steam identity and external profile link are available from the profile disclosure without a permanent
profile-status row, and Library displays the detailed library state

### AC-010: Search the imported library by name

**Given** the imported library contains matching and non-matching games across multiple pages
**When** the user enters a free-text name query
**Then** the URL records the query and the first server page contains only case-insensitive name matches rather than
filtering only the pages previously loaded by the browser

### AC-011: Filter library eligibility

**Given** imported games have different effective eligibility and explicit override values
**When** the user selects either or both eligibility filters
**Then** the first server page matches the selected combination and the interface keeps effective eligibility distinct
from Default, Included, and Excluded override behavior

### AC-012: Continue and clear a filtered library

**Given** a filtered response contains a continuation cursor
**When** the user loads more and then changes or clears a filter
**Then** continuation uses the unchanged filter combination, while the filter change discards old pages and starts a
new first-page request with a truthful filtered-empty state when no games match

### AC-013: Open a library game on Steam

**Given** a current or historical library entry has artwork and a contract-valid App ID
**When** the user activates its artwork link
**Then** the official Steam store page for that App ID opens in a new tab without changing eligibility or losing the
current Library route and filters

## Interfaces and data

- Consumes `GET /api/v1/me`, filtered `GET /api/v1/me/library`, `GET|POST /api/v1/me/library-sync`, and
  `PUT /api/v1/me/library/{appId}/eligibility`.
- Uses `MeProfile`, `LibrarySyncJob`, `LibraryPage`, `LibraryItem`, `EligibilityRequest`, and RFC 9457 `Problem` schemas
  from `openapi/openapi.yaml` without extending their meanings on the client.
- Uses opaque cursors only as returned continuation values and never parses, fabricates, persists, or displays them.
- `GET /api/v1/me/library` accepts optional `name`, `effectivelyEligible`, and `eligibilityOverride` query parameters;
  `name` is a case-insensitive substring match and each continuation cursor is valid only with its originating filters.
- Constructs official store destinations as `https://store.steampowered.com/app/{appId}` without persisting a visit.

## Compatibility and rollout

Requires the authentication and transport foundation in SPEC-0001 and LibTaste API version 1.4.0. The client shall
tolerate absent optional profile fields and shall render unknown safe failure codes as generic synchronization failures
rather than treating them as successful or exposing raw payloads.

## Related specifications and conflicts

- SPEC-0001 provides session, transport, visual, and error-handling behavior.
- SPEC-0003 consumes synchronization outcomes and reuses the server-confirmed `EXCLUDED` update for a displayed
  comparison game without duplicating Library's full eligibility controls.
- SPEC-0004 may show ownership and eligibility values from leaderboard responses; the server remains authoritative.
- SPEC-0005 clears profile and library caches after logout or account deletion.

## Open questions and assumptions

- Assumption for approval: only available artwork is linked; the fallback remains non-interactive so it does not imply
  that an unavailable image loaded successfully.

## Implementation notes

- Keep profile, synchronization, library pagination, and eligibility concerns in one feature boundary while using shared
  API primitives from SPEC-0001.
- Server-confirmed updates are intentionally preferred to speculative optimistic eligibility UI.
- Poll timing is an implementation detail, but tests must prove no overlap, hidden-page pause, and terminal cleanup.

## Verification matrix

| ID | Verification type | Test or evidence | Result |
|---|---|---|---|
| AC-001 | Component/integration test | `apps/web/src/app/App.test.tsx`, `apps/web/src/features/library/syncPolling.test.ts` | Passed 2026-08-12 |
| AC-002 | Browser/component test | `apps/web/src/features/library/LibraryPage.test.tsx` | Passed 2026-08-10 |
| AC-003 | Integration test | `apps/web/src/features/library/LibraryPage.test.tsx` | Passed 2026-08-10 |
| AC-004 | Component test | `apps/web/src/features/library/LibraryPage.test.tsx` | Passed 2026-08-10 |
| AC-005 | Browser test | `apps/web/src/features/library/LibraryPage.test.tsx`, `apps/web/e2e/library.spec.ts` | Passed 2026-08-10 |
| AC-006 | Browser test | `apps/web/src/features/library/LibraryPage.test.tsx`, `apps/web/e2e/library.spec.ts` | Passed 2026-08-10 |
| AC-007 | Browser/component test | `apps/web/src/features/library/LibraryPage.test.tsx` | Passed 2026-08-10 |
| AC-008 | Component test | `apps/web/src/features/library/LibraryPage.test.tsx` | Passed 2026-08-10 |
| AC-009 | Component/browser navigation test | `apps/web/src/app/App.test.tsx`, `apps/web/e2e/library.spec.ts`, `apps/web/src/components/Artwork.test.tsx` | Passed 2026-08-13 |
| AC-010 | Component/browser contract test | `apps/web/src/features/library/LibraryPage.test.tsx`, `apps/web/e2e/library.spec.ts` | Passed 2026-08-12 |
| AC-011 | Component/browser contract test | `apps/web/src/features/library/LibraryPage.test.tsx`, `apps/web/e2e/library.spec.ts` | Passed 2026-08-12 |
| AC-012 | Component/browser pagination test | `apps/web/src/features/library/LibraryPage.test.tsx`, `apps/web/e2e/library.spec.ts` | Passed 2026-08-12 |
| AC-013 | Component/browser external-link test | `apps/web/src/features/library/LibraryPage.test.tsx`, `apps/web/e2e/library.spec.ts` — available artwork opens the exact Steam app URL in a new tab and failed artwork removes the link | Passed 2026-08-13 |
| NFR-002 | Timer and visibility test | `apps/web/src/features/library/syncPolling.test.ts` | Passed 2026-08-10 |
| NFR-003 | Performance-oriented component test | `apps/web/src/features/library/LibraryPage.test.tsx` (100 contract-shaped lazy-rendered entries) | Passed 2026-08-10 |
| NFR-004 | Contract fixture review | Typed fixtures in `apps/web/src/features/library/LibraryPage.test.tsx` and `apps/web/e2e/library.spec.ts` | Passed 2026-08-12 |
| NFR-005 | Contract and request-boundary tests | `apps/web/src/features/library/LibraryPage.test.tsx`, generated OpenAPI drift check | Passed 2026-08-12 |
| NFR-006 | External-destination test | `LibraryPage.test.tsx` exact URL, `target="_blank"`, `rel="noreferrer"`, and in-app location isolation assertions | Passed 2026-08-13 |

## Verification commands

| Command | Result | Date |
|---|---|---|
| `node scripts/validate-specs.mjs` | Passed | 2026-08-10 |
| `npm run verify` | Passed (format, lint, typecheck, 44 tests, coverage, OpenAPI drift check, and production build) | 2026-08-10 |
| `npm run test --workspace apps/web` | Passed (44 tests) | 2026-08-10 |
| `npm run coverage --workspace apps/web` | Passed (89.69% statements, 82.06% branches, 90.16% functions, 91.89% lines) | 2026-08-10 |
| `npx playwright test` | Passed (30 tests across Chromium, Firefox, WebKit, mobile Chrome, and mobile Safari) | 2026-08-10 |
| `npm.cmd run verify` | Passed: 92 tests, coverage gates, OpenAPI drift check, and production build | 2026-08-12 |
| Library filter journey across five Playwright projects, with three repeated WebKit race checks | Passed | 2026-08-12 |
| Focused profile-avatar and application navigation component tests | Passed (12 tests) | 2026-08-13 |
| Grouped-navigation Playwright journey in Chromium | Passed | 2026-08-13 |
| `npm.cmd run verify` | Passed: format, lint, typecheck, 93 tests, coverage gates, OpenAPI drift check, and production build | 2026-08-13 |
| `npm.cmd run verify` | Passed: format, lint, typecheck, 100 tests, coverage (90.43% statements, 84.52% branches, 92.17% functions, 92.59% lines), OpenAPI drift check, and production build | 2026-08-13 |
| Full Playwright matrix | Passed: 105 tests across Chromium, Firefox, WebKit, mobile Chrome, and mobile Safari | 2026-08-13 |
| `node scripts/validate-specs.mjs` | Passed after verification evidence and lifecycle update | 2026-08-13 |

## Completion checklist

- [x] The specification was approved before implementation started.
- [x] Tests were derived from every acceptance criterion.
- [x] The implementation satisfies the requirements and non-goals.
- [x] Applicable contract, web and spec checks pass.
- [x] Required README, changelog, and ADR updates are complete.
- [x] The verification matrix contains no pending entries.
- [x] Status is `Verified` only after every item above is complete.
