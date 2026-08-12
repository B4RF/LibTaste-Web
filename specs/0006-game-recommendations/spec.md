# SPEC-0006: Personalized game recommendations

Status: Verified  
Owner: Product owner  
Created: 2026-08-12  
Last updated: 2026-08-12  
Supersedes: None  
Superseded by: None

## Problem

LibTaste users build meaningful personal preference evidence through comparisons, but the web application does not let
them use that evidence to discover games outside their current or historical Steam library. The API now supplies
bounded personalized recommendations and distinct successful empty states, but those results need an understandable,
private, and accessible product journey.

## Desired outcome

An authenticated user can open a first-class Recommendations page, understand why each suggested game may suit their
taste, and continue to its Steam store page. Users without a usable result receive an accurate explanation and only an
action that can genuinely help.

## Scope

- A protected Recommendations route and primary-navigation entry.
- A bounded, non-paginated presentation of the API-default recommendation result set.
- Plain-language predicted-rank, source, support, and item-seed explanations.
- Distinct insufficient-personal-data, no-variation, insufficient-community-data, and exhausted-catalog states.
- Loading, private caching, rate-limit, recoverable failure, session cleanup, accessibility, and responsive behavior.

## Non-goals

- A configurable result count, pagination, load-more control, or successful-state manual refresh.
- Recommendation feedback, dismissal, purchase tracking, or recording Steam store visits.
- Genre, tag, price, review, playtime, popularity, confidence, or purchase-likelihood explanations.
- Exposing raw algorithm scores, normalization details, another user's identity, or another user's rating evidence.
- Reproducing or interpreting the server-side recommendation algorithm in the browser.

## Functional requirements

- **FR-001:** Recommendations shall be available only through a protected `/recommendations` route, and the authenticated
  navigation shall place a `Recommendations` link immediately after `Compare`.
- **FR-002:** Opening the route shall automatically request `GET /api/v1/me/recommendations` without a limit override so
  the API default of 20 applies; the page shall expose no count selector, cursor, pagination, load-more action, or
  successful-state refresh action.
- **FR-003:** The page introduction shall explain in plain language that suggestions use the current user's ratings and
  anonymous community patterns and include only games absent from that user's current and historical Steam library. It
  shall not describe collaborative-filtering or normalization formulas.
- **FR-004:** An `OK` response shall preserve the API's recommendation order and render every returned result as a
  responsive game card with lazy artwork, name, source, predicted-rank text, applicable support counts, and a safe
  external Steam store link derived from the Steam App ID.
- **FR-005:** Predicted rank shall be rendered exactly as
  `Predicted to rank above X% of your rated games.` without describing the percentile as confidence, purchase likelihood,
  or a leaderboard score.
- **FR-006:** Sources shall be presented as `Similar games` for `ITEM`, `Similar players` for `USER`, and
  `Similar games and players` for `BLENDED`; raw transport enum labels shall not be user-facing.
- **FR-007:** A result shall show `Supported by N similar players` only when user-model evidence applies and
  `Supported by N rated games` only when item-model evidence applies. A blended result shall show both, and irrelevant
  zero counts shall be omitted.
- **FR-008:** An `ITEM` or `BLENDED` result shall render the returned `becauseOf` games under `Because you rated`, with
  lazy artwork, name, and adjusted similarity formatted as a percentage. When `becauseOfTotalCount` exceeds the returned
  seed count, the card shall add `and N more`. A `USER` result shall render no item-seed explanation.
- **FR-009:** A Steam store link shall use the recommendation's App ID, open in a new browser tab, identify its external
  destination accessibly, and prevent the opened page from controlling the LibTaste window.
- **FR-010:** `INSUFFICIENT_DATA` with `NOT_ENOUGH_PERSONAL_RATINGS` shall explain that more ranked, non-excluded games
  are needed and link to Compare. It shall not claim a numeric threshold because the API does not expose its configured
  value.
- **FR-011:** `INSUFFICIENT_DATA` with `NO_RATING_VARIATION` shall explain that the user's ratings do not yet show enough
  differentiation, link to Compare, and avoid treating relatively lower-ranked games as disliked.
- **FR-012:** `INSUFFICIENT_DATA` with `NOT_ENOUGH_COMMUNITY_DATA` shall explain that matching community evidence is not
  yet sufficient and suggest returning later, without promising that more comparisons by the current user will fix it.
- **FR-013:** `NO_CANDIDATES` shall explain that all otherwise eligible community-rated candidates already occur in the
  user's current or historical library and shall not present a misleading recovery action.
- **FR-014:** The initial request shall expose an accessible `Finding recommendations...` status. A recoverable failure
  shall retain the page context, show only safe Problem Details information, and provide an explicit retry. A `429`
  response shall tell the user to wait before retrying rather than encourage an immediate repeat.
- **FR-015:** Successful recommendation data shall be treated as fresh for 60 seconds and shall have no automatic retry
  or focus-driven refetch during that window. Completed comparisons and observed library changes shall invalidate the
  user-scoped recommendation query so the next visit can use current committed evidence.
- **FR-016:** Signing out, losing the session, revoking sessions, or deleting the account shall cancel recommendation
  work and remove recommendation data with the other protected query state; it shall never become public cache data.

## Non-functional requirements

- **NFR-001:** The route, loading and empty statuses, cards, external links, explanation relationships, retry behavior,
  focus states, and announcements shall satisfy the keyboard, screen-reader, reduced-motion, and responsive behavior
  established by SPEC-0001 and shall pass automated accessibility checks.
- **NFR-002:** Recommendation requests shall use the shared bearer-token, in-memory-session, one-refresh, cancellation,
  safe Problem Details, and user-scoped TanStack Query boundaries from SPEC-0001 without persisting tokens or results in
  browser storage.
- **NFR-003:** Rendering shall consume generated OpenAPI types, tolerate an empty bounded array without fabricating
  results, preserve server ordering and transport values, and avoid exposing raw scores or data not present in the
  recommendation contract.
- **NFR-004:** Up to 100 contract-valid cards and their seed explanations shall remain usable at narrow and wide
  supported viewports, with lazy artwork and off-viewport containment where it materially limits rendering work.

## Acceptance scenarios

### AC-001: Open protected recommendations

**Given** an authenticated user navigates from Compare to Recommendations  
**When** the protected route opens  
**Then** one default-sized recommendation request is made and an accessible loading status precedes the result

### AC-002: Present ordered recommendation cards

**Given** the API returns ordered `ITEM`, `USER`, and `BLENDED` recommendations  
**When** the response is rendered  
**Then** the card order is unchanged and each card shows the agreed predicted-rank sentence, plain-language source,
applicable support counts, and a safe official Steam store link

### AC-003: Explain item evidence

**Given** an item-supported result contains three returned seed games and a larger total seed count  
**When** its explanation is rendered  
**Then** the seeds appear under `Because you rated` with artwork, names, similarity percentages, and the omitted count,
without exposing another user's evidence

### AC-004: Guide an underdeveloped profile

**Given** the API returns `NOT_ENOUGH_PERSONAL_RATINGS`  
**When** the empty state is rendered  
**Then** it links to Compare and asks for more ranked, non-excluded games without claiming a numeric requirement

### AC-005: Guide a profile without variation

**Given** the API returns `NO_RATING_VARIATION`  
**When** the empty state is rendered  
**Then** it links to Compare, asks for clearer differentiation, and does not describe relatively lower ratings as dislike

### AC-006: Distinguish unavailable community evidence

**Given** the API returns `NOT_ENOUGH_COMMUNITY_DATA`  
**When** the empty state is rendered  
**Then** it suggests returning later without promising that a current-user action will make recommendations available

### AC-007: Distinguish an exhausted catalog

**Given** the API returns `NO_CANDIDATES`  
**When** the empty state is rendered  
**Then** it explains that every otherwise eligible candidate occurs in the user's current or historical library and
offers no misleading action

### AC-008: Recover from request failures

**Given** a recommendation request fails with safe Problem Details  
**When** the page handles a recoverable error or rate limit  
**Then** a recoverable error offers explicit retry while a rate limit tells the user to wait, and neither fabricates or
retains stale recommendations as a new result

### AC-009: Keep recommendation data private and current

**Given** successful recommendations are cached for the signed-in user  
**When** 60 seconds pass, relevant user evidence changes, or the session is cleared  
**Then** freshness and invalidation follow FR-015 and session clearing cancels and removes the protected data

## Interfaces and data

- Consumes authenticated `GET /api/v1/me/recommendations` from `openapi/openapi.yaml` without a `limit` parameter.
- Uses `RecommendationResponse`, `RecommendationEntry`, `RecommendationSource`, and `RecommendationBecauseOf` from the
  generated TypeScript contract.
- Treats `status` and conditional `reason` as the authority for successful content and empty-state selection.
- Constructs official store destinations as `https://store.steampowered.com/app/{appId}`; no visit or feedback event is
  persisted by LibTaste.
- Adds no client-side persistence or browser-storage data.

## Compatibility and rollout

Requires the additive personalized-recommendations contract in LibTaste API SPEC-0007. Deploy the compatible API before
making the web navigation available. Regenerate the committed TypeScript contract from `openapi/openapi.yaml`; do not
edit generated transport types by hand.

## Related specifications and conflicts

- SPEC-0001 supplies protected routing, authentication recovery, responsive accessibility, safe Problem Details, and
  private query boundaries.
- SPEC-0002 supplies library ownership and eligibility changes that invalidate recommendation freshness; this feature
  does not change library records.
- SPEC-0003 supplies new personal comparison evidence that invalidates recommendation freshness; recommendations do not
  alter comparison allocation or outcomes.
- SPEC-0004 owns personal and global leaderboard meaning. Recommendation percentile and source remain distinct from
  leaderboard rank, score, status, and evidence.
- SPEC-0005 supplies complete session and account cleanup, which now also removes recommendation state.

These specifications remain simultaneously valid; this specification does not supersede them.

## Open questions and assumptions

None.

## Implementation notes

- Keep recommendation API access and presentation in a sibling feature slice under `apps/web/src/features/`.
- Reuse the shared API client, authentication context, artwork fallback, content copy, Problem Details presentation,
  route shell, design tokens, and protected-query cleanup conventions.
- Prefer invalidating the recommendation query from existing successful mutation boundaries over coupling feature page
  components to one another.
- No architectural decision beyond the accepted SPA and session boundary in ADR-0001 is introduced.

## Verification matrix

Complete this table during implementation. Every acceptance criterion and additional requirement that needs independent
evidence must have a row.

| ID | Verification type | Test or evidence | Result |
|---|---|---|---|
| AC-001 | Component/browser test | `apps/web/src/app/App.test.tsx`; `apps/web/src/features/recommendations/RecommendationsPage.test.tsx`; `apps/web/e2e/recommendations.spec.ts` | Passed 2026-08-12 |
| AC-002 | Component/browser test | `RecommendationsPage.test.tsx`; `recommendations.spec.ts` ordered ITEM, USER, and BLENDED result journey | Passed 2026-08-12 |
| AC-003 | Component accessibility test | `RecommendationsPage.test.tsx` seed artwork, names, percentage, omitted-count, relationship, and axe assertions | Passed 2026-08-12 |
| AC-004 | Component/browser test | `RecommendationsPage.test.tsx` personal-rating empty state and Compare recovery | Passed 2026-08-12 |
| AC-005 | Component test | `RecommendationsPage.test.tsx` no-variation copy and Compare recovery | Passed 2026-08-12 |
| AC-006 | Component test | `RecommendationsPage.test.tsx` community-evidence state without current-user action claim | Passed 2026-08-12 |
| AC-007 | Component test | `RecommendationsPage.test.tsx` exhausted-catalog state without recovery action | Passed 2026-08-12 |
| AC-008 | Component/transport test | `RecommendationsPage.test.tsx` safe Problem Details retry, stale-result absence, and non-retrying 429 state | Passed 2026-08-12 |
| AC-009 | Cache/session integration test | `RecommendationsPage.test.tsx`; `ComparePage.test.tsx`; `LibraryPage.test.tsx`; `ProfileSyncStatus.tsx` | Passed 2026-08-12 |
| NFR-001 | Automated accessibility and viewport tests | `RecommendationsPage.test.tsx` axe audit; `recommendations.spec.ts` narrow-screen overflow assertion across five browser projects | Passed 2026-08-12 |
| NFR-002 | Request-security and cache-boundary tests | `RecommendationsPage.test.tsx`; `App.test.tsx`; `recommendations.spec.ts` bearer request, protected route, user scope, freshness, and session cleanup | Passed 2026-08-12 |
| NFR-003 | Generated-contract fixture review | OpenAPI-typed fixtures in `RecommendationsPage.test.tsx`; generated `apps/web/src/api/generated.ts`; OpenAPI drift check | Passed 2026-08-12 |
| NFR-004 | Performance-oriented component/browser test | `RecommendationsPage.test.tsx` renders 100 contract-valid ordered cards with lazy artwork and content visibility | Passed 2026-08-12 |

## Verification commands

Record the exact applicable commands and their final results.

| Command | Result | Date |
|---|---|---|
| `node scripts/validate-specs.mjs` | Passed | 2026-08-12 |
| `npm.cmd run test --workspace apps/web` | Passed: 89 tests | 2026-08-12 |
| `npm.cmd run typecheck --workspace apps/web` | Passed | 2026-08-12 |
| `npm.cmd run lint --workspace apps/web` | Passed | 2026-08-12 |
| `npm.cmd run openapi:check --workspace apps/web` | Passed | 2026-08-12 |
| `npm.cmd run verify` | Passed: format, lint, typecheck, 89 tests, coverage (89.82% statements, 83.47% branches, 92% functions, 91.9% lines), OpenAPI drift check, and production build | 2026-08-12 |
| `$env:MOZ_WEBRENDER='0'; $env:MOZ_HEADLESS_WIDTH='1280'; $env:MOZ_HEADLESS_HEIGHT='720'; npx.cmd playwright test --workers=1` from `apps/web` | Passed: 85 tests across Chromium, Firefox, WebKit, mobile Chrome, and mobile Safari | 2026-08-12 |

## Completion checklist

- [x] The specification was approved before implementation started.
- [x] Tests were derived from every acceptance criterion.
- [x] The implementation satisfies the requirements and non-goals.
- [x] Applicable contract, web and spec checks pass.
- [x] Required README, changelog, and ADR updates are complete.
- [x] The verification matrix contains no pending entries.
- [x] Status is `Verified` only after every item above is complete.
