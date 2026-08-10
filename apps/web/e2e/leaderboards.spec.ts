import { expect, test, type Page } from "@playwright/test";

const runtimeConfig = {
  apiBaseUrl: "http://127.0.0.1:4173/api/v1",
  webClientId: "e2e-browser",
  environmentLabel: "E2E",
};

const globalPortal = {
  rank: 1,
  appId: 400,
  name: "Portal",
  artworkUrl: "https://cdn.example.test/portal.jpg",
  score: 42.75,
  contributorCount: 19,
  status: "RANKED",
};

const personalPortal = {
  rank: 2,
  appId: 400,
  name: "Portal",
  artworkUrl: "https://cdn.example.test/portal.jpg",
  score: null,
  comparisonCount: 2,
  status: "PROVISIONAL",
  currentlyOwned: true,
  effectivelyEligible: true,
};

async function configureRuntime(page: Page) {
  await page.route("**/config.json", (route) =>
    route.fulfill({ json: runtimeConfig }),
  );
}

test("public leaderboard keeps rows through cursor retry without session traffic", async ({
  page,
}) => {
  await configureRuntime(page);
  let tokenRequests = 0;
  let personalRequests = 0;
  let nextAttempts = 0;
  await page.route("**/api/v1/auth/token", (route) => {
    tokenRequests += 1;
    return route.fulfill({ status: 500 });
  });
  await page.route("**/api/v1/me**", (route) => {
    personalRequests += 1;
    return route.fulfill({ status: 500 });
  });
  await page.route("**/api/v1/leaderboards/global**", async (route) => {
    const url = new URL(route.request().url());
    expect(route.request().headers().authorization).toBeUndefined();
    if (!url.searchParams.has("cursor")) {
      await route.fulfill({
        json: { items: [globalPortal], nextCursor: "opaque+/=" },
      });
      return;
    }
    expect(url.searchParams.get("cursor")).toBe("opaque+/=");
    nextAttempts += 1;
    if (nextAttempts === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/problem+json",
        json: {
          type: "https://api.example.test/problems/unavailable",
          title: "Page unavailable",
          detail: "Retry the same continuation request.",
          status: 503,
          requestId: "req-next",
        },
      });
      return;
    }
    await route.fulfill({
      json: {
        items: [
          globalPortal,
          {
            ...globalPortal,
            rank: 2,
            appId: 1145360,
            name: "Hades",
          },
        ],
        nextCursor: null,
      },
    });
  });

  await page.goto("/leaderboard/global");
  await expect(page.getByRole("rowheader", { name: "Portal" })).toBeVisible();
  await page.getByRole("button", { name: "Load more" }).click();
  await expect(
    page.getByText("Retry the same continuation request."),
  ).toBeVisible();
  await expect(page.getByRole("rowheader", { name: "Portal" })).toBeVisible();
  await page.getByRole("button", { name: "Retry loading more" }).click();
  await expect(page.getByRole("rowheader", { name: "Hades" })).toBeVisible();
  await expect(page.getByText("End of global leaderboard")).toBeVisible();
  expect(await page.getByRole("rowheader", { name: "Portal" }).count()).toBe(1);
  expect(nextAttempts).toBe(2);
  expect(tokenRequests).toBe(0);
  expect(personalRequests).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("personal leaderboard reloads from the first page for historical games", async ({
  page,
}) => {
  await configureRuntime(page);
  const leaderboardRequests: string[] = [];
  await page.route("**/api/v1/auth/token", (route) =>
    route.fulfill({
      json: {
        access_token: "access",
        token_type: "Bearer",
        expires_in: 900,
      },
    }),
  );
  await page.route("**/api/v1/me", (route) =>
    route.fulfill({
      json: {
        steamId64: "76561198000000000",
        displayName: "Browser Pilot",
        libraryState: "AVAILABLE",
        synchronization: null,
      },
    }),
  );
  await page.route("**/api/v1/me/leaderboard**", async (route) => {
    const url = new URL(route.request().url());
    leaderboardRequests.push(url.toString());
    expect(url.searchParams.has("cursor")).toBe(false);
    if (url.searchParams.get("includeHistorical") === "true") {
      await route.fulfill({
        json: {
          items: [
            {
              ...personalPortal,
              rank: 8,
              appId: 70,
              name: "Half-Life",
              score: 11.5,
              currentlyOwned: false,
              effectivelyEligible: false,
            },
          ],
          nextCursor: null,
        },
      });
      return;
    }
    expect(url.searchParams.get("includeHistorical")).toBe("false");
    await route.fulfill({
      json: { items: [personalPortal], nextCursor: null },
    });
  });

  await page.goto("/");
  await page.evaluate(() => {
    document.cookie = "libtaste_csrf=e2e-csrf; path=/";
  });
  await page.getByRole("link", { name: "My Ranking" }).click();
  const portalRow = page.getByRole("row", { name: /Portal/ });
  await expect(portalRow).toContainText("Not yet scored");
  await expect(portalRow).toContainText("2 comparisons");
  await page
    .getByRole("checkbox", { name: "Include historical games" })
    .check();
  await expect(
    page.getByRole("rowheader", { name: "Half-Life" }),
  ).toBeVisible();
  await expect(page.getByRole("rowheader", { name: "Portal" })).toHaveCount(0);
  expect(leaderboardRequests).toHaveLength(2);
  expect(leaderboardRequests[1]).toContain("includeHistorical=true");
});
