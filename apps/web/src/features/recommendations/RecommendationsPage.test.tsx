import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionManager } from "../../api/client";
import type { components } from "../../api/generated";
import { AuthProvider } from "../../auth/AuthContext";
import type { RuntimeConfig } from "../../config";
import { RecommendationsPage } from "./RecommendationsPage";

type RecommendationResponse = components["schemas"]["RecommendationResponse"];

const config: RuntimeConfig = {
  apiBaseUrl: "https://api.example.test/api/v1",
  webClientId: "web-client",
};

function json(body: unknown, status = 200, contentType = "application/json") {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": contentType },
  });
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
    return handler(url, init);
  });
}

function renderRecommendations(
  fetcher: typeof fetch,
  suppliedClient?: QueryClient,
) {
  document.cookie = "libtaste_csrf=test; path=/";
  const session = new SessionManager(config, { fetcher });
  const queryClient =
    suppliedClient ??
    new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider session={session}>
        <MemoryRouter>
          <RecommendationsPage />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { ...rendered, queryClient, session };
}

const recommendations: RecommendationResponse = {
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
        {
          appId: 588650,
          name: "Dead Cells",
          artworkUrl: "https://cdn.example.test/dead-cells.jpg",
          adjustedSimilarity: 0.72,
        },
        {
          appId: 237930,
          name: "Transistor",
          artworkUrl: "https://cdn.example.test/transistor.jpg",
          adjustedSimilarity: 0.51,
        },
      ],
      becauseOfTotalCount: 5,
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
    {
      appId: 105600,
      name: "Terraria",
      artworkUrl: "https://cdn.example.test/terraria.jpg",
      source: "BLENDED",
      predictedRankPercentile: 73,
      neighborSupportCount: 8,
      seedSupportCount: 3,
      becauseOf: [],
      becauseOfTotalCount: 1,
    },
  ],
};

afterEach(() => {
  document.cookie = "libtaste_csrf=; Max-Age=0; path=/";
  vi.useRealTimers();
});

describe("RecommendationsPage", () => {
  it("requests the default result once and presents ordered typed evidence accessibly", async () => {
    const recommendationUrls: URL[] = [];
    const fetcher = authenticatedFetcher((url) => {
      recommendationUrls.push(url);
      return json(recommendations);
    });
    const rendered = renderRecommendations(fetcher);

    expect(
      screen.getByRole("status", { name: /finding recommendations/i }),
    ).toBeVisible();
    const cards = await screen.findAllByRole("article");
    expect(
      cards.map(
        (card) => within(card).getByRole("heading", { level: 2 }).textContent,
      ),
    ).toEqual(["Hades", "Stardew Valley", "Terraria"]);
    expect(recommendationUrls).toHaveLength(1);
    expect(recommendationUrls[0].pathname).toBe("/api/v1/me/recommendations");
    expect(recommendationUrls[0].search).toBe("");
    const hades = cards[0];
    expect(within(hades).getByText("Similar games")).toBeVisible();
    expect(
      within(hades).getByText(
        "Predicted to rank above 91% of your rated games.",
      ),
    ).toBeVisible();
    expect(within(hades).getByText("Supported by 4 rated games")).toBeVisible();
    expect(
      within(hades).queryByText(/similar players/),
    ).not.toBeInTheDocument();
    expect(within(hades).getByText("88% similar")).toBeVisible();
    expect(within(hades).getByText("and 2 more")).toBeVisible();
    const steamLink = within(hades).getByRole("link", {
      name: /open hades on steam.*new tab/i,
    });
    expect(steamLink).toHaveAttribute(
      "href",
      "https://store.steampowered.com/app/1145360",
    );
    expect(steamLink).toHaveAttribute("target", "_blank");
    expect(steamLink).toHaveAttribute(
      "rel",
      expect.stringContaining("noopener"),
    );
    expect(within(cards[1]).getByText("Similar players")).toBeVisible();
    expect(
      within(cards[1]).queryByText("Because you rated"),
    ).not.toBeInTheDocument();
    expect(
      within(cards[2]).getByText("Similar games and players"),
    ).toBeVisible();
    expect(
      within(cards[2]).getByText("Supported by 8 similar players"),
    ).toBeVisible();
    expect(
      within(cards[2]).getByText("Supported by 3 rated games"),
    ).toBeVisible();
    for (const image of screen.getAllByRole("img")) {
      expect(image).toHaveAttribute("loading", "lazy");
    }
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(await axe(rendered.container)).toHaveNoViolations();
  });

  it.each([
    ["NOT_ENOUGH_PERSONAL_RATINGS", /more ranked, non-excluded games/i, true],
    ["NO_RATING_VARIATION", /clearer differentiation/i, true],
    ["NOT_ENOUGH_COMMUNITY_DATA", /return later/i, false],
  ] as const)(
    "renders %s without inventing recovery claims",
    async (reason, copy, compareLink) => {
      renderRecommendations(
        authenticatedFetcher(() =>
          json({ status: "INSUFFICIENT_DATA", reason, recommendations: [] }),
        ),
      );

      expect(await screen.findByText(copy)).toBeVisible();
      const link = screen.queryByRole("link", { name: /compare/i });
      if (compareLink) expect(link).toHaveAttribute("href", "/compare");
      else expect(link).not.toBeInTheDocument();
      expect(screen.queryByText(/dislike/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/\d+ ratings/i)).not.toBeInTheDocument();
    },
  );

  it("renders exhausted catalog without a misleading action", async () => {
    renderRecommendations(
      authenticatedFetcher(() =>
        json({ status: "NO_CANDIDATES", recommendations: [] }),
      ),
    );

    expect(
      await screen.findByText(/current or historical steam library/i),
    ).toBeVisible();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers explicit retry for a safe recoverable failure and replaces no stale result", async () => {
    let attempts = 0;
    const fetcher = authenticatedFetcher(() => {
      attempts += 1;
      return attempts === 1
        ? json(
            {
              type: "https://api.example.test/problems/unavailable",
              title: "Recommendations unavailable",
              detail: "Safe retry detail.",
              status: 503,
              requestId: "request-recommendations",
            },
            503,
            "application/problem+json",
          )
        : json(recommendations);
    });
    renderRecommendations(fetcher);

    expect(await screen.findByText("Safe retry detail.")).toBeVisible();
    expect(screen.queryByText("Hades")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Hades")).toBeVisible();
    expect(attempts).toBe(2);
  });

  it("tells rate-limited users to wait without encouraging immediate retry", async () => {
    renderRecommendations(
      authenticatedFetcher(() =>
        json(
          {
            type: "https://api.example.test/problems/rate-limited",
            title: "Too many requests",
            detail: "The request limit was reached.",
            status: 429,
            requestId: "request-rate-limit",
          },
          429,
          "application/problem+json",
        ),
      ),
    );

    expect(await screen.findByText(/wait before trying again/i)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /try again/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps successful data fresh for 60 seconds in private query state", async () => {
    const fetcher = authenticatedFetcher(() => json(recommendations));
    const { queryClient, unmount } = renderRecommendations(fetcher);
    await screen.findByText("Hades");
    unmount();
    renderRecommendations(fetcher, queryClient);
    await screen.findByText("Hades");

    fireEvent.focus(window);
    await Promise.resolve();

    expect(
      fetcher.mock.calls.filter(([input]) =>
        String(input).endsWith("/me/recommendations"),
      ),
    ).toHaveLength(1);
    const query = queryClient
      .getQueryCache()
      .find({ queryKey: ["recommendations"] });
    expect(query?.meta).toEqual({ scope: "user" });
    await waitFor(() => expect(query?.state.data).toEqual(recommendations));
    vi.useFakeTimers();
    vi.setSystemTime(query!.state.dataUpdatedAt + 59_999);
    expect(query!.isStaleByTime(60_000)).toBe(false);
    vi.setSystemTime(query!.state.dataUpdatedAt + 60_000);
    expect(query!.isStaleByTime(60_000)).toBe(true);
  });

  it("cancels and removes recommendation data when the session is cleared", async () => {
    const fetcher = authenticatedFetcher(() => json(recommendations));
    const { queryClient, session, unmount } = renderRecommendations(fetcher);
    await screen.findByText("Hades");
    expect(queryClient.getQueryData(["recommendations"])).toEqual(
      recommendations,
    );

    session.clear();
    unmount();

    await waitFor(() =>
      expect(queryClient.getQueryData(["recommendations"])).toBeUndefined(),
    );
  });

  it("aborts in-flight recommendation work when the session is lost", async () => {
    let started!: () => void;
    const requestStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    let aborted = false;
    const fetcher = authenticatedFetcher((_url, init) => {
      started();
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          aborted = true;
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });
    const { queryClient, session, unmount } = renderRecommendations(fetcher);
    await requestStarted;

    session.clear();
    unmount();

    await waitFor(() => {
      expect(aborted).toBe(true);
      expect(queryClient.getQueryState(["recommendations"])).toBeUndefined();
    });
  });

  it("renders 100 contract-valid cards without changing server order", async () => {
    const entries = Array.from({ length: 100 }, (_, index) => ({
      ...recommendations.recommendations[1],
      appId: index + 1,
      name: `Game ${index + 1}`,
      artworkUrl: `https://cdn.example.test/${index + 1}.jpg`,
    }));
    renderRecommendations(
      authenticatedFetcher(() =>
        json({ status: "OK", recommendations: entries }),
      ),
    );

    expect(
      await screen.findByRole("heading", { name: "Game 100" }),
    ).toBeVisible();
    expect(screen.getAllByRole("article")).toHaveLength(100);
  }, 15_000);
});
