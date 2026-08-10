import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionManager } from "../../api/client";
import { ApiProblem } from "../../api/problem";
import { AuthProvider } from "../../auth/AuthContext";
import type { RuntimeConfig } from "../../config";
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
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider session={session}>
        <MemoryRouter>
          <ComparePage />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
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

    resolveSubmission(json(result("LEFT_WIN")));
    expect(await screen.findByText(/recorded left game/i)).toBeVisible();
    expect(
      await screen.findByRole("button", {
        name: /counter-strike 2 choose left/i,
      }),
    ).toBeEnabled();
    expect(allocationCount).toBe(2);
  });

  it("submits the right orientation by documented keyboard shortcut", async () => {
    const bodies: string[] = [];
    const fetcher = authenticatedFetcher((url, init) => {
      if (url.pathname.endsWith("/comparisons/next")) return json(comparison);
      bodies.push(String(init?.body));
      return json(result("RIGHT_WIN"));
    });
    renderCompare(fetcher);
    await screen.findByRole("button", { name: /portal 2 choose right/i });

    fireEvent.keyDown(window, { key: "r" });

    await waitFor(() =>
      expect(bodies).toEqual([JSON.stringify({ outcome: "RIGHT_WIN" })]),
    );
    expect(await screen.findByText(/recorded right game/i)).toHaveAttribute(
      "role",
      "status",
    );
  });

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

    fireEvent.keyDown(draw, { key: "l" });

    expect(submissions).toBe(0);
    expect(draw).toHaveFocus();
  });

  it("conveys local expiry while leaving the server authoritative", async () => {
    const expired = { ...comparison, expiresAt: "2020-01-01T00:00:00Z" };
    const fetcher = authenticatedFetcher(() => json(expired));
    renderCompare(fetcher);

    expect(await screen.findByText(/submission window passed/i)).toBeVisible();
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
