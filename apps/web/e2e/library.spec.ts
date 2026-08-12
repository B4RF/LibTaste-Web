import { expect, test, type Page } from "@playwright/test";

const profile = {
  steamId64: "76561198000000000",
  displayName: "Browser Pilot",
  profileUrl: "https://steamcommunity.com/id/browser-pilot",
  libraryState: "AVAILABLE",
  lastLibrarySyncAt: "2026-08-10T07:05:00Z",
  synchronization: null,
};

const portal = {
  appId: 400,
  name: "Portal",
  artworkUrl: "https://cdn.example.test/portal.jpg",
  playtimeMinutes: 125,
  currentlyOwned: true,
  eligibilityOverride: "DEFAULT",
  effectivelyEligible: true,
  firstImportedAt: "2026-08-01T10:00:00Z",
  lastImportedAt: "2026-08-10T07:05:00Z",
};

async function configureAuthenticatedLibrary(page: Page) {
  let tokenRequests = 0;
  await page.route("**/config.json", (route) =>
    route.fulfill({
      json: {
        apiBaseUrl: "http://127.0.0.1:4173/api/v1",
        webClientId: "e2e-browser",
        environmentLabel: "E2E",
      },
    }),
  );
  await page.route("**/api/v1/auth/token", (route) => {
    tokenRequests += 1;
    return route.fulfill({
      json: {
        access_token: "access",
        token_type: "Bearer",
        expires_in: 900,
      },
    });
  });
  await page.route("**/api/v1/me", (route) => route.fulfill({ json: profile }));
  await page.goto("/");
  await page.evaluate(() => {
    document.cookie = "libtaste_csrf=e2e-csrf; path=/";
  });
  return () => tokenRequests;
}

test("library pagination and eligibility remain server-authoritative", async ({
  page,
}) => {
  const tokenRequests = await configureAuthenticatedLibrary(page);
  let firstPageRequests = 0;
  let secondPageRequests = 0;
  await page.route("**/api/v1/me/library**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith("/400/eligibility")) {
      expect(request.method()).toBe("PUT");
      expect(request.postDataJSON()).toEqual({ behavior: "EXCLUDED" });
      await route.fulfill({
        json: {
          ...portal,
          eligibilityOverride: "EXCLUDED",
          effectivelyEligible: false,
        },
      });
      return;
    }
    if (url.searchParams.has("cursor")) {
      secondPageRequests += 1;
      expect(url.searchParams.get("cursor")).toBe("opaque+/=");
      await route.fulfill({
        json: {
          items: [{ ...portal, appId: 401, name: "Hades" }],
          nextCursor: null,
        },
      });
      return;
    }
    firstPageRequests += 1;
    await route.fulfill({
      json: { items: [portal], nextCursor: "opaque+/=" },
    });
  });

  await page.getByRole("link", { name: "Library" }).click();
  await expect.poll(tokenRequests, { timeout: 10_000 }).toBe(1);
  await expect(page.getByRole("heading", { name: "Portal" })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Load more" }).click();
  await expect.poll(() => secondPageRequests, { timeout: 10_000 }).toBe(1);
  await expect(page.getByRole("heading", { name: "Hades" })).toBeVisible({
    timeout: 10_000,
  });
  expect(firstPageRequests).toBe(1);
  expect(secondPageRequests).toBe(1);

  const eligibility = page.getByRole("combobox", {
    name: "Eligibility behavior for Portal",
  });
  await eligibility.selectOption("EXCLUDED");
  await expect(eligibility).toHaveValue("EXCLUDED");
  await expect(
    page.getByText("Not eligible for comparisons").first(),
  ).toBeVisible();
});

test("library filters are server-backed, URL-addressable, and retained for pagination", async ({
  page,
}) => {
  await configureAuthenticatedLibrary(page);
  const requests: URL[] = [];
  await page.route("**/api/v1/me/library**", async (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    const cursor = url.searchParams.get("cursor");
    await route.fulfill({
      json: {
        items: cursor
          ? [{ ...portal, appId: 401, name: "Portal 2" }]
          : [portal],
        nextCursor: cursor ? null : "filtered-cursor",
      },
    });
  });

  await page.getByRole("link", { name: "Library" }).click();
  await page.getByRole("searchbox", { name: "Game name" }).fill("Portal");
  await page
    .getByRole("combobox", { name: "Effective eligibility" })
    .selectOption("true");
  await page
    .getByRole("combobox", { name: "Eligibility override" })
    .selectOption("EXCLUDED");

  await expect(page).toHaveURL((url) => {
    return (
      url.searchParams.get("name") === "Portal" &&
      url.searchParams.get("effectivelyEligible") === "true" &&
      url.searchParams.get("eligibilityOverride") === "EXCLUDED"
    );
  });
  await expect
    .poll(() =>
      requests.some(
        (url) =>
          url.searchParams.get("name") === "Portal" &&
          url.searchParams.get("effectivelyEligible") === "true" &&
          url.searchParams.get("eligibilityOverride") === "EXCLUDED",
      ),
    )
    .toBe(true);

  await page.getByRole("button", { name: "Load more" }).click();
  await expect(page.getByRole("heading", { name: "Portal 2" })).toBeVisible();
  const paged = requests.find(
    (url) => url.searchParams.get("cursor") === "filtered-cursor",
  );
  expect(paged?.searchParams.get("name")).toBe("Portal");
  expect(paged?.searchParams.get("effectivelyEligible")).toBe("true");
  expect(paged?.searchParams.get("eligibilityOverride")).toBe("EXCLUDED");

  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).toHaveURL("/library");
});
