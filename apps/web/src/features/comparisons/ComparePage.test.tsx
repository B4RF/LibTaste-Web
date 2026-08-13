import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
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
import { ApiProblem } from "../../api/problem";
import { AuthProvider } from "../../auth/AuthContext";
import type { RuntimeConfig } from "../../config";
import { recommendationQueryKey } from "../recommendations/recommendationApi";
import { ComparePage, classifyAllocationProblem } from "./ComparePage";

const config: RuntimeConfig = {
  apiBaseUrl: "https://api.example.test/api/v1",
  webClientId: "web-client",
};

const comparison = {
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
  expiresAt: "2099-08-11T08:00:00Z",
};

const nextComparison = {
  ...comparison,
  comparisonId: "22222222-2222-4222-8222-222222222222",
  left: { ...comparison.left, appId: 730, name: "Counter-Strike 2" },
};

const excludedPortal = {
  appId: comparison.left.appId,
  name: comparison.left.name,
  artworkUrl: comparison.left.artworkUrl,
  currentlyOwned: true,
  playtimeMinutes: 120,
  eligibilityOverride: "EXCLUDED" as const,
  effectivelyEligible: false,
};

function json(body: unknown, status = 200, contentType = "application/json") {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": contentType },
  });
}

function authenticatedFetcher(
  handleRequest: (url: URL, init?: RequestInit) => Promise<Response> | Response,
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
    return handleRequest(url, init);
  });
}

function renderCompare(fetcher: typeof fetch) {
  document.cookie = "libtaste_csrf=test; path=/";
  const session = new SessionManager(config, { fetcher });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider session={session}>
        <MemoryRouter>
          <ComparePage />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { ...rendered, queryClient };
}

function result(outcome: "LEFT_WIN" | "RIGHT_WIN" | "DRAW" | "SKIP") {
  return {
    comparisonId: comparison.comparisonId,
    outcome,
    completedAt: "2026-08-10T09:00:00Z",
  };
}

afterEach(() => {
  document.cookie = "libtaste_csrf=; Max-Age=0; path=/";
  vi.useRealTimers();
});

describe("ComparePage", () => {
  it("exposes exact quiet Steam links without submitting an outcome or exclusion", async () => {
    let mutations = 0;
    const fetcher = authenticatedFetcher((url) => {
      if (url.pathname.endsWith("/comparisons/next")) return json(comparison);
      mutations += 1;
      return json(result("SKIP"));
    });
    renderCompare(fetcher);

    const portalLink = await screen.findByRole("link", {
      name: "View Portal on Steam (opens in a new tab)",
    });
    expect(portalLink).toHaveAttribute(
      "href",
      "https://store.steampowered.com/app/400",
    );
    expect(portalLink).toHaveAttribute("target", "_blank");
    expect(portalLink).toHaveAttribute("rel", "noreferrer");
    expect(
      screen.getByRole("link", {
        name: "View Portal 2 on Steam (opens in a new tab)",
      }),
    ).toHaveAttribute("href", "https://store.steampowered.com/app/620");

    portalLink.focus();
    fireEvent.keyDown(portalLink, { key: "a" });
    expect(portalLink).toHaveFocus();
    expect(mutations).toBe(0);
  });

  it("places the compact Draw and Skip controls between the two game choices", async () => {
    const fetcher = authenticatedFetcher((url) =>
      url.pathname.endsWith("/comparisons/next")
        ? json(comparison)
        : json(result("DRAW")),
    );
    renderCompare(fetcher);

    const left = await screen.findByRole("button", {
      name: "Portal choose left",
    });
    const draw = screen.getByRole("button", { name: "Draw" });
    const skip = screen.getByRole("button", { name: "Skip" });
    const right = screen.getByRole("button", {
      name: "Portal 2 choose right",
    });

    expect(left.compareDocumentPosition(draw)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(draw.compareDocumentPosition(skip)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(skip.compareDocumentPosition(right)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("invalidates cached recommendations after a completed comparison", async () => {
    const fetcher = authenticatedFetcher((url) =>
      url.pathname.endsWith("/comparisons/next")
        ? json(comparison)
        : json(result("DRAW")),
    );
    const { queryClient } = renderCompare(fetcher);
    queryClient.setQueryData(recommendationQueryKey, {
      status: "OK",
      recommendations: [],
    });

    await userEvent.click(await screen.findByRole("button", { name: "Draw" }));

    await waitFor(() =>
      expect(
        queryClient.getQueryState(recommendationQueryKey)?.isInvalidated,
      ).toBe(true),
    );
  });

  it("excludes a displayed game, retires the pair as SKIP, and invalidates dependent data", async () => {
    let allocationCount = 0;
    const requests: Array<{ path: string; body: string }> = [];
    const fetcher = authenticatedFetcher((url, init) => {
      if (url.pathname.endsWith("/comparisons/next")) {
        allocationCount += 1;
        return json(allocationCount === 1 ? comparison : nextComparison);
      }
      requests.push({ path: url.pathname, body: String(init?.body) });
      return url.pathname.endsWith("/eligibility")
        ? json(excludedPortal)
        : json(result("SKIP"));
    });
    const { queryClient } = renderCompare(fetcher);
    const libraryKey = ["steam-library"] as const;
    const personalRankingKey = ["leaderboard", "personal", false] as const;
    queryClient.setQueryData(libraryKey, { pages: [] });
    queryClient.setQueryData(personalRankingKey, { pages: [] });
    queryClient.setQueryData(recommendationQueryKey, {
      status: "OK",
      recommendations: [],
    });

    await userEvent.click(
      await screen.findByRole("button", {
        name: "Exclude Portal from comparisons",
      }),
    );

    await waitFor(() =>
      expect(requests).toEqual([
        {
          path: "/api/v1/me/library/400/eligibility",
          body: JSON.stringify({ behavior: "EXCLUDED" }),
        },
        {
          path: `/api/v1/comparisons/${comparison.comparisonId}/result`,
          body: JSON.stringify({ outcome: "SKIP" }),
        },
      ]),
    );
    expect(
      await screen.findByText(/excluded portal.*no rating change/i),
    ).toHaveAttribute("role", "status");
    expect(queryClient.getQueryState(libraryKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(personalRankingKey)?.isInvalidated).toBe(
      true,
    );
    expect(
      queryClient.getQueryState(recommendationQueryKey)?.isInvalidated,
    ).toBe(true);
    expect(
      await screen.findByRole("button", {
        name: /counter-strike 2 choose left/i,
      }),
    ).toBeEnabled();
  });

  it("keeps the pair interactive after a rejected exclusion and retries the same update", async () => {
    const eligibilityBodies: string[] = [];
    const fetcher = authenticatedFetcher((url, init) => {
      if (url.pathname.endsWith("/comparisons/next")) return json(comparison);
      if (url.pathname.endsWith("/eligibility")) {
        eligibilityBodies.push(String(init?.body));
        return eligibilityBodies.length === 1
          ? json(
              {
                type: "https://api.example.test/problems/eligibility-rejected",
                title: "Eligibility rejected",
                status: 400,
                detail: "The game could not be excluded.",
              },
              400,
              "application/problem+json",
            )
          : json(excludedPortal);
      }
      return json(result("SKIP"));
    });
    renderCompare(fetcher);

    await userEvent.click(
      await screen.findByRole("button", {
        name: "Exclude Portal from comparisons",
      }),
    );

    expect(
      await screen.findByRole("heading", { name: "Eligibility rejected" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /portal choose left/i }),
    ).toBeEnabled();
    await userEvent.click(
      screen.getByRole("button", { name: "Retry excluding Portal" }),
    );
    expect(eligibilityBodies).toEqual([
      JSON.stringify({ behavior: "EXCLUDED" }),
      JSON.stringify({ behavior: "EXCLUDED" }),
    ]);
    expect(
      await screen.findByText(/excluded portal.*no rating change/i),
    ).toBeVisible();
  });

  it("locks the pair and retries only the identical uncertain exclusion", async () => {
    const requests: Array<{ path: string; body: string }> = [];
    let eligibilityAttempts = 0;
    const fetcher = authenticatedFetcher((url, init) => {
      if (url.pathname.endsWith("/comparisons/next")) return json(comparison);
      requests.push({ path: url.pathname, body: String(init?.body) });
      if (url.pathname.endsWith("/eligibility")) {
        eligibilityAttempts += 1;
        if (eligibilityAttempts === 1) throw new TypeError("connection ended");
        return json(excludedPortal);
      }
      return json(result("SKIP"));
    });
    renderCompare(fetcher);

    await userEvent.click(
      await screen.findByRole("button", {
        name: "Exclude Portal from comparisons",
      }),
    );

    expect(
      await screen.findByRole("button", { name: "Retry excluding Portal" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /portal choose left/i }),
    ).toBeDisabled();
    expect(requests).toHaveLength(1);
    await userEvent.click(
      screen.getByRole("button", { name: "Retry excluding Portal" }),
    );
    expect(requests.slice(0, 2)).toEqual([requests[0], requests[0]]);
    expect(requests[2]).toEqual({
      path: `/api/v1/comparisons/${comparison.comparisonId}/result`,
      body: JSON.stringify({ outcome: "SKIP" }),
    });
  });

  it("retries only the identical SKIP when retirement is uncertain", async () => {
    let eligibilityUpdates = 0;
    const retirementBodies: string[] = [];
    const fetcher = authenticatedFetcher((url, init) => {
      if (url.pathname.endsWith("/comparisons/next")) return json(comparison);
      if (url.pathname.endsWith("/eligibility")) {
        eligibilityUpdates += 1;
        return json(excludedPortal);
      }
      retirementBodies.push(String(init?.body));
      if (retirementBodies.length === 1)
        throw new TypeError("connection ended");
      return json(result("SKIP"));
    });
    renderCompare(fetcher);
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Exclude Portal from comparisons",
      }),
    );

    await userEvent.click(
      await screen.findByRole("button", {
        name: "Retry finishing exclusion for Portal",
      }),
    );

    expect(eligibilityUpdates).toBe(1);
    expect(retirementBodies).toEqual([
      JSON.stringify({ outcome: "SKIP" }),
      JSON.stringify({ outcome: "SKIP" }),
    ]);
  });

  it("loads the current pair when confirmed exclusion makes the old pair stale", async () => {
    let allocationCount = 0;
    let eligibilityUpdates = 0;
    const fetcher = authenticatedFetcher((url) => {
      if (url.pathname.endsWith("/comparisons/next")) {
        allocationCount += 1;
        return json(allocationCount === 1 ? comparison : nextComparison);
      }
      if (url.pathname.endsWith("/eligibility")) {
        eligibilityUpdates += 1;
        return json(excludedPortal);
      }
      return json(
        {
          type: "https://api.example.test/problems/comparison-missing",
          title: "Comparison missing",
          status: 404,
          detail: "The active comparison was retired.",
        },
        404,
        "application/problem+json",
      );
    });
    renderCompare(fetcher);
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Exclude Portal from comparisons",
      }),
    );

    expect(
      await screen.findByRole("button", {
        name: /counter-strike 2 choose left/i,
      }),
    ).toBeEnabled();
    expect(eligibilityUpdates).toBe(1);
    expect(allocationCount).toBe(2);
  });

  it("locks every outcome on rapid left activation and advances once", async () => {
    let allocationCount = 0;
    let resolveSubmission!: (response: Response) => void;
    const submission = new Promise<Response>((resolve) => {
      resolveSubmission = resolve;
    });
    const requests: Array<{ path: string; body?: string | null }> = [];
    const fetcher = authenticatedFetcher((url, init) => {
      if (url.pathname.endsWith("/comparisons/next")) {
        allocationCount += 1;
        return json(allocationCount === 1 ? comparison : nextComparison);
      }
      requests.push({ path: url.pathname, body: init?.body?.toString() });
      return submission;
    });
    renderCompare(fetcher);

    const left = await screen.findByRole("button", {
      name: /portal choose left/i,
    });
    act(() => {
      left.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      left.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(requests).toEqual([
        {
          path: `/api/v1/comparisons/${comparison.comparisonId}/result`,
          body: JSON.stringify({ outcome: "LEFT_WIN" }),
        },
      ]),
    );
    expect(
      screen.getByRole("button", { name: /portal choose left/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /portal 2 choose right/i }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: /draw/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /skip/i })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /exclude portal from comparisons/i }),
    ).toBeDisabled();

    resolveSubmission(json(result("LEFT_WIN")));
    expect(await screen.findByText(/recorded left game/i)).toBeVisible();
    expect(
      await screen.findByRole("button", {
        name: /counter-strike 2 choose left/i,
      }),
    ).toBeEnabled();
    expect(allocationCount).toBe(2);
  });

  it("keeps the previous stage in place while the next pair is loading", async () => {
    let allocationCount = 0;
    let resolveNext!: (response: Response) => void;
    const nextAllocation = new Promise<Response>((resolve) => {
      resolveNext = resolve;
    });
    const fetcher = authenticatedFetcher((url) => {
      if (url.pathname.endsWith("/comparisons/next")) {
        allocationCount += 1;
        return allocationCount === 1 ? json(comparison) : nextAllocation;
      }
      return json(result("LEFT_WIN"));
    });
    renderCompare(fetcher);

    await userEvent.click(
      await screen.findByRole("button", { name: /portal choose left/i }),
    );
    expect(
      await screen.findByText(/finding your current comparison/i),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /portal choose left/i }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Draw" })).toBeDisabled();

    resolveNext(json(nextComparison));
    expect(
      await screen.findByRole("button", {
        name: /counter-strike 2 choose left/i,
      }),
    ).toBeEnabled();
  });

  it("keeps identifiers and detailed shortcut help behind accessible disclosures", async () => {
    const fetcher = authenticatedFetcher(() => json(comparison));
    renderCompare(fetcher);
    await screen.findByRole("button", { name: /portal choose left/i });

    expect(screen.getByText(/choices are final/i)).toBeVisible();
    const comparisonDetails = screen.getByText("Comparison details");
    expect(screen.getByText(comparison.comparisonId)).not.toBeVisible();
    await userEvent.click(comparisonDetails);
    expect(screen.getByText(comparison.comparisonId)).toBeVisible();

    const shortcutDetails = screen.getByText("Keyboard shortcuts");
    expect(screen.getByText(/press a for the left game/i)).not.toBeVisible();
    await userEvent.click(shortcutDetails);
    expect(
      screen.getByText(
        /press a for the left game, d for the right game, w for draw, or s to skip/i,
      ),
    ).toBeVisible();
    expect(
      within(
        screen.getByRole("button", { name: /portal choose left/i }),
      ).getByText("A"),
    ).toBeVisible();
    expect(
      within(
        screen.getByRole("button", { name: /portal 2 choose right/i }),
      ).getByText("D"),
    ).toBeVisible();
    expect(
      within(screen.getByRole("button", { name: "Draw" })).getByText("W"),
    ).toBeVisible();
    expect(
      within(screen.getByRole("button", { name: "Skip" })).getByText("S"),
    ).toBeVisible();
  });

  it.each([
    ["a", "LEFT_WIN", /recorded left game/i],
    ["D", "RIGHT_WIN", /recorded right game/i],
    ["w", "DRAW", /recorded draw/i],
    ["S", "SKIP", /no rating change is claimed/i],
  ] as const)(
    "maps the %s shortcut to %s",
    async (key, outcome, announcement) => {
      const bodies: string[] = [];
      const fetcher = authenticatedFetcher((url, init) => {
        if (url.pathname.endsWith("/comparisons/next")) return json(comparison);
        bodies.push(String(init?.body));
        return json(result(outcome));
      });
      renderCompare(fetcher);
      await screen.findByRole("button", { name: /portal 2 choose right/i });

      fireEvent.keyDown(window, { key });

      await waitFor(() =>
        expect(bodies).toEqual([JSON.stringify({ outcome })]),
      );
      expect(await screen.findByText(announcement)).toHaveAttribute(
        "role",
        "status",
      );
    },
  );

  it.each([
    ["Draw", "DRAW", /recorded draw/i],
    ["Skip", "SKIP", /no rating change is claimed/i],
  ] as const)(
    "submits %s exactly once",
    async (label, outcome, announcement) => {
      const bodies: string[] = [];
      const fetcher = authenticatedFetcher((url, init) => {
        if (url.pathname.endsWith("/comparisons/next")) return json(comparison);
        bodies.push(String(init?.body));
        return json(result(outcome));
      });
      renderCompare(fetcher);

      await userEvent.click(await screen.findByRole("button", { name: label }));

      expect(bodies).toEqual([JSON.stringify({ outcome })]);
      expect(await screen.findByText(announcement)).toBeVisible();
    },
  );

  it("retries an uncertain request with the identical ID and outcome", async () => {
    const requests: Array<{ path: string; body: string }> = [];
    let submissionCount = 0;
    const fetcher = authenticatedFetcher((url, init) => {
      if (url.pathname.endsWith("/comparisons/next")) return json(comparison);
      requests.push({ path: url.pathname, body: String(init?.body) });
      submissionCount += 1;
      if (submissionCount === 1) throw new TypeError("connection ended");
      return json(result("DRAW"));
    });
    renderCompare(fetcher);
    await userEvent.click(await screen.findByRole("button", { name: "Draw" }));

    const retry = await screen.findByRole("button", { name: "Retry draw" });
    expect(
      screen.getByRole("button", { name: /portal choose left/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /portal 2 choose right/i }),
    ).toBeDisabled();
    await userEvent.click(retry);

    expect(requests).toHaveLength(2);
    expect(requests[1]).toEqual(requests[0]);
    expect(await screen.findByText(/recorded draw/i)).toBeVisible();
  });

  it("discards an expired pair and retrieves fresh server state", async () => {
    let allocationCount = 0;
    const fetcher = authenticatedFetcher((url) => {
      if (url.pathname.endsWith("/comparisons/next")) {
        allocationCount += 1;
        return json(allocationCount === 1 ? comparison : nextComparison);
      }
      return json(
        {
          type: "https://api.example.test/problems/comparison-expired",
          title: "Comparison expired",
          status: 409,
          detail: "The comparison submission window has ended.",
          requestId: "request-expired",
        },
        409,
        "application/problem+json",
      );
    });
    renderCompare(fetcher);
    await userEvent.click(
      await screen.findByRole("button", { name: /portal choose left/i }),
    );

    expect(
      await screen.findByRole("heading", { name: /no longer interactive/i }),
    ).toBeVisible();
    expect(screen.queryByText("Portal 2")).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Get current comparison" }),
    );
    expect(
      await screen.findByRole("button", {
        name: /counter-strike 2 choose left/i,
      }),
    ).toBeEnabled();
  });

  it.each([
    [
      "https://api.example.test/problems/library-synchronization-unavailable",
      409,
      /library is not ready/i,
      true,
    ],
    [
      "https://api.example.test/problems/insufficient-eligible-games",
      409,
      /more eligible games/i,
      true,
    ],
    [
      "https://api.example.test/problems/comparison-rate-limited",
      429,
      /temporarily rate limited/i,
      false,
    ],
    [
      "https://api.example.test/problems/no-comparison-available",
      409,
      /no comparison to show/i,
      false,
    ],
  ] as const)(
    "renders non-interactive recovery for %s",
    async (type, status, heading, linksLibrary) => {
      const fetcher = authenticatedFetcher(() =>
        json(
          {
            type,
            title: "Comparison unavailable",
            status,
            detail: "Safe API explanation.",
            requestId: "request-allocation",
          },
          status,
          "application/problem+json",
        ),
      );
      renderCompare(fetcher);

      expect(
        await screen.findByRole("heading", { name: heading }),
      ).toBeVisible();
      expect(
        screen.queryByRole("button", { name: /choose left/i }),
      ).not.toBeInTheDocument();
      if (linksLibrary) {
        expect(
          screen.getByRole("link", { name: "Open Library" }),
        ).toHaveAttribute("href", "/library");
      } else {
        expect(
          screen.queryByRole("link", { name: "Open Library" }),
        ).not.toBeInTheDocument();
      }
    },
  );

  it("does not let a shortcut steal focus from another control", async () => {
    let submissions = 0;
    const fetcher = authenticatedFetcher((url) => {
      if (url.pathname.endsWith("/comparisons/next")) return json(comparison);
      submissions += 1;
      return json(result("LEFT_WIN"));
    });
    renderCompare(fetcher);
    const draw = await screen.findByRole("button", { name: "Draw" });
    draw.focus();

    fireEvent.keyDown(draw, { key: "a" });

    expect(submissions).toBe(0);
    expect(draw).toHaveFocus();
  });

  it("conveys local expiry while leaving the server authoritative", async () => {
    const expired = { ...comparison, expiresAt: "2020-01-01T00:00:00Z" };
    const fetcher = authenticatedFetcher(() => json(expired));
    renderCompare(fetcher);

    expect(
      (await screen.findAllByText(/submission window passed/i))[0],
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /portal choose left/i }),
    ).toBeEnabled();
  });

  it("is accessible at the minimum viewport and preserves artwork fallback", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 360,
    });
    const fetcher = authenticatedFetcher(() => json(comparison));
    const rendered = renderCompare(fetcher);
    const artwork = await screen.findByRole("img", { name: "Portal artwork" });
    fireEvent.error(artwork);

    expect(
      screen.getByRole("img", { name: "Portal artwork unavailable" }),
    ).toBeVisible();
    await waitFor(async () =>
      expect(await axe(rendered.container)).toHaveNoViolations(),
    );
  });
});

describe("allocation problem classification", () => {
  it("uses stable Problem Details types rather than exception text", () => {
    expect(
      classifyAllocationProblem(
        new ApiProblem(
          409,
          "Anything",
          "Anything",
          undefined,
          "https://api.example.test/problems/insufficient-eligible-games",
        ),
      ),
    ).toBe("eligibility");
  });
});
