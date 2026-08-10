import { expect, test, type Page } from "@playwright/test";

const runtimeConfig = {
  apiBaseUrl: "http://127.0.0.1:4173/api/v1",
  webClientId: "e2e-browser",
  environmentLabel: "E2E",
};

async function configureAuthenticatedSettings(page: Page) {
  await page.route("**/config.json", (route) =>
    route.fulfill({ json: runtimeConfig }),
  );
  await page.route("**/api/v1/auth/token", (route) =>
    route.fulfill({
      json: {
        access_token: "settings-access",
        token_type: "Bearer",
        expires_in: 900,
      },
    }),
  );
  await page.route("**/api/v1/me", (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    return route.fulfill({
      json: {
        steamId64: "76561198000000000",
        displayName: "Browser Pilot",
        libraryState: "AVAILABLE",
        synchronization: null,
      },
    });
  });
  await page.goto("/");
  await page.evaluate(() => {
    document.cookie = "libtaste_csrf=e2e-settings-csrf; path=/";
  });
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
}

test("current logout is one protected request and stale Settings stays guarded", async ({
  page,
}) => {
  let logoutRequests = 0;
  await page.route("**/api/v1/auth/logout", async (route) => {
    logoutRequests += 1;
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers().authorization).toBe(
      "Bearer settings-access",
    );
    expect(route.request().headers()["x-csrf-token"]).toBe("e2e-settings-csrf");
    await route.fulfill({ status: 204 });
  });
  await configureAuthenticatedSettings(page);

  await page.getByRole("button", { name: "Log out this device" }).click();
  await expect(
    page.getByText("You have been logged out on this device."),
  ).toBeVisible();
  expect(logoutRequests).toBe(1);
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in to continue" }),
  ).toBeVisible();
  await expect(page.getByText("Account and session controls")).toHaveCount(0);
});

test("all-session logout and account deletion require their safeguards", async ({
  page,
}) => {
  let logoutAllRequests = 0;
  await page.route("**/api/v1/auth/logout-all", async (route) => {
    logoutAllRequests += 1;
    await route.fulfill({ status: 204 });
  });
  await configureAuthenticatedSettings(page);

  const logoutAll = page.getByRole("button", { name: "Log out all devices" });
  await logoutAll.click();
  expect(logoutAllRequests).toBe(0);
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(logoutAll).toBeFocused();

  const deleteAccount = page.getByRole("button", { name: "Delete account" });
  await deleteAccount.click();
  const dialog = page.getByRole("dialog", {
    name: "Permanently delete account",
  });
  await expect(
    dialog.getByText(/Steam account is not deleted or modified/),
  ).toBeVisible();
  const confirm = dialog.getByRole("button", {
    name: "Permanently delete account",
  });
  await dialog.getByRole("textbox", { name: /Type DELETE/ }).fill("delete");
  await expect(confirm).toBeDisabled();
  await dialog.getByRole("textbox", { name: /Type DELETE/ }).fill("");
  await page.keyboard.press("Escape");
  await expect(deleteAccount).toBeFocused();

  await logoutAll.click();
  await page
    .getByRole("button", { name: "Confirm log out all devices" })
    .click();
  await expect(
    page.getByText("You have been logged out on every device."),
  ).toBeVisible();
  expect(logoutAllRequests).toBe(1);
});

test("an uncertain deletion checks the session without repeating DELETE", async ({
  page,
}) => {
  let tokenRequests = 0;
  let deleteRequests = 0;
  await page.route("**/api/v1/auth/token", async (route) => {
    tokenRequests += 1;
    await route.fulfill({
      json: {
        access_token: `settings-access-${tokenRequests}`,
        token_type: "Bearer",
        expires_in: 900,
      },
    });
  });
  await page.route("**/api/v1/me", async (route) => {
    if (route.request().method() === "DELETE") {
      deleteRequests += 1;
      await route.abort("connectionclosed");
      return;
    }
    await route.fulfill({
      json: {
        steamId64: "76561198000000000",
        displayName: "Browser Pilot",
        libraryState: "AVAILABLE",
        synchronization: null,
      },
    });
  });
  await page.route("**/config.json", (route) =>
    route.fulfill({ json: runtimeConfig }),
  );
  await page.goto("/");
  await page.evaluate(() => {
    document.cookie = "libtaste_csrf=e2e-settings-csrf; path=/";
  });
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Delete account" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").fill("DELETE");
  await dialog
    .getByRole("button", { name: "Permanently delete account" })
    .click();

  await expect(
    dialog.getByText(/account still appears available/i),
  ).toBeVisible();
  expect(deleteRequests).toBe(1);
  expect(tokenRequests).toBe(2);
  await expect(
    dialog.getByRole("button", { name: "Permanently delete account" }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
