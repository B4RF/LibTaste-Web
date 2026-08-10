import { expect, test } from "@playwright/test";

async function configure(
  page: import("@playwright/test").Page,
  config: Record<string, unknown> = {},
) {
  await page.route("**/config.json", async (route) => {
    const origin = new URL(route.request().url()).origin;
    await route.fulfill({
      json: {
        apiBaseUrl: `${origin}/api/v1`,
        webClientId: "e2e-browser",
        environmentLabel: "E2E",
        ...config,
      },
    });
  });
}

test("landing remains usable at the minimum viewport and reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await configure(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /games you truly love/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /sign in through steam/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /global leaderboard/i }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("authorization navigation carries PKCE but no API credential", async ({
  page,
}) => {
  await configure(page);
  await page.goto("/");
  const authorization = page.waitForRequest(
    "**/api/v1/auth/steam/authorize?**",
  );
  await page.getByRole("button", { name: /sign in through steam/i }).click();
  const url = new URL((await authorization).url());
  expect(url.searchParams.get("client_id")).toBe("e2e-browser");
  expect(url.searchParams.get("return_uri")).toBe(
    `${url.origin}/auth/callback`,
  );
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  expect(url.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(url.searchParams.has("client_secret")).toBe(false);
});

test("a protected route never flashes protected content while signed out", async ({
  page,
}) => {
  await configure(page);
  await page.goto("/library");
  await expect(
    page.getByRole("heading", { name: "Sign in to continue" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Steam library" }),
  ).toHaveCount(0);
});

test("invalid runtime configuration makes no product API request", async ({
  page,
}) => {
  let productRequests = 0;
  await page.route("**/api/**", async (route) => {
    productRequests += 1;
    await route.abort();
  });
  await configure(page, { webClientId: "" });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "LibTaste is not configured" }),
  ).toBeVisible();
  expect(productRequests).toBe(0);
});

test("an invalid callback offers a safe retry", async ({ page }) => {
  await configure(page);
  await page.goto("/auth/callback?code=orphaned");
  await expect(
    page.getByRole("heading", { name: /could not be completed/i }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeEnabled();
});
