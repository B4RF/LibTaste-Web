# ADR-0001: Static SPA, in-memory web session, and runtime configuration

Status: Accepted  
Date: 2026-08-10

## Context

LibTaste needs a browser foundation for public content, Steam authentication, and protected product routes. The same
verified build must run in local and public environments without placing credentials in JavaScript storage or baking
environment-specific API locations into the artifact.

## Decision

- Build a React and TypeScript single-page application with Vite and React Router under `apps/web`.
- Use TanStack Query for server state and a small authentication context backed by one `SessionManager`.
- Retain short-lived access tokens only in memory. Rotate the protected refresh cookie through the shared token endpoint
  with credentialed requests and the readable CSRF-cookie value.
- Store only one-time PKCE and allowlisted return-path data in session-scoped storage.
- Generate the web transport types directly from the repository OpenAPI contract and fail verification on drift.
- Load non-secret `apiBaseUrl`, `webClientId`, and optional environment label from `/config.json` before mounting.
- Produce a static Nginx image whose startup script writes runtime configuration and whose server provides SPA fallback,
  health, compression, CSP, and security headers.

## Consequences

- Public deployments must register the exact browser origin/callback and align credentialed requests with API cookie and
  origin policy.
- A full page reload discards the access token and requires cookie-backed session rotation.
- Runtime configuration can change without rebuilding, but required invalid values fail closed with a configuration
  screen.
- Server-rendered and search-specific output are intentionally absent; a later need would require a new decision.
