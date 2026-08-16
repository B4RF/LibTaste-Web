const baseUrl = process.env.LIBTASTE_CONTAINER_URL;
if (!baseUrl) {
  console.error(
    "Set LIBTASTE_CONTAINER_URL to the running web container, for example http://127.0.0.1:8088.",
  );
  process.exit(2);
}

const requestOptions = { signal: AbortSignal.timeout(10_000) };

const [health, route, config] = await Promise.all([
  fetch(`${baseUrl}/healthz`, requestOptions),
  fetch(`${baseUrl}/compare`, requestOptions),
  fetch(`${baseUrl}/config.json`, requestOptions),
]);

if (!health.ok || (await health.text()).trim() !== "healthy") {
  throw new Error("Container health endpoint did not report healthy.");
}
const applicationShell = await route.text();
if (!route.ok || !applicationShell.includes('<div id="root"></div>')) {
  throw new Error("Direct SPA route did not receive the application shell.");
}
if (route.headers.get("cache-control") !== "no-cache") {
  throw new Error("The HTML application shell does not require revalidation.");
}
if (!config.ok || config.headers.get("cache-control") !== "no-store") {
  throw new Error("Runtime configuration is missing or cacheable.");
}
const runtimeConfig = await config.json();
if (
  typeof runtimeConfig.apiBaseUrl !== "string" ||
  typeof runtimeConfig.webClientId !== "string" ||
  "clientSecret" in runtimeConfig
) {
  throw new Error(
    "Runtime configuration is malformed or contains a secret field.",
  );
}

const requiredHeaders = [
  "content-security-policy",
  "cross-origin-opener-policy",
  "referrer-policy",
  "x-content-type-options",
  "x-frame-options",
];
for (const header of requiredHeaders) {
  if (!route.headers.has(header))
    throw new Error(`Required security header is missing: ${header}`);
}
if (
  !route.headers.get("content-security-policy")?.includes("default-src 'none'")
) {
  throw new Error("Content Security Policy is unexpectedly permissive.");
}

const scriptPath = applicationShell.match(/src="([^"]+\.js)"/)?.[1];
if (!scriptPath)
  throw new Error("Built application script was not found in the shell.");
const compressedAsset = await fetch(`${baseUrl}${scriptPath}`, {
  ...requestOptions,
  headers: { "Accept-Encoding": "gzip" },
});
if (compressedAsset.headers.get("content-encoding") !== "gzip") {
  throw new Error("Static JavaScript was not served with compression.");
}
if (
  compressedAsset.headers.get("cache-control") !==
  "public, max-age=31536000, immutable"
) {
  throw new Error("Fingerprinted assets are not served as immutable.");
}

console.log(
  "Container health, SPA fallback, cache policy, runtime configuration, compression, and security headers passed.",
);
