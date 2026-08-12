# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/): group entries under `Added`, `Changed`, `Fixed`, `Removed`
beneath a dated or `Unreleased` heading. One line per change, written for a reader who wasn't in the session.

## Unreleased

### Added

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
