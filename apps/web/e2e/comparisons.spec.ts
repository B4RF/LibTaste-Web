import { expect, test, type Page, type Route } from "@playwright/test";

const pairs = ["Portal", "Hades", "Celeste", "Disco Elysium", "Half-Life"];

function comparison(index: number) {
  return {
    comparisonId: `${index + 1}1111111-1111-4111-8111-111111111111`,
    left: {
      appId: 400 + index,
      name: pairs[index],
      artworkUrl: `https://cdn.example.test/${index}-left.jpg`,
    },
    right: {
      appId: 600 + index,
      name: `Right ${index + 1}`,
      artworkUrl: `https://cdn.example.test/${index}-right.jpg`,
    },
    createdAt: "2026-08-10T08:00:00Z",
    expiresAt: "2099-08-11T08:00:00Z",
  };
}

async function configureAuthenticatedCompare(page: Page) {
  await page.route("**/config.json", (route) =>
    route.fulfill({
      json: {
        apiBaseUrl: "http://127.0.0.1:4173/api/v1",
        webClientId: "e2e-browser",
        environmentLabel: "E2E",
      },
    }),
  );
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
  await page.route("https://cdn.example.test/**", (route) => route.abort());
  await page.goto("/");
  await page.evaluate(() => {
    document.cookie = "libtaste_csrf=e2e-csrf; path=/";
  });
}

async function problem(
  route: Route,
  status: number,
  type: string,
  title: string,
) {
  await route.fulfill({
    status,
    contentType: "application/problem+json",
    json: {
      type: `https://api.example.test/problems/${type}`,
      title,
      status,
      detail: `${title}. Safe recovery detail.`,
      requestId: `request-${type}`,
    },
  });
}

test("every outcome preserves orientation, locks rapidly, and advances", async ({
  page,
}) => {
  await configureAuthenticatedCompare(page);
  let allocation = 0;
  const requests: Array<{ id: string; outcome: string }> = [];
  await page.route("**/api/v1/comparisons/next", (route) =>
    route.fulfill({ json: comparison(allocation++) }),
  );
  await page.route("**/api/v1/comparisons/*/result", async (route) => {
    const request = route.request();
    const id = request.url().split("/").at(-2)!;
    const outcome = request.postDataJSON().outcome as string;
    requests.push({ id, outcome });
    await new Promise((resolve) => setTimeout(resolve, 80));
    await route.fulfill({
      json: {
        comparisonId: id,
        outcome,
        completedAt: new Date().toISOString(),
      },
    });
  });

  await page.getByRole("link", { name: "Compare" }).click();
  const left = page.getByRole("button", { name: /portal choose left/i });
  await expect(left).toBeVisible();
  await left.evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect(
    page.getByRole("button", { name: /hades choose left/i }),
  ).toBeVisible();

  await page.getByRole("main").focus();
  await page.keyboard.press("r");
  await expect(
    page.getByRole("button", { name: /celeste choose left/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Draw" }).click();
  await expect(
    page.getByRole("button", { name: /disco elysium choose left/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page.getByText(/no rating change is claimed/i)).toBeVisible();

  expect(requests.map(({ outcome }) => outcome)).toEqual([
    "LEFT_WIN",
    "RIGHT_WIN",
    "DRAW",
    "SKIP",
  ]);
  expect(requests[0].id).toBe(comparison(0).comparisonId);
  expect(requests).toHaveLength(4);
});

test("an uncertain outcome retries the identical request", async ({ page }) => {
  await configureAuthenticatedCompare(page);
  const sent: Array<{ url: string; body: unknown }> = [];
  let submission = 0;
  await page.route("**/api/v1/comparisons/next", (route) =>
    route.fulfill({ json: comparison(0) }),
  );
  await page.route("**/api/v1/comparisons/*/result", async (route) => {
    sent.push({
      url: route.request().url(),
      body: route.request().postDataJSON(),
    });
    submission += 1;
    if (submission === 1) return route.abort("connectionreset");
    return route.fulfill({
      json: {
        comparisonId: comparison(0).comparisonId,
        outcome: "DRAW",
        completedAt: "2026-08-10T09:00:00Z",
      },
    });
  });
  await page.getByRole("link", { name: "Compare" }).click();
  await page.getByRole("button", { name: "Draw" }).click();
  await page.getByRole("button", { name: "Retry draw" }).click();
  await expect(page.getByText(/recorded draw/i)).toBeVisible();
  expect(sent).toHaveLength(2);
  expect(sent[1]).toEqual(sent[0]);
});

test("expiry discards the stale pair and reloads current server state", async ({
  page,
}) => {
  await configureAuthenticatedCompare(page);
  let allocation = 0;
  await page.route("**/api/v1/comparisons/next", (route) =>
    route.fulfill({ json: comparison(allocation++) }),
  );
  await page.route("**/api/v1/comparisons/*/result", (route) =>
    problem(route, 409, "comparison-expired", "Comparison expired"),
  );
  await page.getByRole("link", { name: "Compare" }).click();
  await page.getByRole("button", { name: /portal choose left/i }).click();
  await expect(
    page.getByRole("heading", { name: /no longer interactive/i }),
  ).toBeVisible();
  await expect(page.getByText("Portal")).toHaveCount(0);
  await page.getByRole("button", { name: "Get current comparison" }).click();
  await expect(
    page.getByRole("button", { name: /hades choose left/i }),
  ).toBeVisible();
});

test("allocation causes remain distinct and actionable", async ({ page }) => {
  await configureAuthenticatedCompare(page);
  let allocation = 0;
  await page.route("**/api/v1/comparisons/next", async (route) => {
    allocation += 1;
    if (allocation === 1) {
      return problem(
        route,
        409,
        "library-synchronization-unavailable",
        "Library synchronization unavailable",
      );
    }
    return problem(
      route,
      409,
      "insufficient-eligible-games",
      "Insufficient eligible games",
    );
  });
  await page.getByRole("link", { name: "Compare" }).click();
  await expect(
    page.getByRole("heading", { name: /library is not ready/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Library" })).toBeVisible();
  await page.getByRole("button", { name: "Try current comparison" }).click();
  await expect(
    page.getByRole("heading", { name: /more eligible games/i }),
  ).toBeVisible();
});

test("shortcuts respect focus and touch targets at 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await configureAuthenticatedCompare(page);
  let submissions = 0;
  await page.route("**/api/v1/comparisons/next", (route) =>
    route.fulfill({ json: comparison(0) }),
  );
  await page.route("**/api/v1/comparisons/*/result", (route) => {
    submissions += 1;
    return route.fulfill({
      json: {
        comparisonId: comparison(0).comparisonId,
        outcome: "DRAW",
        completedAt: "2026-08-10T09:00:00Z",
      },
    });
  });
  await page.getByRole("link", { name: "Compare" }).click();
  const draw = page.getByRole("button", { name: "Draw" });
  await draw.focus();
  await page.keyboard.press("l");
  expect(submissions).toBe(0);
  expect(
    await draw.evaluate((button) => getComputedStyle(button).minHeight),
  ).toBe("44px");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("img", { name: /portal artwork unavailable/i }),
  ).toBeVisible();
});

test("the compact comparison stage stays visible and stable while advancing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await configureAuthenticatedCompare(page);
  let allocation = 0;
  let releaseNext!: () => void;
  const nextPair = new Promise<void>((resolve) => {
    releaseNext = resolve;
  });
  await page.route("**/api/v1/comparisons/next", async (route) => {
    const index = allocation++;
    if (index > 0) await nextPair;
    await route.fulfill({ json: comparison(index) });
  });
  await page.route("**/api/v1/comparisons/*/result", (route) =>
    route.fulfill({
      json: {
        comparisonId: comparison(0).comparisonId,
        outcome: "DRAW",
        completedAt: "2026-08-10T09:00:00Z",
      },
    }),
  );

  await page.getByRole("link", { name: "Compare" }).click();
  const draw = page.getByRole("button", { name: "Draw" });
  const skip = page.getByRole("button", { name: "Skip" });
  await expect(draw).toBeVisible();
  await expect(skip).toBeVisible();
  await expect(page.getByText(comparison(0).comparisonId)).toBeHidden();
  await expect(page.getByText(/Press L for the left game/)).toBeHidden();
  const initialTop = (await draw.boundingBox())!.y;
  expect((await skip.boundingBox())!.y).toBeLessThan(720);

  await draw.click();
  await expect(page.getByText(/loading the next comparison/i)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /portal choose left/i }),
  ).toBeDisabled();
  expect(Math.abs((await draw.boundingBox())!.y - initialTop)).toBeLessThan(2);

  releaseNext();
  await expect(
    page.getByRole("button", { name: /hades choose left/i }),
  ).toBeEnabled();
  expect(Math.abs((await draw.boundingBox())!.y - initialTop)).toBeLessThan(2);
});
