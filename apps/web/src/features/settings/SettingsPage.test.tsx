import { render, screen, within } from "@testing-library/react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { SessionManager } from "../../api/client";
import { ApplicationProviders, ApplicationRoutes } from "../../app/App";
import type { RuntimeConfig } from "../../config";

const config: RuntimeConfig = {
  apiBaseUrl: "https://api.example.test/api/v1",
  webClientId: "web-client",
};

function token(value = "access") {
  return new Response(
    JSON.stringify({
      access_token: value,
      token_type: "Bearer",
      expires_in: 900,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function profile() {
  return new Response(
    JSON.stringify({
      steamId64: "76561198000000000",
      displayName: "Settings Tester",
      libraryState: "AVAILABLE",
      synchronization: null,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function problem(status: number, title: string, requestId: string) {
  return new Response(
    JSON.stringify({
      type: "https://example.test/problems/settings",
      title,
      status,
      detail: "The account action could not be completed.",
      requestId,
    }),
    {
      status,
      headers: { "Content-Type": "application/problem+json" },
    },
  );
}

function renderSettings(fetcher: typeof fetch) {
  document.cookie = "libtaste_csrf=settings-csrf; path=/";
  const session = new SessionManager(config, { fetcher });
  let queryClient: QueryClient | undefined;
  function CaptureQueryClient() {
    queryClient = useQueryClient();
    return null;
  }
  return {
    session,
    ...render(
      <ApplicationProviders config={config} session={session}>
        <CaptureQueryClient />
        <MemoryRouter initialEntries={["/settings"]}>
          <ApplicationRoutes config={config} />
        </MemoryRouter>
      </ApplicationProviders>,
    ),
    getQueryClient: () => queryClient!,
  };
}

function standardFetcher(
  action: (url: string, init?: RequestInit) => Response | Promise<Response>,
) {
  return vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/auth/token")) return token();
    if (url.endsWith("/me") && (init?.method ?? "GET") === "GET") {
      return profile();
    }
    if (
      url.endsWith("/me/friend-leaderboard-sharing") &&
      (init?.method ?? "GET") === "GET"
    ) {
      return new Response(JSON.stringify({ enabled: false }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return action(url, init);
  });
}

describe("SettingsPage", () => {
  it("keeps confirmed reciprocal sharing state through failure and clears friend data on disable", async () => {
    let updateAttempts = 0;
    let resolveFirstUpdate!: (response: Response) => void;
    const fetcher = standardFetcher((url, init) => {
      if (
        url.endsWith("/me/friend-leaderboard-sharing") &&
        init?.method === "PUT"
      ) {
        updateAttempts += 1;
        if (updateAttempts === 1) {
          return new Promise<Response>((resolve) => {
            resolveFirstUpdate = resolve;
          });
        }
        return new Response(JSON.stringify({ enabled: updateAttempts === 2 }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(null, { status: 204 });
    });
    const result = renderSettings(fetcher);
    const user = userEvent.setup();

    expect(
      await screen.findByRole("heading", {
        name: "Friend leaderboard sharing",
      }),
    ).toBeVisible();
    expect(await screen.findByText("Sharing is disabled.")).toBeVisible();
    expect(
      screen.getByText(/fetched only when you open friend features/i),
    ).toBeVisible();
    const enable = screen.getByRole("button", { name: "Enable sharing" });
    await user.click(enable);
    expect(enable).toBeDisabled();
    await user.click(enable);
    expect(updateAttempts).toBe(1);
    resolveFirstUpdate(problem(503, "Sharing unavailable", "req-sharing"));
    expect(
      await screen.findByRole("heading", { name: "Sharing unavailable" }),
    ).toBeVisible();
    expect(screen.getByText("Sharing is disabled.")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Enable sharing" }),
    ).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Enable sharing" }));
    expect(await screen.findByText("Sharing is enabled.")).toBeVisible();
    result
      .getQueryClient()
      .setQueryData(["leaderboard", "friends", "list"], { private: true });
    await user.click(screen.getByRole("button", { name: "Disable sharing" }));
    expect(await screen.findByText("Sharing is disabled.")).toBeVisible();
    expect(
      result.getQueryClient().getQueryData(["leaderboard", "friends", "list"]),
    ).toBeUndefined();
    expect(updateAttempts).toBe(3);
    expect(await axe(result.container)).toHaveNoViolations();
  });

  it("shows accessible distinct actions and requires exact typed deletion confirmation", async () => {
    const fetcher = standardFetcher(() => new Response(null, { status: 204 }));
    const result = renderSettings(fetcher);
    const user = userEvent.setup();

    expect(
      await screen.findByRole("heading", { name: "Account & Security" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Log out this device" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Log out all devices" }),
    ).toBeVisible();
    const opener = screen.getByRole("button", { name: "Delete account" });
    await user.click(opener);

    const dialog = screen.getByRole("dialog", {
      name: "Permanently delete account",
    });
    expect(
      within(dialog).getByText(
        /identity, profile, library, synchronization, sessions, comparisons/i,
      ),
    ).toBeVisible();
    expect(
      within(dialog).getByText(/steam account is not deleted or modified/i),
    ).toBeVisible();
    const confirmation = within(dialog).getByRole("textbox", {
      name: /type delete/i,
    });
    const submit = within(dialog).getByRole("button", {
      name: "Permanently delete account",
    });
    expect(submit).toBeDisabled();
    await user.type(confirmation, "delete");
    expect(submit).toBeDisabled();
    await user.clear(confirmation);
    await user.type(confirmation, "DELETE");
    expect(submit).toBeEnabled();
    expect(await axe(result.container)).toHaveNoViolations();

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(opener).toHaveFocus();
    await user.click(opener);
    expect(within(screen.getByRole("dialog")).getByRole("textbox")).toHaveValue(
      "",
    );
  });

  it("logs out this browser once, clears it, and guards stale protected navigation", async () => {
    const fetcher = standardFetcher(() => new Response(null, { status: 204 }));
    renderSettings(fetcher);
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: "Account & Security" });
    await user.click(
      screen.getByRole("button", { name: "Log out this device" }),
    );

    expect(
      await screen.findByText("You have been logged out on this device."),
    ).toBeVisible();
    const logoutCalls = fetcher.mock.calls.filter(([input]) =>
      String(input).endsWith("/auth/logout"),
    );
    expect(logoutCalls).toHaveLength(1);
    expect(new Headers(logoutCalls[0]![1]?.headers).get("X-CSRF-Token")).toBe(
      "settings-csrf",
    );

    await user.click(screen.getByRole("link", { name: "Compare" }));
    expect(
      await screen.findByRole("heading", { name: "Sign in to continue" }),
    ).toBeVisible();
    expect(screen.queryByText(/session controls/i)).not.toBeInTheDocument();
  });

  it("clears this browser when logout reports an already-invalid session", async () => {
    const fetcher = standardFetcher(() =>
      problem(401, "Session already ended", "req-ended"),
    );
    renderSettings(fetcher);

    await screen.findByRole("heading", { name: "Account & Security" });
    await userEvent.click(
      screen.getByRole("button", { name: "Log out this device" }),
    );

    expect(
      await screen.findByText("You have been logged out on this device."),
    ).toBeVisible();
    expect(
      fetcher.mock.calls.filter(([input]) =>
        String(input).endsWith("/auth/logout"),
      ),
    ).toHaveLength(1);
  });

  it("requires confirmation before logging out all devices", async () => {
    const fetcher = standardFetcher(() => new Response(null, { status: 204 }));
    renderSettings(fetcher);
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: "Account & Security" });
    await user.click(
      screen.getByRole("button", { name: "Log out all devices" }),
    );
    expect(
      fetcher.mock.calls.some(([input]) =>
        String(input).endsWith("/auth/logout-all"),
      ),
    ).toBe(false);
    const dialog = screen.getByRole("dialog", { name: "Log out all devices" });
    await user.click(
      within(dialog).getByRole("button", {
        name: "Confirm log out all devices",
      }),
    );

    expect(
      await screen.findByText("You have been logged out on every device."),
    ).toBeVisible();
    expect(
      fetcher.mock.calls.filter(([input]) =>
        String(input).endsWith("/auth/logout-all"),
      ),
    ).toHaveLength(1);
  });

  it("submits deletion once while pending and reports confirmed completion", async () => {
    let resolveDelete!: (response: Response) => void;
    const fetcher = standardFetcher(
      () =>
        new Promise<Response>((resolve) => {
          resolveDelete = resolve;
        }),
    );
    renderSettings(fetcher);
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: "Account & Security" });
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByRole("textbox"), "DELETE");
    const submit = within(dialog).getByRole("button", {
      name: "Permanently delete account",
    });
    await user.click(submit);
    expect(submit).toBeDisabled();
    expect(within(dialog).getByRole("status")).toHaveTextContent(/deleting/i);
    await user.click(submit);
    expect(
      fetcher.mock.calls.filter(
        ([input, init]) =>
          String(input).endsWith("/me") && init?.method === "DELETE",
      ),
    ).toHaveLength(1);

    resolveDelete(new Response(null, { status: 204 }));
    expect(
      await screen.findByText(
        /LibTaste account and user-specific data were deleted/i,
      ),
    ).toBeVisible();
    expect(screen.queryByText(/restore/i)).not.toBeInTheDocument();
  });

  it("keeps Account & Security and permits explicit retry after a recoverable Problem Details failure", async () => {
    let attempts = 0;
    const fetcher = standardFetcher(() =>
      problem(429, "Too many requests", `req-${++attempts}`),
    );
    renderSettings(fetcher);
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: "Account & Security" });
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByRole("textbox"), "DELETE");
    await user.click(
      within(dialog).getByRole("button", {
        name: "Permanently delete account",
      }),
    );

    expect(
      await within(dialog).findByRole("heading", { name: "Too many requests" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Account & Security" }),
    ).toBeVisible();
    await user.click(within(dialog).getByText("Support details"));
    expect(within(dialog).getByText("Request ID:")).toBeVisible();
    const retry = within(dialog).getByRole("button", {
      name: "Permanently delete account",
    });
    expect(retry).toBeEnabled();
    await user.click(retry);
    expect(
      fetcher.mock.calls.filter(
        ([input, init]) =>
          String(input).endsWith("/me") && init?.method === "DELETE",
      ),
    ).toHaveLength(2);
  });

  it("checks session state without automatically repeating an uncertain deletion", async () => {
    let tokenCalls = 0;
    let deleteCalls = 0;
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/auth/token")) {
        tokenCalls += 1;
        return token(tokenCalls === 1 ? "before" : "recovered");
      }
      if (url.endsWith("/me") && (init?.method ?? "GET") === "GET")
        return profile();
      if (url.endsWith("/me") && init?.method === "DELETE") {
        deleteCalls += 1;
        throw new TypeError("connection ended");
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    renderSettings(fetcher);
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: "Account & Security" });
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByRole("textbox"), "DELETE");
    await user.click(
      within(dialog).getByRole("button", {
        name: "Permanently delete account",
      }),
    );

    expect(
      await within(dialog).findByText(/account still appears available/i),
    ).toBeVisible();
    expect(deleteCalls).toBe(1);
    expect(tokenCalls).toBe(2);
    expect(
      within(dialog).getByRole("button", {
        name: "Permanently delete account",
      }),
    ).toBeEnabled();
  });

  it("reports apparent completion when uncertain deletion recovery finds no session", async () => {
    let tokenCalls = 0;
    let deleteCalls = 0;
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/auth/token")) {
        tokenCalls += 1;
        return tokenCalls === 1
          ? token("before")
          : problem(401, "Session ended", "req-recovery");
      }
      if (url.endsWith("/me") && (init?.method ?? "GET") === "GET") {
        return profile();
      }
      if (url.endsWith("/me") && init?.method === "DELETE") {
        deleteCalls += 1;
        throw new TypeError("connection ended");
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    renderSettings(fetcher);
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: "Account & Security" });
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByRole("textbox"), "DELETE");
    await user.click(
      within(dialog).getByRole("button", {
        name: "Permanently delete account",
      }),
    );

    expect(
      await screen.findByText(/Account deletion appears complete/i),
    ).toBeVisible();
    expect(deleteCalls).toBe(1);
    expect(tokenCalls).toBe(2);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
