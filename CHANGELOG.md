# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/): group entries under `Added`, `Changed`, `Fixed`, `Removed`
beneath a dated or `Unreleased` heading. One line per change, written for a reader who wasn't in the session.

## Unreleased

### Changed

- Bounded cookie-backed session checks to ten seconds, added safe retry recovery for transient failures, and made the
  production HTML shell revalidate while retaining non-cacheable runtime config and immutable fingerprinted assets.
- Friend leaderboard recovery now explains how to make a Steam friends list public and links to official Steam privacy
  guidance.
- Personal rankings now include ranked historical games automatically and no longer send or display the removed
  historical-games option.
- Changed Compare keyboard shortcuts to the gamer-familiar WASD layout: W for draw, A for left, S for skip, and D for
  right.
- Grouped personal/global rankings under an accessible Leaderboards disclosure and moved Steam profile plus account
  controls into an authenticated profile disclosure, with Library grouped there as another account-scoped destination.
- Reduced the visual prominence of Compare's per-game Exclude actions so the more frequent Draw and Skip outcomes stay
  dominant.
- Ordered the profile disclosure as Steam profile, Library, then Account & Security.
- Enlarged and uncropped Compare artwork while moving compact Draw and Skip controls into the center of the matchup.
- Added server-backed, URL-addressable Library filters for game name, effective eligibility, and explicit eligibility
  override while retaining filters across opaque cursor pages.
- Made product routes more compact, kept Compare stable while the next pair loads, progressively disclosed secondary
  help, limited displayed leaderboard scores to two decimals, and renamed Settings to Account & Security.

### Added

- Added safe new-tab Steam store links to game names in global, personal, and friend leaderboards.
- Added private-by-default reciprocal Steam-friend leaderboard sharing, participating-friend discovery, and protected
  scoreless friend rankings with opaque cursor pagination and immediate browser-cache revocation on opt-out.
- Added one-click exclusion for either game on Compare, with server-confirmed eligibility, no-rating matchup
  retirement, automatic advancement, and safe partial-failure retries.
- Added exact Steam store links from available Library artwork and quiet per-game links in Compare matchups.
- Added the responsive React/Vite web foundation with public and protected routes.
- Added Steam authorization-code PKCE, in-memory access-token rotation, safe Problem Details, and signed-out recovery.
- Added generated OpenAPI types with drift verification, cross-browser tests, coverage gates, and CI verification.
- Added a runtime-configured Nginx production image with SPA fallback, compression, security headers, and health checks.
- Added authenticated Steam profile status, durable library synchronization, cursor-paginated library browsing, and
  server-confirmed game eligibility controls.
- Added accessible pairwise comparisons with immediate left/right/draw/skip outcomes, idempotent retry, expiry and
  allocation recovery, responsive artwork cards, and focus-safe keyboard shortcuts.
- Added public global and protected personal game leaderboards with responsive semantic tables, historical-game views,
  opaque cursor pagination, stable retry behavior, and distinct score and evidence explanations.
- Added protected account/session settings for current and all-device logout, safeguarded permanent account deletion,
  uncertain-result recovery, and centralized user-state cleanup that retains public leaderboard data.
- Added protected personalized game recommendations with plain-language model evidence, safe Steam links, distinct
  empty and recovery states, private 60-second caching, and comparison/library-driven invalidation.

### Fixed

- Fixed profile avatars remaining on their loading fallback and hover-opened navigation disclosures closing before an
  option could be reached.
- Stabilized coverage verification for the 100-game library accessibility stress test on slower CI runners.
