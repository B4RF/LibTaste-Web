# SPEC-0004: Personal, global, and Steam-friend game leaderboards

Status: Implemented
Owner: Product owner  
Created: 2026-08-09  
Last updated: 2026-08-21  
Supersedes: None  
Superseded by: None

## Problem

Users can see their own ranking and the public global ranking, but cannot discover participating Steam friends or view
the intentionally reduced rankings those friends chose to share. The API now supports reciprocal, private-by-default
friend-leaderboard sharing and automatically includes meaningful ranked history in an owner's leaderboard, making the
web's explicit historical toggle obsolete.

## Desired outcome

Anyone can browse the public global leaderboard. An authenticated user can browse their personal leaderboard, opt in or
out of reciprocal Steam-friend leaderboard sharing, discover participating current Steam friends, and open a friend's
minimal scoreless ranking. All collections remain stable while loading cursor pages, and the UI makes the sharing and
privacy boundaries explicit.

## Scope

- Public global, authenticated personal, participating-friend, and friend-leaderboard routes.
- Cursor-driven Load more behavior, stable entry rendering, loading, empty, end, and recoverable error states.
- Automatic owner inclusion of current games and ranked historical games, with no history toggle.
- Reciprocal friend-leaderboard sharing control under Account & Security.
- Participating Steam-friend discovery and minimal scoreless friend rankings.
- Friend-list privacy with Steam setup instructions, upstream availability, sharing-required, rate-limit, and generic
  friend-not-found recovery states.
- Rank, artwork, game name, score, ranking status, and leaderboard-specific evidence counts.
- Exact external Steam store links from game names in global, personal, and friend-ranking rows.
- Concise, progressively disclosed explanations of provisional status and distinct personal/global score meanings.
- Locale-aware score display with no more than two fractional digits.

## Non-goals

- Comparing a personal score numerically with a global score.
- Search, arbitrary sorting, filtering, rank history, combined friend comparisons, or public/shareable friend profiles.
- Friend invitations, follows, messaging, activity feeds, or background Steam-friend synchronization.
- Displaying a friend's score, evidence, status, ownership, eligibility, playtime, or unranked library entries.
- Client-side ranking calculations, rating parameters, recommendations, reviews, or game-detail pages.

## Functional requirements

- **FR-001:** `/leaderboard/global` shall be accessible without authentication and shall retrieve the public global
  leaderboard using the API's default ordering and opaque continuation cursors.
- **FR-002:** `/leaderboard/me` shall require authentication and shall retrieve the authenticated user's personal
  leaderboard without identifying another user or sending the removed `includeHistorical` parameter. The page shall
  explain that current games and ranked historical games are included automatically.
- **FR-003:** Each global entry shall display rank, artwork or fallback, game name, status, contributor count, and global
  score. Each personal entry shall display rank, artwork or fallback, game name, status, comparison count, ownership,
  effective eligibility, and personal score or the absence of a score.
- **FR-004:** Both pages shall identify Provisional and Ranked in user-facing language and shall explain that personal
  and global score values have different meanings and must not be directly compared. The essential distinction shall be
  concise, while detailed definitions may be placed in an accessible scoring-information disclosure.
- **FR-005:** The personal page shall not offer a current/historical toggle or locally filter membership; it shall
  preserve the API's automatically selected current and ranked-historical entries in server order.
- **FR-006:** When `nextCursor` exists, a Load more action shall append the next page exactly once without renumbering,
  locally sorting, or duplicating entries. No numbered-page or total-page controls shall be fabricated.
- **FR-007:** Loading another page shall preserve already loaded entries. A later-page failure shall provide an inline
  retry while leaving successful entries readable; a first-page failure shall provide a page-level safe retry state.
- **FR-008:** Null personal scores shall display a clear not-yet-scored value and shall not be coerced to zero. Numeric
  scores shall use locale-aware presentation with no more than two fractional digits. Display rounding shall not change
  the transport value, server-provided rank, or entry order.
- **FR-009:** Empty global and personal results, terminal pagination, loading, and rate-limited states shall be distinct
  and shall not display fabricated sample rankings.
- **FR-010:** Account & Security shall read the authenticated user's friend-leaderboard sharing setting and provide an
  explicit control to enable or disable it. The UI shall explain that sharing is disabled by default, reciprocal, and
  limited to ranked game order and presentation data for participating current Steam friends.
- **FR-011:** A sharing update shall keep the last server-confirmed setting visible while pending or failed. Controls
  shall prevent duplicate submissions, safe API errors shall remain retryable, and a successful disable shall
  immediately cancel and remove cached participating-friend and friend-leaderboard data.
- **FR-012:** The protected `/leaderboard/friends` route shall read the sharing setting before requesting participating
  friends. While sharing is disabled it shall not request Steam-friend data and shall instead explain the prerequisite
  with a link to Account & Security.
- **FR-013:** When sharing is enabled, `/leaderboard/friends` shall display participating friends in API order with
  avatar or fallback, original display-name capitalization, an optional external Steam profile link, and an internal
  action using only the opaque `friendId` to open that friend's ranking.
- **FR-014:** `/leaderboard/friends/:friendId` shall require authentication and show the authorized friend's scoreless
  ranking in API-provided rank and entry order. Each row shall contain only rank, artwork or fallback, and game name;
  the client shall not infer or display score, evidence, status, ownership, eligibility, or playtime.
- **FR-015:** Participating-friend and friend-leaderboard pages shall use opaque continuation cursors with the append,
  duplicate-request prevention, retained-page retry, loading, empty, rate-limit, and terminal behavior of FR-006 through
  FR-009. Friend identifiers and cursors shall never be parsed or displayed.
- **FR-016:** Friend features shall distinguish sharing-required, private Steam friend-list, temporarily unavailable
  Steam, and rate-limited responses with safe actionable guidance. Private-list guidance shall explain that the user
  must open their Steam profile, choose Edit Profile and Privacy Settings, set Friends List to Public, and then retry;
  it shall also link to official Steam profile-privacy help in a new tab. Invalid, opted-out, deleted, and
  no-longer-proven friend targets shall share one generic unavailable/not-found presentation that reveals no target
  state.
- **FR-017:** The authenticated Leaderboards navigation disclosure shall expose Friends alongside My Ranking and Global.
  Copied or directly entered friend-ranking URLs shall remain protected and shall not expose friend identity or rows
  before authorization succeeds.
- **FR-018:** Privacy copy shall disclose that Steam friends are fetched only on demand, successful relationship data is
  cached by the API for no more than 15 minutes, both users must enable sharing, only ranked game order and presentation
  fields are shown, disabling revokes access immediately, and account deletion removes the sharing relationship data.
- **FR-019:** Each global, personal, and friend-ranking game name shall be an accessible external link to
  `https://store.steampowered.com/app/{appId}`, using the entry's App ID, opening in a new tab, and preventing the
  opened page from controlling the LibTaste window.

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
- **NFR-005:** Friend fixtures and rendering assertions shall fail if opaque identifiers, SteamID64, internal account
  identifiers, friend scores, evidence, ownership, eligibility, or other owner-only fields become user-visible.
- **NFR-006:** Sharing and friend queries shall remain user-scoped and shall be cancelled and removed on session loss;
  the public global cache shall remain isolated and available.
- **NFR-007:** Friend-list rows and scoreless ranking tables or responsive lists shall meet the existing WCAG 2.2 AA,
  keyboard, narrow-screen, lazy-image, and off-viewport rendering requirements for pages of up to 100 entries.

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

### AC-003: Include meaningful history automatically

**Given** the API returns current games and no-longer-owned ranked games
**When** the user opens My Ranking
**Then** all returned rows remain in server order, historical ownership is identified, and no history toggle or
`includeHistorical` query parameter is present

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
**Then** concise visible help identifies the active leaderboard's score scope and says the two score types are not
comparable, with the full meaning available through accessible scoring information

### AC-008: Empty global leaderboard

**Given** the global API returns no entries  
**When** a visitor opens the page  
**Then** a truthful empty state is shown without sample entries or a login requirement

### AC-009: Format leaderboard scores compactly

**Given** a leaderboard contains integer and higher-precision numeric scores
**When** either leaderboard table is rendered
**Then** each numeric score uses the active locale with no more than two fractional digits, null remains not yet scored,
and the entries retain the API's rank and order

### AC-010: Enable reciprocal sharing

**Given** an authenticated user has sharing disabled
**When** they open Account & Security, review the privacy explanation, and enable sharing successfully
**Then** the server-confirmed enabled state is shown and the Friends route can request participating Steam friends

### AC-011: Preserve confirmed sharing state on failure

**Given** either sharing state is server-confirmed
**When** the opposite update fails or remains pending
**Then** duplicate updates are prevented, the confirmed state is not falsely replaced, and a safe retry is available

### AC-012: Keep disabled friend discovery private

**Given** an authenticated user has sharing disabled
**When** they open Friends
**Then** the page makes no participating-friends request and links to Account & Security with an explanation of
reciprocal sharing

### AC-013: Browse participating Steam friends

**Given** sharing is enabled and the API returns participating friends
**When** the user opens Friends and loads another cursor page
**Then** friends append once in server order with avatar fallback, original display name, optional Steam profile link,
and an opaque-ID ranking action without exposing SteamID64 or an account identifier

### AC-014: Browse a friend's minimal ranking

**Given** an authorized participating friend has ranked current and historical games
**When** the user opens that friend's ranking and loads all pages
**Then** only API-provided rank, artwork, and game name are displayed in server order, including a truthful successful
empty state when the friend has no ranked games

### AC-015: Explain friend authorization and Steam failures safely

**Given** the API reports sharing-required, private-list, temporary Steam unavailability, rate limiting, or generic
friend-not-found
**When** a friend page handles the response
**Then** it shows the matching safe recovery guidance; private-list recovery gives the Steam Profile, Edit Profile,
Privacy Settings, Friends List, and Public steps plus an official Steam privacy-help link; and the generic target
failure does not reveal whether the identifier was invalid, opted out, deleted, or no longer a current friend

### AC-016: Revoke displayed friend data immediately

**Given** friend lists or rankings are cached in the authenticated session
**When** sharing is successfully disabled or the session is cleared
**Then** in-flight friend requests are cancelled, cached friend data is removed, and no friend rows remain readable

### AC-017: Protect direct friend URLs

**Given** a copied opaque friend-ranking URL
**When** a signed-out visitor opens it
**Then** the normal protected-route sign-in state appears without a friend identity, Steam lookup, or leaderboard data

### AC-018: Open a game from a leaderboard

**Given** a global, personal, or friend-ranking table contains a game entry
**When** the user activates the game's name
**Then** the browser opens the exact official Steam store page derived from that entry's App ID in a new tab, while
the LibTaste page remains safe and available

## Interfaces and data

- Consumes `GET /api/v1/me/leaderboard` with `cursor` and `limit` parameters; the web client omits the removed legacy
  `includeHistorical` parameter.
- Consumes public `GET /api/v1/leaderboards/global` with `cursor` and `limit` parameters.
- Consumes authenticated `GET` and `PUT /api/v1/me/friend-leaderboard-sharing`.
- Consumes authenticated `GET /api/v1/me/friends` and
  `GET /api/v1/me/friends/{friendId}/leaderboard` with opaque cursor pagination.
- Uses `PersonalLeaderboardPage`, `PersonalLeaderboardEntry`, `GlobalLeaderboardPage`, `GlobalLeaderboardEntry`,
  `FriendLeaderboardSharing`, `ParticipatingFriendPage`, `ParticipatingFriendEntry`, `FriendLeaderboardPage`,
  `FriendLeaderboardEntry`, `RankingStatus`, and `Problem` schemas from `openapi/openapi.yaml`.
- Opaque cursors remain request-scoped transport values and are never parsed, displayed, or treated as permanent URLs.
- Opaque `friendId` values are route-only API identifiers and are never interpreted or described as Steam/account IDs.

## Compatibility and rollout

Requires SPEC-0001 and the verified API SPEC-0008 contract. Existing personal URLs remain valid, but result membership
now always includes ranked historical games and the history toggle is removed. Friend sharing remains disabled until
the user explicitly opts in. Friend routes are protected and are not public or shareable profile surfaces.

## Related specifications and conflicts

- SPEC-0001 supplies the public/protected routes, transport, design, and errors.
- SPEC-0002 owns library and eligibility mutations; leaderboard ownership fields are read-only snapshots.
- SPEC-0003 causes server-side ranking changes but the client does not predict or calculate them.
- SPEC-0005 clears personal and friend leaderboard caches on logout or deletion and leaves public global data
  available. Account & Security hosts the reciprocal-sharing privacy control without changing deletion semantics.
- API SPEC-0008 supplies automatic ranked-history membership, reciprocal authorization, minimal friend data, opaque
  identifiers, bounded on-demand Steam relationship caching, and privacy-preserving Problem Details.

## Open questions and assumptions

- Assumption for approval: private-list recovery links to Steam's official profile-privacy article at
  `https://help.steampowered.com/en/faqs/view/588C-C67D-0251-C276`, opens it in a new tab, and keeps the retry action on
  the LibTaste page.

## Implementation notes

- Cursor-driven infinite-query primitives may be shared between personal and global views, but row semantics and score
  help must remain leaderboard-specific. Friend rankings reuse pagination behavior but not score/status help.
- A semantic table may become a card-like narrow-screen layout through CSS, provided headers and accessible names retain
  every required relationship.
- The friend-detail header remains generic because the leaderboard response intentionally contains no target profile;
  navigation state may enhance it with a previously authorized display name but must not be required after reload.
- Friend query keys use a dedicated user-scoped prefix so a successful disable can cancel and remove the complete
  feature cache immediately without disturbing the public global leaderboard.
- Leaderboard game-name links reuse the shared Steam store URL helper and the existing external-link safety convention.

## Verification matrix

| ID | Verification type | Test or evidence | Result |
|---|---|---|---|
| AC-001 | Browser/component test | Public global route, cache isolation, and rows in `LeaderboardPage.test.tsx` and `leaderboards.spec.ts` | Passed 2026-08-14 |
| AC-002 | Component/browser test | Personal automatic-membership request and row semantics in `LeaderboardPage.test.tsx` and `leaderboards.spec.ts` | Passed 2026-08-14 |
| AC-003 | Component/browser test | No history toggle or `includeHistorical`; ranked historical row retained in both leaderboard suites | Passed 2026-08-14 |
| AC-004 | Component/browser test | Opaque-cursor append and duplicate-request suppression in `LeaderboardPage.test.tsx` and `FriendLeaderboardPage.test.tsx` | Passed 2026-08-14 |
| AC-005 | Component/browser test | Retained rows and identical-cursor retry in personal, global, and friend component tests | Passed 2026-08-14 |
| AC-006 | Component accessibility test | Null score and Provisional explanation in `LeaderboardPage.test.tsx` | Passed 2026-08-14 |
| AC-007 | Content/component test | Distinct personal/global score and count labels in `LeaderboardPage.test.tsx` | Passed 2026-08-14 |
| AC-008 | Browser/component test | Truthful public empty state in `LeaderboardPage.test.tsx` | Passed 2026-08-14 |
| AC-009 | Component/browser formatting test | Locale-aware compact scores with server order preserved | Passed 2026-08-14 |
| AC-010 | Settings component/browser test | `SettingsPage.test.tsx` and `settings.spec.ts` read, explain, and enable reciprocal sharing | Passed 2026-08-14 |
| AC-011 | Settings component test | Pending cardinality, failed-state preservation, retry, and confirmation in `SettingsPage.test.tsx` | Passed 2026-08-14 |
| AC-012 | Network/component test | Disabled state makes no `/me/friends` request and links to settings in `FriendLeaderboardPage.test.tsx` | Passed 2026-08-14 |
| AC-013 | Component/browser test | Participating-friend fields, pagination, links, and opaque identifier use in friend component/browser tests | Passed 2026-08-14 |
| AC-014 | Component/browser test | Scoreless friend rows, pagination, 100-row page, and successful empty state in `FriendLeaderboardPage.test.tsx` | Passed 2026-08-14 |
| AC-015 | Problem-state component/browser test | Exact private-list setup steps, official external guidance link, retry, and other safe friend recovery states in `FriendLeaderboardPage.test.tsx` and `leaderboards.spec.ts` | Passed 2026-08-14 |
| AC-016 | Query-cache test | Successful disable and session clear cancel/remove friend data in settings/auth tests | Passed 2026-08-14 |
| AC-017 | Route/browser test | Signed-out direct friend URL exposes no protected data in `App.test.tsx` | Passed 2026-08-14 |
| AC-018 | Component/browser test | `LeaderboardPage.test.tsx` and `FriendLeaderboardPage.test.tsx` assert exact App-ID links, safe new-tab attributes, and preserved row-header names | Passed 2026-08-21 |
| NFR-001 | Automated accessibility and viewport tests | Axe component audits and five-project Playwright matrix | Passed 2026-08-14 |
| NFR-002 | Performance-oriented component test | 100-row lazy artwork and off-viewport safeguards in leaderboard component suites | Passed 2026-08-14 |
| NFR-003 | Network/cache-boundary test | Signed-out global route makes no session or private request in component/browser suites | Passed 2026-08-14 |
| NFR-004 | Contract fixture review | Generated OpenAPI-typed personal/global fixtures preserve score/count distinctions | Passed 2026-08-14 |
| NFR-005 | Privacy field-absence test | Minimal friend fixtures, exact column assertions, and rendered-text inspection | Passed 2026-08-14 |
| NFR-006 | Query-cache test | User-scoped friend cache clearing and public-cache isolation in settings/auth/leaderboard tests | Passed 2026-08-14 |
| NFR-007 | Accessibility/performance test | Friend list/ranking axe, five-browser viewport, lazy-image, and 100-row coverage | Passed 2026-08-14 |

## Verification commands

| Command | Result | Date |
|---|---|---|
| `node scripts/validate-specs.mjs` | Passed after evidence and lifecycle update | 2026-08-14 |
| `npm.cmd run test --workspace apps/web -- --run src/features/leaderboards/LeaderboardPage.test.tsx src/features/leaderboards/FriendLeaderboardPage.test.tsx src/features/settings/SettingsPage.test.tsx src/app/App.test.tsx` | Passed: 27 focused tests after expected pre-implementation failures | 2026-08-14 |
| `npm.cmd run verify` | Passed: format, lint, typecheck, 112 tests, coverage (90.53% statements, 84.79% branches, 91.84% functions, 92.77% lines), OpenAPI drift, and production build | 2026-08-14 |
| `$env:MOZ_WEBRENDER='0'; $env:MOZ_HEADLESS_WIDTH='1280'; $env:MOZ_HEADLESS_HEIGHT='720'; npx.cmd playwright test --workers=1` from `apps/web` | Passed: 115 tests across Chromium, Firefox, WebKit, mobile Chrome, and mobile Safari | 2026-08-14 |
| `npm.cmd run test --workspace apps/web -- --run src/features/leaderboards/FriendLeaderboardPage.test.tsx` | Passed: 6 tests after the new AC-015 assertion failed for the intended pre-implementation reason | 2026-08-14 |
| `npm.cmd run verify` | Passed: format, lint, typecheck, 112 tests, coverage (90.53% statements, 84.83% branches, 91.84% functions, 92.77% lines), OpenAPI drift, and production build | 2026-08-14 |
| `$env:MOZ_WEBRENDER='0'; $env:MOZ_HEADLESS_WIDTH='1280'; $env:MOZ_HEADLESS_HEIGHT='720'; npx.cmd playwright test e2e/leaderboards.spec.ts --workers=1` from `apps/web` | Passed: 20 tests across Chromium, Firefox, WebKit, mobile Chrome, and mobile Safari | 2026-08-14 |
| `node scripts/validate-specs.mjs` | Passed after AC-018 implementation and lifecycle update | 2026-08-21 |
| `npm.cmd run test --workspace apps/web -- --run src/features/leaderboards/LeaderboardPage.test.tsx src/features/leaderboards/FriendLeaderboardPage.test.tsx` | Passed: 10 focused tests, including AC-018 coverage | 2026-08-21 |
| `npm.cmd run verify` | Passed: format, lint, typecheck, 114 tests, coverage (90.68% statements, 84.82% branches, 91.97% functions, 92.88% lines), OpenAPI drift check, and production build | 2026-08-21 |
| `npx.cmd playwright test e2e/leaderboards.spec.ts --project=chromium --workers=1` from `apps/web` against the built preview | Passed: 4 Chromium leaderboard tests | 2026-08-21 |
| `$env:MOZ_WEBRENDER='0'; $env:MOZ_HEADLESS_WIDTH='1280'; $env:MOZ_HEADLESS_HEIGHT='720'; npx.cmd playwright test --workers=1` from `apps/web` | Not completed: Chromium passed 24 tests; Firefox browser startup/journeys failed or hung before assertions, so the remaining matrix was stopped | 2026-08-21 |

## Completion checklist

- [x] The revised specification was approved before implementation resumed.
- [x] Tests were updated for every revised acceptance criterion.
- [x] The implementation satisfies the revised requirements and non-goals.
- [ ] Applicable contract, web, and spec checks pass after the revision; the Firefox browser matrix remains blocked by the environment.
- [x] Required README and changelog updates are complete; no architectural decision changed, so no ADR is required.
- [x] The verification matrix contains no pending entries.
- [ ] Status is `Verified` only after every item above is complete.
