# SPEC-0003: Pairwise game comparisons

Status: Verified
Owner: Product owner  
Created: 2026-08-09  
Last updated: 2026-08-13
Supersedes: None  
Superseded by: None

## Problem

LibTaste's ranking model depends on users resolving server-selected pairs, but no web experience currently presents a
pair or safely submits its outcome. When a displayed game should no longer participate, users currently have to leave
Compare, find it again in Library, change its eligibility, and return. Users need an immediate, artwork-forward flow
that remains correct when outcome or eligibility requests are slow, retried, expired, exhausted, or unavailable because
their Steam library cannot produce a pair.

## Desired outcome

An authenticated eligible user can repeatedly choose the preferred game, declare a draw, skip a comparison, or exclude
either displayed game from future comparisons without leaving Compare. The compact, stable viewport provides concise
irreversible-action guidance, keyboard and pointer accessibility, idempotent submission behavior, and recovery from
every documented API response.

## Scope

- Fetching or restoring the API's active comparison.
- Responsive left/right game cards using API-supplied names and artwork.
- Immediate left win, right win, draw, and skip outcomes.
- Directly excluding either displayed game from future comparisons and advancing without a rating change.
- Submission locking, retry behavior, keyboard shortcuts, expiry awareness, and loading the next pair.
- Stable above-the-fold comparison controls with progressively disclosed secondary information.
- Guidance when synchronization, library availability, or eligible population prevents allocation.

## Non-goals

- Client-selected or client-reoriented pairs, undo, comparison history, rating calculations, or score prediction.
- Setting Default or Include eligibility, bulk eligibility management, or reversing an exclusion from Compare; those
  controls remain in Library.
- Game recommendations, free-form reviews, tags, or social sharing.

## Functional requirements

- **FR-001:** Opening Compare shall call `POST /comparisons/next` once per allocation attempt and render the exact
  server-issued left and right orientation, game names, and artwork. The comparison ID and ordinary submission-window
  state shall remain available in an expandable details surface without preceding the outcome controls.
- **FR-002:** Activating the left or right game card shall immediately submit `LEFT_WIN` or `RIGHT_WIN` respectively;
  separate actions shall submit `DRAW` and `SKIP` without a per-choice confirmation dialog.
- **FR-003:** The page shall state concisely before interaction that choices are final and that a retry repeats the same
  choice; it shall not describe an API retry of the identical outcome as an undo or a second comparison.
- **FR-004:** All outcome and exclusion controls shall disable synchronously after the first activation and remain
  locked until that operation reaches a safe next state. Pointer, touch, keyboard activation, rerender, and repeated
  events shall not create conflicting requests.
- **FR-005:** A successful submission shall acknowledge the recorded outcome briefly and automatically request the next
  comparison. The previous pair shall not be reused as the visual next pair unless the API returns it as active.
- **FR-006:** If submission fails before a result is known, the exact selected outcome shall remain available for an
  explicit identical retry. The UI shall not permit selecting a different outcome for that comparison.
- **FR-007:** A conflicting, expired, or missing comparison response shall discard the stale interactive pair and offer
  retrieval of the current server state with a safe Problem Details explanation.
- **FR-008:** Allocation responses indicating insufficient eligible games, unavailable synchronization, rate limiting,
  or no available pair shall render distinct non-interactive recovery states and link to Library when eligibility or
  synchronization can be addressed there.
- **FR-009:** Keyboard shortcuts shall use the familiar gamer-oriented W/A/S/D layout: W for draw, A for the left game,
  S for skip, and D for the right game. The mapping shall be documented by the visible action hints and an accessible
  expandable help surface, accept either letter case, and remain inactive while submitting or when focus is in another
  interactive or text-entry control.
- **FR-010:** Comparison expiry shall be conveyed without relying on color alone. Ordinary expiry information may live
  in expandable details, but an approaching or locally passed expiry shall become visibly prominent; the client shall
  treat the server response as authoritative if local and server time disagree.
- **FR-011:** Allocation, submission acknowledgement, and loading the next pair shall preserve a stable comparison-stage
  footprint and scroll position. Advancing successfully shall not collapse the page or require a desktop user to scroll
  back to the outcome controls for every pair.
- **FR-012:** Each displayed game shall have a separate `Exclude from comparisons` action whose accessible name includes
  the game name. Activating it shall use that `ComparisonGame.appId` to set the game's eligibility behavior to
  `EXCLUDED` without a confirmation dialog, and shall never select that game as a winner or activate another outcome.
- **FR-013:** After the API confirms `EXCLUDED`, Compare shall retire the active matchup without a rating change by
  submitting exactly one `SKIP`, announce which game was excluded, and automatically request the next server-issued
  pair. If the eligibility change has already made the comparison stale or missing, Compare shall treat that pair as
  safely retired and request the current server state rather than presenting the excluded game as interactive again.
- **FR-014:** A rejected eligibility update shall not submit a comparison outcome or claim that exclusion succeeded; the
  current pair shall remain available and the exclusion can be retried. If the eligibility response is uncertain, only
  the identical `EXCLUDED` update may be retried until its state is resolved. If retirement by `SKIP` becomes uncertain
  after exclusion was confirmed, only the identical `SKIP` may be retried and the eligibility update shall not be sent
  again.
- **FR-015:** A confirmed exclusion from Compare shall invalidate the same user-scoped Library, personal-ranking, and
  recommendation data as an eligibility change made from Library so later navigation cannot show known-stale state.
- **FR-016:** Exclude shall remain available for each displayed game but use a compact, visually tertiary treatment
  clearly subordinate to every comparison outcome. Its accessible target shall remain full-sized even when its visible
  control is reduced to quiet text or an icon-and-label treatment; hierarchy shall not rely on reducing legibility or
  hit-target size.
- **FR-017:** Each displayed game shall provide a separate, visually quiet `View on Steam` link derived from its App ID.
  It shall open the official Steam store page in a new tab, identify the game and external destination accessibly, and
  shall not activate a preference outcome, exclusion, or keyboard shortcut.
- **FR-018:** The comparison composition shall use two large, landscape artwork choices with a narrow centered control
  column between them. Draw shall appear immediately above Skip in that column, both controls shall use compact visible
  dimensions with minimal whitespace between them while retaining 44-by-44-pixel targets, and each image shall preserve
  more of its source instead of cropping merely to fill a mismatched frame.

## Non-functional requirements

- **NFR-001:** The comparison page shall meet SPEC-0001 accessibility and responsive requirements, preserve DOM reading
  order independent of decorative layout, expose action status through an appropriate live region, and provide at least
  44-by-44 CSS-pixel touch targets.
- **NFR-002:** Game artwork shall not cause layout shift after the pair becomes interactive, shall minimize avoidable
  cropping while using the available comparison width, and shall use an accessible neutral fallback while retaining the
  game name when artwork is missing or fails.
- **NFR-003:** Outcome and eligibility submission shall preserve the APIs' idempotency boundaries and shall never
  fabricate comparison identifiers, game identifiers, orientation, outcome success, eligibility success, rating
  values, or model state.
- **NFR-004:** Deterministic browser tests shall cover rapid repeated activation, identical retry, expiry, keyboard use,
  every documented outcome, and each exclusion phase without contacting Steam or a live LibTaste environment.
- **NFR-005:** At a 1280-by-720 viewport, an ordinary interactive comparison shall display both artwork-forward game
  choices plus Draw and Skip, both compact tertiary exclusion actions, and both Steam links in the initial viewport.
  Draw and Skip shall form a compact centered stack between the primary choices, and all comparison outcomes shall
  remain more prominent than exclusion and store navigation. Concision shall not reduce the one-rem body baseline or
  44-by-44-pixel interactive targets required for accessibility.
- **NFR-006:** Steam store destinations shall be constructed only as `https://store.steampowered.com/app/{appId}` from
  the server-issued App ID and shall use safe external-link attributes without adding visit tracking.

## Acceptance scenarios

### AC-001: Choose the left game

**Given** the API has issued an unexpired comparison  
**When** the user activates the left game card or presses A once or repeatedly before rendering updates
**Then** exactly one `LEFT_WIN` request is in flight, every outcome control is disabled, and success advances to the next
server-issued pair

### AC-002: Choose the right game by keyboard

**Given** an interactive comparison and focus outside another control  
**When** the user presses D
**Then** exactly one `RIGHT_WIN` request is submitted and the result is announced accessibly

### AC-003: Record a draw

**Given** an interactive comparison  
**When** the user activates Draw or presses W
**Then** exactly one `DRAW` outcome is submitted and success advances to the next comparison

### AC-004: Skip a comparison

**Given** an interactive comparison  
**When** the user activates Skip or presses S
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
**When** the user types W, A, S, or D
**Then** no outcome is submitted unless the focused control itself was explicitly activated

### AC-009: Advance without repeated scrolling

**Given** an interactive pair is visible and the user has not manually changed scroll position
**When** an outcome succeeds and the next pair is allocated
**Then** the comparison stage keeps a stable footprint and the next pair's outcome controls remain in the same usable
viewport without a page-collapse scroll jump

### AC-010: Prioritize comparison controls over secondary help

**Given** an ordinary pair is loaded at 1280 by 720 CSS pixels
**When** Compare is rendered
**Then** both large artwork-forward game choices, a compact centered Draw/Skip stack with minimal space between its
controls, both compact tertiary exclusion actions, and both quiet Steam links are visible without vertical scrolling;
every outcome is visually more prominent than exclusion or store navigation, concise final-choice guidance appears
before them, and comparison identifiers, ordinary expiry, and detailed shortcut help remain available after the controls
through accessible disclosure

### AC-011: Exclude a displayed game

**Given** an interactive comparison containing a game the user no longer wants in comparisons
**When** the user activates that game's Exclude from comparisons action
**Then** exactly one `EXCLUDED` update is sent for that game's App ID, all pair actions lock, the confirmed exclusion is
announced, the active matchup is retired without a rating change, and the next server-issued pair is loaded

### AC-012: Recover when exclusion is not confirmed

**Given** an interactive comparison whose eligibility update is rejected or has an uncertain response
**When** the user attempts to exclude one game
**Then** no winner or draw is submitted, exclusion success is not fabricated, and the user can either continue from a
known rejection or retry only the identical exclusion after an uncertain response

### AC-013: Recover while retiring an excluded matchup

**Given** exclusion was confirmed but the subsequent `SKIP` is uncertain, stale, or missing
**When** Compare handles the retirement response
**Then** it never resends the eligibility update, permits only an identical `SKIP` retry when the result is uncertain,
and safely requests the current server pair when the old comparison is stale or missing

### AC-014: Preserve the common-action hierarchy

**Given** an ordinary interactive matchup
**When** its controls are rendered at a supported viewport
**Then** every comparison outcome retains a stronger action treatment, each Exclude action has a compact tertiary visual
footprint while retaining an accessible label and 44-by-44-pixel target, and none of these controls becomes ambiguous
with choosing a game

### AC-015: Inspect a matchup game on Steam

**Given** an interactive comparison containing a server-issued game App ID
**When** the user activates that game's View on Steam link
**Then** the official Steam store page opens in a new tab and no comparison outcome or eligibility request is submitted

### AC-016: Prioritize large, uncropped game artwork

**Given** an ordinary comparison whose two games have artwork
**When** Compare is rendered at a supported desktop or mobile viewport
**Then** both images use the dominant available comparison area, preserve substantially more of their source image than
the prior cropped-card treatment, and remain stable while the matchup is interactive

## Interfaces and data

- Consumes `POST /api/v1/comparisons/next`, `PUT /api/v1/comparisons/{comparisonId}/result`, and
  `PUT /api/v1/me/library/{appId}/eligibility`.
- Uses the `Comparison`, `ComparisonGame`, `ComparisonResultRequest`, `ComparisonResult`, `EligibilityRequest`,
  `LibraryItem`, and `Problem` schemas exactly as defined in `openapi/openapi.yaml`.
- Constructs official store destinations as `https://store.steampowered.com/app/{appId}` without persisting a visit.
- The server owns comparison selection, left/right orientation, identifiers, timestamps, completion, cooldowns, rating
  calculations, and aggregate effects.

## Compatibility and rollout

Requires SPEC-0001 and LibTaste API version 1.4.0. The page shall use documented response status and safe Problem Details
rather than coupling recovery to uncontracted server exception text.

## Related specifications and conflicts

- SPEC-0001 supplies authentication, transport, layout, and error handling.
- SPEC-0002 defines server-confirmed eligibility behavior and Library management; Compare reuses its single-game
  `EXCLUDED` update without duplicating the full eligibility control.
- SPEC-0004 reflects completed comparisons in leaderboards but does not calculate or predict their effect.
- SPEC-0005 clears comparison state on logout or deletion.

## Open questions and assumptions

- Assumption for approval: exclusion is intentionally one action without confirmation because it is reversible in
  Library; the current pair is retired as `SKIP` so exclusion never records a preference outcome.
- Assumption for approval: Steam inspection remains a separate quiet link rather than making the artwork inside the
  game-choice button perform two competing actions.
- Selected direction for approval: use the large-artwork option with Draw and Skip in a narrow centered stack, keeping
  Exclude as a quiet icon-and-label footer utility.
- Proposed shortcut direction for approval: use W/A/S/D because the layout is familiar to gamers, mapping vertical
  actions to W (draw) and S (skip) and horizontal choices to A (left) and D (right).

## Implementation notes

- Model the visual comparison as a small explicit state machine so allocation, interactive choice, submitting, uncertain
  retry, exclusion, retirement, recorded result, and stale recovery cannot expose contradictory controls.
- Shortcut key choices and the brief success-transition duration are implementation details, provided they are visible,
  documented, accessible, and covered by tests.

## Verification matrix

| ID | Verification type | Test or evidence | Result |
|---|---|---|---|
| AC-001 | Browser/component shortcut test | `apps/web/e2e/comparisons.spec.ts` and `ComparePage.test.tsx` verify A/a submits one `LEFT_WIN` while rapid activation remains locked | Passed 2026-08-13 |
| AC-002 | Browser/component shortcut test | `comparisons.spec.ts` and `ComparePage.test.tsx` verify D/d submits one `RIGHT_WIN` and announces the result | Passed 2026-08-13 |
| AC-003 | Browser/component shortcut test | `comparisons.spec.ts` and `ComparePage.test.tsx` verify W/w submits one `DRAW` and advances | Passed 2026-08-13 |
| AC-004 | Browser/component shortcut test | `comparisons.spec.ts` and `ComparePage.test.tsx` verify S/s submits one `SKIP` without claiming a rating change | Passed 2026-08-13 |
| AC-005 | Integration test | `comparisons.spec.ts` identical uncertain retry; `ComparePage.test.tsx` exact path/body retry assertion | Passed 2026-08-10 |
| AC-006 | Browser test | `comparisons.spec.ts` expired-pair recovery journey and matching component test | Passed 2026-08-10 |
| AC-007 | Browser test | `comparisons.spec.ts` actionable allocation causes; component coverage for synchronization, eligibility, rate limit, and no pair | Passed 2026-08-10 |
| AC-008 | Browser/component focus-safety test | `comparisons.spec.ts` and `ComparePage.test.tsx` verify W/A/S/D remains inactive while a Steam link or other interactive control owns focus | Passed 2026-08-13 |
| AC-009 | Browser layout/state-transition test | `apps/web/e2e/comparisons.spec.ts` | Passed 2026-08-12 |
| AC-010 | Browser/component disclosure and viewport test | `ComparePage.test.tsx`, `apps/web/e2e/comparisons.spec.ts` — large choices flank the compact centered Draw/Skip stack and all secondary utilities remain in the initial 1280×720 viewport | Passed 2026-08-13 |
| AC-011 | Component/browser request-sequence test | `ComparePage.test.tsx`; `comparisons.spec.ts` server-confirmed exclusion and `SKIP` sequence | Passed 2026-08-13 |
| AC-012 | Component failure-state test | `ComparePage.test.tsx` rejected and uncertain eligibility cases | Passed 2026-08-13 |
| AC-013 | Component retirement-state test | `ComparePage.test.tsx` uncertain and stale retirement cases | Passed 2026-08-13 |
| AC-014 | Component/browser computed-style test | `apps/web/e2e/comparisons.spec.ts` — icon-and-label Exclude remains tertiary with a 44px target and smaller footprint than outcomes | Passed 2026-08-13 |
| AC-015 | Component/browser external-link isolation test | `ComparePage.test.tsx`, `apps/web/e2e/comparisons.spec.ts` — exact per-game Steam URLs, safe new-tab attributes, focus-safe shortcuts, and no mutation | Passed 2026-08-13 |
| AC-016 | Component/browser artwork layout test | `apps/web/e2e/comparisons.spec.ts` — loaded artwork exceeds the required dominant dimensions, uses contained scaling, and stays stable during advancement | Passed 2026-08-13 |
| NFR-001 | Automated accessibility and viewport tests | `ComparePage.test.tsx`, `apps/web/e2e/comparisons.spec.ts` — axe coverage, DOM order, 360px overflow, compact 1280×720 stage, and 44px targets | Passed 2026-08-13 |
| NFR-002 | Visual/component test | `ComparePage.test.tsx`, `Artwork.test.tsx`, `apps/web/e2e/comparisons.spec.ts` — contained large artwork plus existing failure fallback | Passed 2026-08-13 |
| NFR-003 | Request-boundary test | `ComparePage.test.tsx` and `comparisons.spec.ts` exact comparison, App ID, eligibility, outcome, and retry assertions | Passed 2026-08-13 |
| NFR-004 | Browser suite review | Deterministic W/A/S/D journeys, exclusion, and existing comparison coverage across all five browser projects | Passed 2026-08-13 |
| NFR-005 | Browser viewport and computed-style test | `apps/web/e2e/comparisons.spec.ts` — centered Draw/Skip geometry, 4px maximum control gap, sub-96px control widths, large art, and stable 1280×720 stage | Passed 2026-08-13 |
| NFR-006 | External-destination test | `ComparePage.test.tsx` exact URL, `target="_blank"`, `rel="noreferrer"`, focus safety, and request-isolation assertions | Passed 2026-08-13 |

## Verification commands

| Command | Result | Date |
|---|---|---|
| `npm.cmd run verify` | Passed: format, lint, typecheck, 58 unit/component tests, coverage gates, OpenAPI check, and build | 2026-08-10 |
| `npm.cmd run e2e -- --workers=1` from `apps/web` | Passed: 55 tests across all five browser projects | 2026-08-10 |
| `node scripts/validate-specs.mjs` | Passed | 2026-08-10 |
| Production container build and `apps/web/scripts/verify-container.mjs` | Passed: health, SPA fallback, runtime config, compression, and security headers | 2026-08-10 |
| `npm.cmd run verify` | Passed: 92 tests, coverage gates, OpenAPI drift check, and production build | 2026-08-12 |
| Compact-stage Playwright journey across five browser projects | Passed | 2026-08-12 |
| `npm.cmd run test --workspace apps/web -- --run src/features/comparisons/ComparePage.test.tsx` | Passed: 22 tests | 2026-08-13 |
| `npm.cmd run verify` | Passed: formatting, lint, typecheck, 98 tests, coverage (90.39% statements, 84.18% branches, 92.08% functions, 92.56% lines), OpenAPI drift check, and production build | 2026-08-13 |
| `$env:MOZ_WEBRENDER='0'; $env:MOZ_HEADLESS_WIDTH='1280'; $env:MOZ_HEADLESS_HEIGHT='720'; npx.cmd playwright test --workers=1` from `apps/web` | Passed: 105 tests across five browser projects | 2026-08-13 |
| `node scripts/validate-specs.mjs` | Passed after verification evidence and lifecycle update | 2026-08-13 |
| `npm.cmd run verify` | Passed: format, lint, typecheck, 100 tests, coverage (90.43% statements, 84.52% branches, 92.17% functions, 92.59% lines), OpenAPI drift check, and production build | 2026-08-13 |
| Full Playwright matrix | Passed: 105 tests across Chromium, Firefox, WebKit, mobile Chrome, and mobile Safari | 2026-08-13 |
| `npm.cmd run verify` | Passed: format, lint, typecheck, 101 tests, coverage (90.43% statements, 84.52% branches, 92.17% functions, 92.59% lines), OpenAPI drift check, and production build | 2026-08-13 |
| Full Playwright matrix after selected-layout implementation | Passed: 105 tests across Chromium, Firefox, WebKit, mobile Chrome, and mobile Safari | 2026-08-13 |
| `npm.cmd run test --workspace apps/web -- --run src/features/comparisons/ComparePage.test.tsx` | Passed: 27 component tests, including case-insensitive W/A/S/D mappings, visible hints, help copy, and focus safety | 2026-08-13 |
| Chromium `apps/web/e2e/comparisons.spec.ts` journey | Passed: 7 comparison tests, including rapid W/A/S/D outcomes and focus safety at 360px | 2026-08-13 |
| `npm.cmd run verify` | Passed: formatting, lint, typecheck, 104 tests, coverage (90.43% statements, 84.52% branches, 92.17% functions, 92.59% lines), OpenAPI drift check, and production build | 2026-08-13 |
| Full Playwright matrix after W/A/S/D implementation | Passed: 105 tests across Chromium, Firefox, WebKit, mobile Chrome, and mobile Safari | 2026-08-13 |
| `node scripts/validate-specs.mjs` | Passed after W/A/S/D evidence and lifecycle promotion | 2026-08-13 |

## Completion checklist

- [x] The specification was approved before implementation started.
- [x] Tests were derived from every acceptance criterion.
- [x] The implementation satisfies the requirements and non-goals.
- [x] Applicable contract and web checks pass; the spec validator is run immediately before lifecycle promotion.
- [x] Required README and changelog updates are complete; no architectural decision changed, so no ADR is required.
- [x] The verification matrix contains no pending entries.
- [x] Status is `Verified` only after every item above is complete.
