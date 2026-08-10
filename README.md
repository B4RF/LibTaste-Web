# LibTaste Web

The browser client for LibTaste, where Steam players build personal game rankings through pairwise comparisons.

## Requirements

- Node.js 24
- npm 11 or later
- Docker for production-image verification

## Get started

```powershell
npm ci
npm run openapi:check
npm run test
npm run build
npm run dev --workspace apps/web
```

The development server reads [`apps/web/public/config.json`](./apps/web/public/config.json) and proxies `/api` to
`LIBTASTE_API_PROXY_ORIGIN`, defaulting to `http://localhost:8080`. See
[`apps/web/README.md`](./apps/web/README.md) for runtime configuration, authentication boundaries, verification, and
container usage.

Feature behavior is governed by the approved documents under [`specs/`](./specs/README.md).
