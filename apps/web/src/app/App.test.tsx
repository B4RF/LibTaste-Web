import { axe } from "jest-axe";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { SessionManager } from "../api/client";
import type { RuntimeConfig } from "../config";
import { ApplicationProviders, ApplicationRoutes } from "./App";

const config: RuntimeConfig = {
  apiBaseUrl: "https://api.example.test/api/v1",
  webClientId: "web-client",
  environmentLabel: "Test",
};

function renderRoute(
  route: string,
  session = new SessionManager(config, { fetcher: vi.fn<typeof fetch>() }),
) {
  return render(
    <ApplicationProviders config={config} session={session}>
      <MemoryRouter initialEntries={[route]}>
        <ApplicationRoutes config={config} />
      </MemoryRouter>
    </ApplicationProviders>,
  );
}

describe("application routes", () => {
  it("renders an accessible public landing page with two truthful actions at 360px", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 360,
    });
    const result = renderRoute("/");
    expect(
      screen.getByRole("heading", { level: 1, name: /games you truly love/i }),
    ).toBeVisible();
    expect(screen.getByText(/choose between two steam games/i)).toBeVisible();
    const hero = screen.getByRole("heading", { level: 1 }).closest("section")!;
    expect(
      within(hero).getByRole("button", { name: /sign in through steam/i }),
    ).toBeVisible();
    expect(
      within(hero).getByRole("link", { name: /global leaderboard/i }),
    ).toHaveAttribute("href", "/leaderboard/global");
    expect(await axe(result.container)).toHaveNoViolations();
  });

  it("does not refresh authentication on the public global entry route", () => {
    const session = new SessionManager(config, {
      fetcher: vi.fn<typeof fetch>(),
    });
    const refresh = vi.spyOn(session, "refresh");
    renderRoute("/leaderboard/global", session);
    expect(
      screen.getByRole("heading", { name: "Global leaderboard" }),
    ).toBeVisible();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("guards protected content and retains a sign-in destination", async () => {
    document.cookie = "libtaste_csrf=; Max-Age=0; path=/";
    renderRoute("/library?from=nav");
    expect(
      screen.queryByRole("heading", { name: "Steam library" }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Sign in to continue" }),
    ).toBeVisible();
    expect(
      screen.queryByText(/this protected route is ready/i),
    ).not.toBeInTheDocument();
  });

  it("renders authenticated protected content after session restoration", async () => {
    document.cookie = "libtaste_csrf=test; path=/";
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      return new Response(
        JSON.stringify(
          url.endsWith("/auth/token")
            ? {
                access_token: "access",
                token_type: "Bearer",
                expires_in: 900,
              }
            : {
                steamId64: "76561198000000000",
                displayName: "Test Pilot",
                libraryState: "AVAILABLE",
                synchronization: null,
              },
        ),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    });
    renderRoute("/compare", new SessionManager(config, { fetcher }));
    expect(
      await screen.findByRole("heading", { name: "Compare games" }),
    ).toBeVisible();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("keeps an active synchronization visible across protected navigation", async () => {
    document.cookie = "libtaste_csrf=test; path=/";
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      return new Response(
        JSON.stringify(
          url.endsWith("/auth/token")
            ? {
                access_token: "access",
                token_type: "Bearer",
                expires_in: 900,
              }
            : {
                steamId64: "76561198000000000",
                displayName: "Test Pilot",
                libraryState: "AVAILABLE",
                synchronization: {
                  jobId: "11111111-1111-4111-8111-111111111111",
                  trigger: "LOGIN",
                  status: "PENDING",
                  attemptCount: 0,
                  requestedAt: "2026-08-10T08:00:00Z",
                  runAfter: "2026-08-10T08:00:00Z",
                },
              },
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    renderRoute("/compare", new SessionManager(config, { fetcher }));
    expect(await screen.findByText("Synchronization pending")).toBeVisible();
    await userEvent.click(screen.getByRole("link", { name: "Settings" }));
    expect(
      await screen.findByRole("heading", { name: "Settings" }),
    ).toBeVisible();
    expect(screen.getByText("Synchronization pending")).toBeVisible();
  });

  it("provides a not-found recovery path", () => {
    renderRoute("/missing");
    expect(screen.getByRole("heading", { name: /not here/i })).toBeVisible();
    expect(screen.getByRole("link", { name: /return home/i })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("clears user-scoped queries when restoration signs out", async () => {
    document.cookie = "libtaste_csrf=; Max-Age=0; path=/";
    renderRoute("/settings");
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Sign in to continue" }),
      ).toBeVisible(),
    );
  });
});
