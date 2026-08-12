import { expect, test } from "@playwright/test";

const runtimeConfig = {
  apiBaseUrl: "http://127.0.0.1:4173/api/v1",
  webClientId: "e2e-browser",
  environmentLabel: "E2E",
};

test("protected Recommendations preserves server order and explains evidence", async ({
  page,
}) => {
  await page.route("**/config.json", (route) =>
    route.fulfill({ json: runtimeConfig }),
  );
  await page.route("**/api/v1/auth/token", (route) =>
    route.fulfill({
      json: {
        access_token: "recommendation-access",
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
  let recommendationRequests = 0;
  await page.route("**/api/v1/me/recommendations", async (route) => {
    recommendationRequests += 1;
    const request = route.request();
    expect(request.method()).toBe("GET");
    expect(new URL(request.url()).search).toBe("");
    expect(request.headers().authorization).toBe(
      "Bearer recommendation-access",
    );
    await route.fulfill({
      json: {
        status: "OK",
        recommendations: [
          {
            appId: 1145360,
            name: "Hades",
            artworkUrl: "https://cdn.example.test/hades.jpg",
            source: "ITEM",
            predictedRankPercentile: 91,
            neighborSupportCount: 0,
            seedSupportCount: 4,
            becauseOf: [
              {
                appId: 367520,
                name: "Hollow Knight",
                artworkUrl: "https://cdn.example.test/hollow-knight.jpg",
                adjustedSimilarity: 0.876,
              },
            ],
            becauseOfTotalCount: 3,
          },
          {
            appId: 413150,
            name: "Stardew Valley",
            artworkUrl: "https://cdn.example.test/stardew.jpg",
            source: "USER",
            predictedRankPercentile: 80,
            neighborSupportCount: 12,
            seedSupportCount: 0,
          },
        ],
      },
    });
  });

  await page.goto("/");
  await page.evaluate(() => {
    document.cookie = "libtaste_csrf=e2e-recommendations-csrf; path=/";
  });
  const navigation = page.getByRole("navigation", {
    name: "Primary navigation",
  });
  const links = navigation.getByRole("link");
  await expect(links.nth(0)).toHaveText("Compare");
  await expect(links.nth(1)).toHaveText("Recommendations");
  await links.nth(1).click();

  await expect(
    page.getByRole("heading", { name: "Recommendations" }),
  ).toBeVisible();
  await expect(page.getByRole("article").nth(0)).toContainText("Hades");
  await expect(page.getByRole("article").nth(1)).toContainText(
    "Stardew Valley",
  );
  await expect(
    page.getByText("Predicted to rank above 91% of your rated games."),
  ).toBeVisible();
  await expect(page.getByText("88% similar")).toBeVisible();
  await expect(page.getByText("and 2 more")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Open Hades on Steam.*new tab/i }),
  ).toHaveAttribute("rel", /noopener/);
  expect(recommendationRequests).toBe(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
