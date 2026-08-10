import { axe } from "jest-axe";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { SessionManager } from "../../api/client";
import type { components } from "../../api/generated";
import { ApplicationProviders, ApplicationRoutes } from "../../app/App";
import type { RuntimeConfig } from "../../config";

type GlobalEntry = components["schemas"]["GlobalLeaderboardEntry"];
type PersonalEntry = components["schemas"]["PersonalLeaderboardEntry"];

const config: RuntimeConfig = {
  apiBaseUrl: "https://api.example.test/api/v1",
  webClientId: "web-client",
  environmentLabel: "Test",
};

const globalPortal: GlobalEntry = {
  rank: 7,
  appId: 400,
  name: "Portal",
  artworkUrl: "https://cdn.example.test/portal.jpg",
  score: 42.75,
  contributorCount: 19,
  status: "RANKED",
};

const personalPortal: PersonalEntry = {
  rank: 4,
  appId: 400,
  name: "Portal",
  artworkUrl: "https://cdn.example.test/portal.jpg",
  score: null,
  comparisonCount: 2,
  status: "PROVISIONAL",
  currentlyOwned: true,
  effectivelyEligible: true,
};

function json(body: unknown, status = 200, contentType = "application/json") {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": contentType },
  });
}

function renderRoute(route: string, fetcher: typeof fetch) {
  const session = new SessionManager(config, { fetcher });
  let queryClient: QueryClient | undefined;
  function CaptureQueryClient() {
    queryClient = useQueryClient();
    return null;
  }
  const result = render(
    <ApplicationProviders config={config} session={session}>
      <CaptureQueryClient />
      <MemoryRouter initialEntries={[route]}>
        <ApplicationRoutes config={config} />
      </MemoryRouter>
    </ApplicationProviders>,
  );
  return { ...result, session, getQueryClient: () => queryClient! };
}

function authenticatedFetcher(
  handler: (url: URL, init?: RequestInit) => Promise<Response> | Response,
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
        displayName: "Test Pilot",
        libraryState: "AVAILABLE",
        synchronization: null,
      });
    }
    return handler(url, init);
  });
}

describe("game leaderboards", () => {
  it("renders public contract data in server order without authentication or personal cache scope", async () => {
    const globalHades = {
      ...globalPortal,
      rank: 3,
      appId: 1145360,
      name: "Hades",
      contributorCount: 11,
      score: 40.5,
      status: "PROVISIONAL" as const,
    };
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      expect(String(input)).toBe(
        "https://api.example.test/api/v1/leaderboards/global",
      );
      expect(new Headers(init?.headers).has("Authorization")).toBe(false);
      expect(init?.credentials).toBe("omit");
      return json({ items: [globalPortal, globalHades], nextCursor: null });
    });
    const { container, session, getQueryClient } = renderRoute(
      "/leaderboard/global",
      fetcher,
    );
    const refresh = vi.spyOn(session, "refresh");

    expect(
      await screen.findByRole("heading", { name: "Global leaderboard" }),
    ).toBeVisible();
    expect(
      (await screen.findAllByRole("rowheader")).map((cell) => cell.textContent),
    ).toEqual(["Portal", "Hades"]);
    expect(
      screen.getByRole("columnheader", { name: "Contributors" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("columnheader", { name: "Comparisons" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("19 contributors")).toBeVisible();
    expect(screen.getByText("42.75")).toBeVisible();
    expect(
      screen.getByText(
        /global score is the API's capped precision-weighted mean/i,
      ),
    ).toBeVisible();
    expect(screen.getByText(/must not be directly compared/i)).toBeVisible();
    expect(refresh).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(
      getQueryClient()
        .getQueryCache()
        .getAll()
        .map((query) => ({ key: query.queryKey, scope: query.meta?.scope })),
    ).toEqual([{ key: ["leaderboard", "global"], scope: "public" }]);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("replaces personal pages for history and retries the same failed cursor without losing rows", async () => {
    document.cookie = "libtaste_csrf=test; path=/";
    const requestUrls: string[] = [];
    let nextAttempts = 0;
    const currentHades = {
      ...personalPortal,
      rank: 5,
      appId: 1145360,
      name: "Hades",
      score: 18.125,
      comparisonCount: 15,
      status: "RANKED" as const,
    };
    const historicalHalfLife = {
      ...personalPortal,
      rank: 9,
      appId: 70,
      name: "Half-Life",
      currentlyOwned: false,
      effectivelyEligible: false,
      score: 12,
    };
    const fetcher = authenticatedFetcher((url) => {
      requestUrls.push(url.toString());
      if (url.searchParams.get("includeHistorical") === "true") {
        expect(url.searchParams.has("cursor")).toBe(false);
        return json({ items: [historicalHalfLife], nextCursor: null });
      }
      if (url.searchParams.get("cursor") === "personal+/=") {
        nextAttempts += 1;
        if (nextAttempts === 1) {
          return json(
            {
              title: "Page unavailable",
              detail: "The next page could not be loaded.",
              status: 503,
              requestId: "req-next",
            },
            503,
            "application/problem+json",
          );
        }
        return json({
          items: [personalPortal, currentHades],
          nextCursor: null,
        });
      }
      expect(url.searchParams.get("includeHistorical")).toBe("false");
      return json({ items: [personalPortal], nextCursor: "personal+/=" });
    });
    const { container } = renderRoute("/leaderboard/me", fetcher);

    expect(
      await screen.findByRole("heading", { name: "My ranking" }),
    ).toBeVisible();
    expect(
      await screen.findByRole("columnheader", { name: "Comparisons" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("columnheader", { name: "Contributors" }),
    ).not.toBeInTheDocument();
    const portalRow = screen
      .getByRole("rowheader", { name: "Portal" })
      .closest("tr")!;
    expect(within(portalRow).getByText("Not yet scored")).toBeVisible();
    expect(within(portalRow).getByText("2 comparisons")).toBeVisible();
    expect(within(portalRow).getByText("Currently owned")).toBeVisible();
    expect(within(portalRow).getByText("Eligible")).toBeVisible();
    expect(
      screen.getByText(/personal score is the API's conservative rating/i),
    ).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(
      await screen.findByText("The next page could not be loaded."),
    ).toBeVisible();
    expect(screen.getByRole("rowheader", { name: "Portal" })).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: "Retry loading more" }),
    );
    expect(
      await screen.findByRole("rowheader", { name: "Hades" }),
    ).toBeVisible();
    expect(screen.getAllByRole("rowheader", { name: "Portal" })).toHaveLength(
      1,
    );
    expect(nextAttempts).toBe(2);

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Include historical games" }),
    );
    expect(
      await screen.findByRole("rowheader", { name: "Half-Life" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("rowheader", { name: "Portal" }),
    ).not.toBeInTheDocument();
    expect(requestUrls.at(-1)).toContain("includeHistorical=true");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("distinguishes empty, terminal, loading, and rate-limited global states", async () => {
    let attempt = 0;
    const fetcher = vi.fn<typeof fetch>(async () => {
      attempt += 1;
      if (attempt === 1) {
        return json(
          {
            title: "Too many requests",
            detail: "Wait for the leaderboard cooldown.",
            status: 429,
            requestId: "req-rate",
          },
          429,
          "application/problem+json",
        );
      }
      return json({ items: [], nextCursor: null });
    });
    renderRoute("/leaderboard/global", fetcher);

    expect(screen.getByRole("status")).toHaveTextContent(
      /loading global leaderboard/i,
    );
    expect(
      await screen.findByText(
        /leaderboard requests are temporarily rate limited/i,
      ),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByText(
        "No games have entered the global leaderboard yet.",
      ),
    ).toBeVisible();
    expect(screen.queryByRole("row")).not.toBeInTheDocument();
  });

  it("renders 100 lazy-artwork rows accessibly without changing transport precision", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 360,
    });
    const items: GlobalEntry[] = Array.from({ length: 100 }, (_, index) => ({
      ...globalPortal,
      rank: index + 1,
      appId: index + 1,
      name: `Game ${index + 1}`,
      artworkUrl: `https://cdn.example.test/${index + 1}.jpg`,
      score: index === 0 ? 1.23456789 : index + 0.5,
    }));
    const fetcher = vi.fn<typeof fetch>(async () =>
      json({ items, nextCursor: null }),
    );
    const { container } = renderRoute("/leaderboard/global", fetcher);

    expect(
      await screen.findByRole("rowheader", { name: "Game 100" }),
    ).toBeVisible();
    expect(screen.getAllByRole("rowheader")).toHaveLength(100);
    expect(screen.getByText("1.23456789")).toBeVisible();
    for (const image of screen.getAllByRole("img")) {
      expect(image).toHaveAttribute("loading", "lazy");
    }
    expect(await axe(container)).toHaveNoViolations();
  }, 15_000);
});
