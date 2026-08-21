import { render, screen, within } from "@testing-library/react";
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

const friendId = "11111111-1111-4111-8111-111111111111";

function json(body: unknown, status = 200, contentType = "application/json") {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": contentType },
  });
}

function problem(type: string, status: number, detail: string) {
  return json(
    {
      type: `https://api.example.test/problems/${type}`,
      title: "Friend feature unavailable",
      status,
      detail,
      requestId: "req-friends",
    },
    status,
    "application/problem+json",
  );
}

function authenticatedFetcher(
  handler: (url: URL, init?: RequestInit) => Response | Promise<Response>,
) {
  return vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/auth/token")) {
      return json({
        access_token: "access",
        token_type: "Bearer",
        expires_in: 900,
      });
    }
    if (url.pathname.endsWith("/me")) {
      return json({
        steamId64: "76561198000000000",
        displayName: "Friend Tester",
        libraryState: "AVAILABLE",
        synchronization: null,
      });
    }
    return handler(url, init);
  });
}

function renderRoute(route: string, fetcher: typeof fetch) {
  document.cookie = "libtaste_csrf=friends-csrf; path=/";
  const session = new SessionManager(config, { fetcher });
  return render(
    <ApplicationProviders config={config} session={session}>
      <MemoryRouter initialEntries={[route]}>
        <ApplicationRoutes config={config} />
      </MemoryRouter>
    </ApplicationProviders>,
  );
}

describe("Steam friend leaderboards", () => {
  it("does not discover friends while reciprocal sharing is disabled", async () => {
    const fetcher = authenticatedFetcher((url) => {
      if (url.pathname.endsWith("/me/friend-leaderboard-sharing")) {
        return json({ enabled: false });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const result = renderRoute("/leaderboard/friends", fetcher);

    expect(
      await screen.findByRole("heading", { name: "Friends" }),
    ).toBeVisible();
    expect(
      await screen.findByText(/reciprocal sharing is disabled/i),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Open Account & Security" }),
    ).toHaveAttribute("href", "/settings");
    expect(
      fetcher.mock.calls.some(([input]) =>
        new URL(String(input)).pathname.endsWith("/me/friends"),
      ),
    ).toBe(false);
    expect(await axe(result.container)).toHaveNoViolations();
  });

  it("appends participating friends in server order with only opaque route identifiers", async () => {
    const requestUrls: string[] = [];
    let nextAttempts = 0;
    const fetcher = authenticatedFetcher((url) => {
      if (url.pathname.endsWith("/me/friend-leaderboard-sharing")) {
        return json({ enabled: true });
      }
      if (url.pathname.endsWith("/me/friends")) {
        requestUrls.push(url.toString());
        if (url.searchParams.get("cursor") === "friend+/=") {
          nextAttempts += 1;
          if (nextAttempts === 1) {
            return problem(
              "steam-friends-unavailable",
              503,
              "Steam could not refresh friends.",
            );
          }
          return json({
            items: [
              {
                friendId: "22222222-2222-4222-8222-222222222222",
                displayName: "zoe",
                avatarUrl: null,
                profileUrl: null,
              },
            ],
            nextCursor: null,
          });
        }
        return json({
          items: [
            {
              friendId,
              displayName: "ALIce",
              avatarUrl: "https://cdn.example.test/alice.jpg",
              profileUrl: "https://steamcommunity.com/id/alice",
            },
          ],
          nextCursor: "friend+/=",
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const result = renderRoute("/leaderboard/friends", fetcher);

    expect(await screen.findByText("ALIce")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Open ALIce's Steam profile" }),
    ).toHaveAttribute("href", "https://steamcommunity.com/id/alice");
    expect(
      screen.getByRole("link", { name: "View ALIce's ranking" }),
    ).toHaveAttribute("href", `/leaderboard/friends/${friendId}`);
    expect(screen.queryByText(friendId)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(
      await screen.findByText(/Steam friends are temporarily unavailable/i),
    ).toBeVisible();
    expect(screen.getByText("ALIce")).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: "Retry loading more" }),
    );
    expect(await screen.findByText("zoe")).toBeVisible();
    expect(requestUrls.at(-1)).toContain("cursor=friend%2B%2F%3D");
    expect(nextAttempts).toBe(2);
    expect(await axe(result.container)).toHaveNoViolations();
  });

  it("renders a paginated friend ranking without owner-only fields", async () => {
    let nextAttempts = 0;
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      rank: index + 1,
      appId: index + 400,
      name: index === 0 ? "Portal" : `Ranked game ${index + 1}`,
      artworkUrl: `https://cdn.example.test/ranked-${index + 1}.jpg`,
    }));
    const fetcher = authenticatedFetcher((url) => {
      if (url.pathname.endsWith("/me/friend-leaderboard-sharing")) {
        return json({ enabled: true });
      }
      if (url.pathname.endsWith(`/me/friends/${friendId}/leaderboard`)) {
        if (url.searchParams.get("cursor") === "games+/=") {
          nextAttempts += 1;
          return json({
            items: [
              {
                rank: 101,
                appId: 1620,
                name: "Portal 2",
                artworkUrl: "https://cdn.example.test/portal-2.jpg",
              },
            ],
            nextCursor: null,
          });
        }
        return json({
          items: firstPage,
          nextCursor: "games+/=",
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const result = renderRoute(`/leaderboard/friends/${friendId}`, fetcher);

    expect(
      await screen.findByRole("heading", { name: "Friend ranking" }),
    ).toBeVisible();
    expect(
      (await screen.findAllByRole("columnheader")).map(
        (cell) => cell.textContent,
      ),
    ).toEqual(["Rank", "Artwork", "Game"]);
    const portalRow = screen
      .getByRole("rowheader", { name: "Portal" })
      .closest("tr")!;
    const steamLink = within(portalRow).getByRole("link", {
      name: "View Portal on Steam (opens in a new tab)",
    });
    expect(steamLink).toHaveAttribute(
      "href",
      "https://store.steampowered.com/app/400",
    );
    expect(steamLink).toHaveAttribute("target", "_blank");
    expect(steamLink).toHaveAttribute(
      "rel",
      expect.stringContaining("noopener"),
    );
    expect(
      within(portalRow).queryByText(/score|comparison|owned|eligible/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(friendId)).not.toBeInTheDocument();
    expect(screen.getAllByRole("rowheader")).toHaveLength(100);
    expect(
      screen.getByRole("rowheader", { name: "Ranked game 100" }),
    ).toBeVisible();
    for (const image of screen.getAllByRole("img", { name: /artwork/i })) {
      expect(image).toHaveAttribute("loading", "lazy");
    }
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(
      await screen.findByRole("rowheader", { name: "Portal 2" }),
    ).toBeVisible();
    expect(nextAttempts).toBe(1);
    expect(await axe(result.container)).toHaveNoViolations();
  });

  it("uses safe distinct friend recovery copy and a generic target failure", async () => {
    let privateList = true;
    const fetcher = authenticatedFetcher((url) => {
      if (url.pathname.endsWith("/me/friend-leaderboard-sharing")) {
        return json({ enabled: true });
      }
      if (url.pathname.endsWith("/me/friends")) {
        return privateList
          ? problem(
              "steam-friend-list-private",
              424,
              "Steam did not expose this requester's friend list.",
            )
          : json({ items: [], nextCursor: null });
      }
      if (url.pathname.endsWith(`/me/friends/${friendId}/leaderboard`)) {
        return problem(
          "friend-not-found",
          404,
          "Internal target state must not be shown.",
        );
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    renderRoute("/leaderboard/friends", fetcher);

    expect(
      await screen.findByText(/Steam friend list is private/i),
    ).toBeVisible();
    expect(
      screen.getByText(
        /Profile.*Edit Profile.*Privacy Settings.*Friends List.*Public/i,
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Open Steam privacy guidance" }),
    ).toHaveAttribute(
      "href",
      "https://help.steampowered.com/en/faqs/view/588C-C67D-0251-C276",
    );
    expect(
      screen.getByRole("link", { name: "Open Steam privacy guidance" }),
    ).toHaveAttribute("target", "_blank");
    privateList = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/No participating friends/i)).toBeVisible();

    renderRoute(`/leaderboard/friends/${friendId}`, fetcher);
    expect(
      await screen.findByRole("heading", {
        name: "Friend ranking unavailable",
      }),
    ).toBeVisible();
    expect(
      screen.queryByText(/internal target state/i),
    ).not.toBeInTheDocument();
  });

  it("shows a truthful successful empty friend ranking", async () => {
    const fetcher = authenticatedFetcher((url) => {
      if (url.pathname.endsWith("/me/friend-leaderboard-sharing")) {
        return json({ enabled: true });
      }
      if (url.pathname.endsWith(`/me/friends/${friendId}/leaderboard`)) {
        return json({ items: [], nextCursor: null });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    renderRoute(`/leaderboard/friends/${friendId}`, fetcher);

    expect(
      await screen.findByText(/has no ranked games to share yet/i),
    ).toBeVisible();
    expect(screen.queryByRole("row")).not.toBeInTheDocument();
  });

  it("distinguishes sharing-required and friend rate-limit recovery", async () => {
    let attempt = 0;
    const fetcher = authenticatedFetcher((url) => {
      if (url.pathname.endsWith("/me/friend-leaderboard-sharing")) {
        return json({ enabled: true });
      }
      if (url.pathname.endsWith("/me/friends")) {
        attempt += 1;
        return attempt === 1
          ? problem(
              "friend-leaderboard-sharing-required",
              403,
              "Sharing is required.",
            )
          : problem("friend-rate-limit", 429, "Wait before retrying.");
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    renderRoute("/leaderboard/friends", fetcher);

    expect(
      await screen.findByText(/Reciprocal sharing is required/i),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Open Account & Security" }),
    ).toHaveAttribute("href", "/settings");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByText(/Friend requests are temporarily rate limited/i),
    ).toBeVisible();
  });
});
