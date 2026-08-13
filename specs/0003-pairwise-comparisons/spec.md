# SPEC-0003: Pairwise game comparisons

Status: Verified
Owner: Product owner  
Created: 2026-08-09  
Last updated: 2026-08-12
Supersedes: None  
Superseded by: None

## Problem

LibTaste's ranking model depends on users resolving server-selected pairs, but no web experience currently presents a
pair or safely submits its outcome. Users need an immediate, artwork-forward flow that remains correct when requests are
slow, retried, expired, exhausted, or unavailable because their Steam library cannot produce a pair.

## Desired outcome

An authenticated eligible user can repeatedly choose the preferred game, declare a draw, or skip a comparison in a
compact, stable viewport, with concise irreversible-action guidance, keyboard and pointer accessibility, idempotent
submission behavior, and recovery from every documented API response.

## Scope

- Fetching or restoring the API's active comparison.
- Responsive left/right game cards using API-supplied names and artwork.
- Immediate left win, right win, draw, and skip outcomes.
- Submission locking, retry behavior, keyboard shortcuts, expiry awareness, and loading the next pair.
- Stable above-the-fold comparison controls with progressively disclosed secondary information.
- Guidance when synchronization, library availability, or eligible population prevents allocation.

## Non-goals

- Client-selected or client-reoriented pairs, undo, comparison history, rating calculations, or score prediction.
- Modifying game eligibility from the comparison screen beyond linking to Library.
- Game recommendations, free-form reviews, tags, or social sharing.

## Functional requirements

- **FR-001:** Opening Compare shall call `POST /comparisons/next` once per allocation attempt and render the exact
  server-issued left and right orientation, game names, and artwork. The comparison ID and ordinary submission-window
  state shall remain available in an expandable details surface without preceding the outcome controls.
- **FR-002:** Activating the left or right game card shall immediately submit `LEFT_WIN` or `RIGHT_WIN` respectively;
  separate actions shall submit `DRAW` and `SKIP` without a per-choice confirmation dialog.
- **FR-003:** The page shall state concisely before interaction that choices are final and that a retry repeats the same
  choice; it shall not describe an API retry of the identical outcome as an undo or a second comparison.
- **FR-004:** All outcome controls shall disable after the first activation and remain locked until that submission
  resolves. Pointer, touch, keyboard activation, rerender, and repeated events shall not create conflicting requests.
- **FR-005:** A successful submission shall acknowledge the recorded outcome briefly and automatically request the next
  comparison. The previous pair shall not be reused as the visual next pair unless the API returns it as active.
- **FR-006:** If submission fails before a result is known, the exact selected outcome shall remain available for an
  explicit identical retry. The UI shall not permit selecting a different outcome for that comparison.
- **FR-007:** A conflicting, expired, or missing comparison response shall discard the stale interactive pair and offer
  retrieval of the current server state with a safe Problem Details explanation.
- **FR-008:** Allocation responses indicating insufficient eligible games, unavailable synchronization, rate limiting,
  or no available pair shall render distinct non-interactive recovery states and link to Library when eligibility or
  synchronization can be addressed there.
- **FR-009:** Keyboard shortcuts shall support left choice, right choice, draw, and skip, be documented by the visible
  action hints and an accessible expandable help surface, and be inactive while submitting or when focus is in another
  interactive or text-entry control.
- **FR-010:** Comparison expiry shall be conveyed without relying on color alone. Ordinary expiry information may live
  in expandable details, but an approaching or locally passed expiry shall become visibly prominent; the client shall
  treat the server response as authoritative if local and server time disagree.
- **FR-011:** Allocation, submission acknowledgement, and loading the next pair shall preserve a stable comparison-stage
  footprint and scroll position. Advancing successfully shall not collapse the page or require a desktop user to scroll
  back to the outcome controls for every pair.

## Non-functional requirements

- **NFR-001:** The comparison page shall meet SPEC-0001 accessibility and responsive requirements, preserve DOM reading
  order independent of decorative layout, expose action status through an appropriate live region, and provide at least
  44-by-44 CSS-pixel touch targets.
- **NFR-002:** Game artwork shall not cause layout shift after the pair becomes interactive; missing or failed artwork
  shall use an accessible neutral fallback while retaining the game name.
- **NFR-003:** Outcome submission shall preserve the API's idempotency boundary and shall never fabricate comparison
  identifiers, game identifiers, orientation, outcome success, rating values, or model state.
- **NFR-004:** Deterministic browser tests shall cover rapid repeated activation, identical retry, expiry, keyboard use,
  and every documented outcome without contacting Steam or a live LibTaste environment.
- **NFR-005:** At a 1280-by-720 viewport, an ordinary interactive comparison shall display both game choices plus Draw
  and Skip in the initial viewport. Concision shall not reduce the one-rem body baseline or 44-by-44-pixel outcome
  targets required for accessibility.

## Acceptance scenarios

### AC-001: Choose the left game

**Given** the API has issued an unexpired comparison  
**When** the user activates the left game card once or repeatedly before rendering updates  
**Then** exactly one `LEFT_WIN` request is in flight, every outcome control is disabled, and success advances to the next
server-issued pair

### AC-002: Choose the right game by keyboard

**Given** an interactive comparison and focus outside another control  
**When** the user invokes the documented right-choice shortcut  
**Then** exactly one `RIGHT_WIN` request is submitted and the result is announced accessibly

### AC-003: Record a draw

**Given** an interactive comparison  
**When** the user activates Draw  
**Then** exactly one `DRAW` outcome is submitted and success advances to the next comparison

### AC-004: Skip a comparison

**Given** an interactive comparison  
**When** the user activates Skip  
**Then** exactly one `SKIP` outcome is submitted and success advances without claiming a rating change

### AC-005: Retry an uncertain submission

**Given** submission failed without a recorded API response  
**When** the user retries  
**Then** the same comparison ID and outcome are resubmitted and controls cannot select a conflicting outcome

### AC-006: Recover from an expired comparison

**Given** the displayed comparison expires before the outcome is accepted  
**When** the API rejects submission as expired  
**Then** the stale pair is no longer interactive and the user can request the current server-issued comparison

### AC-007: No eligible pair is available

**Given** the API cannot allocate a comparison because synchronization or eligible population is insufficient  
**When** Compare loads  
**Then** the page explains the actionable cause without fabricating a pair and links to Library where appropriate

### AC-008: Shortcut does not steal control focus

**Given** focus is on an interactive control other than the comparison shortcut surface  
**When** the user types a comparison shortcut key  
**Then** no outcome is submitted unless the focused control itself was explicitly activated

### AC-009: Advance without repeated scrolling

**Given** an interactive pair is visible and the user has not manually changed scroll position
**When** an outcome succeeds and the next pair is allocated
**Then** the comparison stage keeps a stable footprint and the next pair's outcome controls remain in the same usable
viewport without a page-collapse scroll jump

### AC-010: Prioritize comparison controls over secondary help

**Given** an ordinary pair is loaded at 1280 by 720 CSS pixels
**When** Compare is rendered
**Then** both game choices, Draw, and Skip are visible without vertical scrolling, concise final-choice guidance appears
before them, and comparison identifiers, ordinary expiry, and detailed shortcut help remain available after the controls
through accessible disclosure

## Interfaces and data

- Consumes `POST /api/v1/comparisons/next` and
  `PUT /api/v1/comparisons/{comparisonId}/result`.
- Uses the `Comparison`, `ComparisonGame`, `ComparisonResultRequest`, `ComparisonResult`, and `Problem` schemas exactly as
  defined in `openapi/openapi.yaml`.
- The server owns comparison selection, left/right orientation, identifiers, timestamps, completion, cooldowns, rating
  calculations, and aggregate effects.

## Compatibility and rollout

Requires SPEC-0001 and LibTaste API version 1.4.0. The page shall use documented response status and safe Problem Details
rather than coupling recovery to uncontracted server exception text.

## Related specifications and conflicts

- SPEC-0001 supplies authentication, transport, layout, and error handling.
- SPEC-0002 owns synchronization and eligibility changes and supplies recovery destinations.
- SPEC-0004 reflects completed comparisons in leaderboards but does not calculate or predict their effect.
- SPEC-0005 clears comparison state on logout or deletion.

## Open questions and assumptions

None.

## Implementation notes

- Model the visual comparison as a small explicit state machine so allocation, interactive choice, submitting, uncertain
  retry, recorded result, and stale recovery cannot expose contradictory controls.
- Shortcut key choices and the brief success-transition duration are implementation details, provided they are visible,
  documented, accessible, and covered by tests.

## Verification matrix

| ID | Verification type | Test or evidence | Result |
|---|---|---|---|
| AC-001 | Browser test | `apps/web/e2e/comparisons.spec.ts` — every-outcome rapid-lock journey; `ComparePage.test.tsx` rapid activation test | Passed 2026-08-10 |
| AC-002 | Browser accessibility test | `comparisons.spec.ts` right-keyboard outcome; `ComparePage.test.tsx` live-region assertion | Passed 2026-08-10 |
| AC-003 | Browser test | `comparisons.spec.ts` draw step; `ComparePage.test.tsx` Draw case | Passed 2026-08-10 |
| AC-004 | Browser test | `comparisons.spec.ts` skip step and no-rating announcement; `ComparePage.test.tsx` Skip case | Passed 2026-08-10 |
| AC-005 | Integration test | `comparisons.spec.ts` identical uncertain retry; `ComparePage.test.tsx` exact path/body retry assertion | Passed 2026-08-10 |
| AC-006 | Browser test | `comparisons.spec.ts` expired-pair recovery journey and matching component test | Passed 2026-08-10 |
| AC-007 | Browser test | `comparisons.spec.ts` actionable allocation causes; component coverage for synchronization, eligibility, rate limit, and no pair | Passed 2026-08-10 |
| AC-008 | Browser test | `comparisons.spec.ts` focus-safe shortcut journey and matching component test | Passed 2026-08-10 |
| AC-009 | Browser layout/state-transition test | `apps/web/e2e/comparisons.spec.ts` | Passed 2026-08-12 |
| AC-010 | Browser/component disclosure and viewport test | `ComparePage.test.tsx`, `apps/web/e2e/comparisons.spec.ts` | Passed 2026-08-12 |
| NFR-001 | Automated accessibility and viewport tests | `ComparePage.test.tsx` axe audit; `comparisons.spec.ts` 360px overflow and 44px target assertions across five browser projects | Passed 2026-08-12 |
| NFR-002 | Visual/component test | `ComparePage.test.tsx` artwork failure fallback; `Artwork.test.tsx` neutral fallback and aspect-ratio coverage | Passed 2026-08-10 |
| NFR-003 | Request-boundary test | `ComparePage.test.tsx` server comparison ID, orientation-derived outcome, and request-body assertions | Passed 2026-08-10 |
| NFR-004 | Browser suite review | `comparisons.spec.ts`: 25 comparison journeys passed across Chromium, Firefox, WebKit, mobile Chrome, and mobile Safari | Passed 2026-08-10 |
| NFR-005 | Browser viewport and computed-size test | `apps/web/e2e/comparisons.spec.ts` | Passed 2026-08-12 |

## Verification commands

| Command | Result | Date |
|---|---|---|
| `npm.cmd run verify` | Passed: format, lint, typecheck, 58 unit/component tests, coverage gates, OpenAPI check, and build | 2026-08-10 |
| `npm.cmd run e2e -- --workers=1` from `apps/web` | Passed: 55 tests across all five browser projects | 2026-08-10 |
| `node scripts/validate-specs.mjs` | Passed | 2026-08-10 |
| Production container build and `apps/web/scripts/verify-container.mjs` | Passed: health, SPA fallback, runtime config, compression, and security headers | 2026-08-10 |
| `npm.cmd run verify` | Passed: 92 tests, coverage gates, OpenAPI drift check, and production build | 2026-08-12 |
| Compact-stage Playwright journey across five browser projects | Passed | 2026-08-12 |

## Completion checklist

- [x] The specification was approved before implementation started.
- [x] Tests were derived from every acceptance criterion.
- [x] The implementation satisfies the requirements and non-goals.
- [x] Applicable contract, web and spec checks pass.
- [x] Required README, changelog, and ADR updates are complete.
- [x] The verification matrix contains no pending entries.
- [x] Status is `Verified` only after every item above is complete.
