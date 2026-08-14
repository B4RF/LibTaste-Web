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
  it("groups leaderboards in an accessible disclosure while keeping core tasks direct", async () => {
    const result = renderRoute("/");
    const navigation = screen.getByRole("navigation", {
      name: "Primary navigation",
    });
    const links = within(navigation).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Compare",
      "Recommendations",
    ]);
    expect(links[1]).toHaveAttribute("href", "/recommendations");
    const leaderboards = within(navigation).getByRole("button", {
      name: "Leaderboards",
    });
    expect(leaderboards).toHaveAttribute("aria-expanded", "false");
    await userEvent.hover(leaderboards);
    expect(leaderboards).toHaveAttribute("aria-expanded", "true");
    await userEvent.unhover(leaderboards);
    expect(leaderboards).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(leaderboards);
    expect(leaderboards).toHaveAttribute("aria-expanded", "true");
    expect(
      within(navigation).getByRole("link", { name: "My ranking" }),
    ).toHaveAttribute("href", "/leaderboard/me");
    expect(
      within(navigation).getByRole("link", { name: "Friends" }),
    ).toHaveAttribute("href", "/leaderboard/friends");
    expect(
      within(navigation).getByRole("link", { name: "Global" }),
    ).toHaveAttribute("href", "/leaderboard/global");
    await userEvent.keyboard("{Escape}");
    expect(leaderboards).toHaveAttribute("aria-expanded", "false");
    expect(leaderboards).toHaveFocus();
    expect(await axe(result.container)).toHaveNoViolations();
  });

  it("guards the Recommendations route without requesting private data", async () => {
    document.cookie = "libtaste_csrf=; Max-Age=0; path=/";
    const fetcher = vi.fn<typeof fetch>();
    renderRoute("/recommendations", new SessionManager(config, { fetcher }));

    expect(
      await screen.findByRole("heading", { name: "Sign in to continue" }),
    ).toBeVisible();
    expect(screen.queryByText("Personal discovery")).not.toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalledWith(
      expect.stringContaining("/me/recommendations"),
      expect.anything(),
    );
  });

  it("guards a copied friend-ranking route without exposing friend data", async () => {
    document.cookie = "libtaste_csrf=; Max-Age=0; path=/";
    const fetcher = vi.fn<typeof fetch>();
    renderRoute(
      "/leaderboard/friends/11111111-1111-4111-8111-111111111111",
      new SessionManager(config, { fetcher }),
    );

    expect(
      await screen.findByRole("heading", { name: "Sign in to continue" }),
    ).toBeVisible();
    expect(screen.queryByText(/friend ranking/i)).not.toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });

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
      const body = url.endsWith("/auth/token")
        ? {
            access_token: "access",
            token_type: "Bearer",
            expires_in: 900,
          }
        : url.endsWith("/comparisons/next")
          ? {
              comparisonId: "11111111-1111-4111-8111-111111111111",
              left: {
                appId: 400,
                name: "Portal",
                artworkUrl: "https://cdn.example.test/portal.jpg",
              },
              right: {
                appId: 620,
                name: "Portal 2",
                artworkUrl: "https://cdn.example.test/portal-2.jpg",
              },
              createdAt: "2026-08-10T08:00:00Z",
              expiresAt: "2026-08-11T08:00:00Z",
            }
          : {
              steamId64: "76561198000000000",
              displayName: "Test Pilot",
              avatarUrl: "https://cdn.example.test/avatar.jpg",
              libraryState: "AVAILABLE",
              synchronization: null,
            };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    renderRoute("/compare", new SessionManager(config, { fetcher }));
    expect(
      await screen.findByRole("heading", { name: "Compare games" }),
    ).toBeVisible();
    expect(
      await screen.findByRole("button", { name: "Test Pilot profile" }),
    ).toBeVisible();
    expect(
      screen.getByRole("img", { name: "Test Pilot avatar" }),
    ).toBeVisible();
    expect(
      screen.queryByLabelText("Library synchronization status"),
    ).not.toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("keeps an active synchronization visible across protected navigation", async () => {
    document.cookie = "libtaste_csrf=test; path=/";
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      const body = url.endsWith("/auth/token")
        ? {
            access_token: "access",
            token_type: "Bearer",
            expires_in: 900,
          }
        : url.endsWith("/comparisons/next")
          ? {
              comparisonId: "11111111-1111-4111-8111-111111111111",
              left: {
                appId: 400,
                name: "Portal",
                artworkUrl: "https://cdn.example.test/portal.jpg",
              },
              right: {
                appId: 620,
                name: "Portal 2",
                artworkUrl: "https://cdn.example.test/portal-2.jpg",
              },
              createdAt: "2026-08-10T08:00:00Z",
              expiresAt: "2026-08-11T08:00:00Z",
            }
          : url.endsWith("/me/library")
            ? { items: [] }
            : {
                steamId64: "76561198000000000",
                displayName: "Test Pilot",
                profileUrl: "https://steamcommunity.com/id/test-pilot",
                libraryState: "AVAILABLE",
                synchronization: {
                  jobId: "11111111-1111-4111-8111-111111111111",
                  trigger: "LOGIN",
                  status: "PENDING",
                  attemptCount: 0,
                  requestedAt: "2026-08-10T08:00:00Z",
                  runAfter: "2026-08-10T08:00:00Z",
                },
              };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    renderRoute("/compare", new SessionManager(config, { fetcher }));
    expect(await screen.findByText("Synchronization pending")).toBeVisible();
    const profileButton = screen.getByRole("button", {
      name: "Test Pilot profile",
    });
    await userEvent.click(profileButton);
    expect(
      within(profileButton.closest("li")!)
        .getAllByRole("link")
        .map((link) => link.textContent?.trim()),
    ).toEqual(["Open Steam profile ↗", "Library", "Account & Security"]);
    const library = screen.getByRole("link", { name: "Library" });
    expect(library).toHaveAttribute("href", "/library");
    await userEvent.click(library);
    expect(
      await screen.findByRole("heading", { name: "Steam library" }),
    ).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: "Test Pilot profile" }),
    );
    await userEvent.click(
      screen.getByRole("link", { name: "Account & Security" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Account & Security" }),
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
