# SPEC-0004: Personal and global game leaderboards

Status: Draft  
Owner: Product owner  
Created: 2026-08-09  
Last updated: 2026-08-09  
Supersedes: None  
Superseded by: None

## Problem

Users cannot currently see the personal order created by their comparisons, and visitors cannot inspect LibTaste's
global contributed-game ranking. The two API leaderboards use different score definitions and cursor semantics, so a
web presentation must make their scope and status understandable without implying invalid score comparisons.

## Desired outcome

Anyone can browse the public global leaderboard, and an authenticated user can browse their personal leaderboard with
an optional historical-games view. Both remain accessible and stable while loading additional cursor pages and clearly
explain status, evidence counts, and the non-comparability of their scores.

## Scope

- Public global leaderboard and authenticated personal leaderboard routes.
- Cursor-driven Load more behavior, stable entry rendering, loading, empty, end, and recoverable error states.
- Personal current/historical toggle.
- Rank, artwork, game name, score, ranking status, and leaderboard-specific evidence counts.
- Explanations of provisional status and distinct personal/global score meanings.

## Non-goals

- Comparing a personal score numerically with a global score.
- Search, arbitrary sorting, filtering beyond personal historical inclusion, rank history, or user-to-user leaderboards.
- Client-side ranking calculations, rating parameters, recommendations, reviews, or game-detail pages.

## Functional requirements

- **FR-001:** `/leaderboard/global` shall be accessible without authentication and shall retrieve the public global
  leaderboard using the API's default ordering and opaque continuation cursors.
- **FR-002:** `/leaderboard/me` shall require authentication and shall retrieve the authenticated user's personal
  leaderboard using the API's default current-ownership view.
- **FR-003:** Each global entry shall display rank, artwork or fallback, game name, status, contributor count, and global
  score. Each personal entry shall display rank, artwork or fallback, game name, status, comparison count, ownership,
  effective eligibility, and personal score or the absence of a score.
- **FR-004:** Both pages shall define Provisional and Ranked in user-facing language and shall explain that personal and
  global score values have different meanings and must not be directly compared.
- **FR-005:** The personal page shall offer a current/historical-games toggle. Changing it shall discard incompatible
  pages and cursors and reload from the first server page with `includeHistorical` set to the selected value.
- **FR-006:** When `nextCursor` exists, a Load more action shall append the next page exactly once without renumbering,
  locally sorting, or duplicating entries. No numbered-page or total-page controls shall be fabricated.
- **FR-007:** Loading another page shall preserve already loaded entries. A later-page failure shall provide an inline
  retry while leaving successful entries readable; a first-page failure shall provide a page-level safe retry state.
- **FR-008:** Null personal scores shall display a clear not-yet-scored value and shall not be coerced to zero. Numeric
  scores shall be presented without implying additional precision beyond the API transport value.
- **FR-009:** Empty global and personal results, terminal pagination, loading, and rate-limited states shall be distinct
  and shall not display fabricated sample rankings.

## Non-functional requirements

- **NFR-001:** Leaderboard tables or responsive lists shall meet SPEC-0001 accessibility and browser requirements,
  preserve meaningful row-header relationships, and provide an equivalent narrow-screen presentation without hiding
  required entry meaning.
- **NFR-002:** Rendering and appending the API maximum of 100 entries per page shall remain responsive and shall use the
  image and off-viewport safeguards established for library content in SPEC-0002.
- **NFR-003:** The public leaderboard shall not initiate authentication refresh, fetch personal data, or expose any
  user-specific cache entry when used by a signed-out visitor.
- **NFR-004:** Tests shall assert server ordering and cursor behavior using contract-shaped fixtures and shall fail if
  personal and global score descriptions or count labels are accidentally interchanged.

## Acceptance scenarios

### AC-001: Browse the public global leaderboard

**Given** a visitor is signed out and the global API returns entries  
**When** the visitor opens the global leaderboard  
**Then** ranked games and contributor counts are displayed without a session-refresh or personal-data request

### AC-002: Browse the personal leaderboard

**Given** an authenticated user has current library entries  
**When** the user opens My Ranking  
**Then** current entries appear in server order with comparison count, status, ownership, eligibility, and personal score
state

### AC-003: Include historical games

**Given** the personal current-only leaderboard is loaded  
**When** the user enables historical games  
**Then** existing pages and cursors are replaced by a first-page request with `includeHistorical=true`

### AC-004: Load another leaderboard page

**Given** a leaderboard response contains a continuation cursor  
**When** the user chooses Load more  
**Then** one next-page request appends entries in server order without duplicate ranks or client-side reordering

### AC-005: Recover from a later-page failure

**Given** one or more leaderboard pages are visible  
**When** loading the next page fails  
**Then** existing rows remain readable and an inline retry resubmits the same continuation request

### AC-006: Show an unscored personal game

**Given** a personal entry has a null score and Provisional status  
**When** it is rendered  
**Then** the score is described as not yet available rather than zero and Provisional is explained

### AC-007: Distinguish score meanings

**Given** a user can navigate between personal and global leaderboards  
**When** score help is read on either page  
**Then** it identifies the active leaderboard's score meaning and explicitly says the two score types are not comparable

### AC-008: Empty global leaderboard

**Given** the global API returns no entries  
**When** a visitor opens the page  
**Then** a truthful empty state is shown without sample entries or a login requirement

## Interfaces and data

- Consumes `GET /api/v1/me/leaderboard` with `includeHistorical`, `cursor`, and `limit` parameters.
- Consumes public `GET /api/v1/leaderboards/global` with `cursor` and `limit` parameters.
- Uses `PersonalLeaderboardPage`, `PersonalLeaderboardEntry`, `GlobalLeaderboardPage`, `GlobalLeaderboardEntry`,
  `RankingStatus`, and `Problem` schemas from `openapi/openapi.yaml`.
- Opaque cursors remain request-scoped transport values and are never parsed, displayed, or treated as permanent URLs.

## Compatibility and rollout

Requires SPEC-0001 and LibTaste API version 1.4.0. Personal and global pages deliberately reflect distinct API score
contracts. A future change that unifies, renames, or adds score meanings requires renewed specification approval.

## Related specifications and conflicts

- SPEC-0001 supplies the public/protected routes, transport, design, and errors.
- SPEC-0002 owns library and eligibility mutations; leaderboard ownership fields are read-only snapshots.
- SPEC-0003 causes server-side ranking changes but the client does not predict or calculate them.
- SPEC-0005 clears the personal leaderboard cache on logout or deletion and leaves public global data available.

## Open questions and assumptions

None.

## Implementation notes

- Cursor-driven infinite-query primitives may be shared between personal and global views, but row semantics and score
  help must remain leaderboard-specific.
- A semantic table may become a card-like narrow-screen layout through CSS, provided headers and accessible names retain
  every required relationship.

## Verification matrix

| ID | Verification type | Test or evidence | Result |
|---|---|---|---|
| AC-001 | Browser test | Pending | Pending |
| AC-002 | Browser test | Pending | Pending |
| AC-003 | Integration test | Pending | Pending |
| AC-004 | Browser test | Pending | Pending |
| AC-005 | Browser test | Pending | Pending |
| AC-006 | Component accessibility test | Pending | Pending |
| AC-007 | Content/component test | Pending | Pending |
| AC-008 | Browser test | Pending | Pending |
| NFR-001 | Automated accessibility and viewport tests | Pending | Pending |
| NFR-002 | Performance-oriented component test | Pending | Pending |
| NFR-003 | Network-boundary test | Pending | Pending |
| NFR-004 | Contract fixture review | Pending | Pending |

## Verification commands

| Command | Result | Date |
|---|---|---|
| Pending | Pending | — |

## Completion checklist

- [ ] The specification was approved before implementation started.
- [ ] Tests were derived from every acceptance criterion.
- [ ] The implementation satisfies the requirements and non-goals.
- [ ] Applicable contract, web and spec checks pass.
- [ ] Required README, changelog, and ADR updates are complete.
- [ ] The verification matrix contains no pending entries.
- [ ] Status is `Verified` only after every item above is complete.
