import { axe } from "jest-axe";
import { QueryClient } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { SessionManager } from "../../api/client";
import type { components } from "../../api/generated";
import { ApplicationProviders, ApplicationRoutes } from "../../app/App";
import type { RuntimeConfig } from "../../config";
import { recommendationQueryKey } from "../recommendations/recommendationApi";

type MeProfile = components["schemas"]["MeProfile"];
type LibraryItem = components["schemas"]["LibraryItem"];
type LibrarySyncJob = components["schemas"]["LibrarySyncJob"];

const config: RuntimeConfig = {
  apiBaseUrl: "https://api.example.test/api/v1",
  webClientId: "web-client",
  environmentLabel: "Test",
};

const profile: MeProfile = {
  steamId64: "76561198000000000",
  displayName: "Test Pilot",
  avatarUrl: "https://cdn.example.test/avatar.jpg",
  profileUrl: "https://steamcommunity.com/id/test-pilot",
  libraryState: "AVAILABLE",
  lastProfileSyncAt: "2026-08-10T07:00:00Z",
  lastLibrarySyncAt: "2026-08-10T07:05:00Z",
  synchronization: null,
};

const portal: LibraryItem = {
  appId: 400,
  name: "Portal",
  artworkUrl: "https://cdn.example.test/portal.jpg",
  playtimeMinutes: 125,
  currentlyOwned: true,
  eligibilityOverride: "DEFAULT",
  effectivelyEligible: true,
  firstImportedAt: "2026-08-01T10:00:00Z",
  lastImportedAt: "2026-08-10T07:05:00Z",
};

function json(body: unknown, status = 200, contentType = "application/json") {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": contentType },
  });
}

function authenticatedFetcher(
  handler: (url: URL, init?: RequestInit) => Promise<Response> | Response,
) {
  return vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url,
    );
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

function renderLibrary(fetcher: typeof fetch) {
  document.cookie = "libtaste_csrf=test; path=/";
  const session = new SessionManager(config, { fetcher });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const rendered = render(
    <ApplicationProviders
      config={config}
      session={session}
      queryClient={queryClient}
    >
      <MemoryRouter initialEntries={["/library"]}>
        <ApplicationRoutes config={config} />
      </MemoryRouter>
    </ApplicationProviders>,
  );
  return { ...rendered, queryClient };
}

describe("Steam library", () => {
  it("invalidates recommendations after a library eligibility change", async () => {
    const fetcher = authenticatedFetcher((url, init) => {
      if (url.pathname.endsWith("/me")) return json(profile);
      if (url.pathname.endsWith("/me/library"))
        return json({ items: [portal] });
      if (url.pathname.endsWith("/eligibility") && init?.method === "PUT") {
        return json({
          ...portal,
          eligibilityOverride: "EXCLUDED",
          effectivelyEligible: false,
        });
      }
      throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${url}`);
    });
    const { queryClient } = renderLibrary(fetcher);
    queryClient.setQueryData(recommendationQueryKey, {
      status: "OK",
      recommendations: [],
    });

    await userEvent.selectOptions(
      await screen.findByRole("combobox", {
        name: /eligibility behavior for portal/i,
      }),
      "EXCLUDED",
    );

    await waitFor(() =>
      expect(
        queryClient.getQueryState(recommendationQueryKey)?.isInvalidated,
      ).toBe(true),
    );
  });

  it("keeps a private-library user signed in and reuses one accepted sync job", async () => {
    const activeJob: LibrarySyncJob = {
      jobId: "11111111-1111-4111-8111-111111111111",
      trigger: "MANUAL",
      status: "PENDING",
      attemptCount: 0,
      requestedAt: "2026-08-10T08:00:00Z",
      runAfter: "2026-08-10T08:00:00Z",
    };
    let resolveSync: ((response: Response) => void) | undefined;
    const fetcher = authenticatedFetcher((url, init) => {
      if (url.pathname.endsWith("/me")) {
        return json({ ...profile, libraryState: "UNAVAILABLE" });
      }
      if (
        url.pathname.endsWith("/me/library-sync") &&
        init?.method === "POST"
      ) {
        return new Promise<Response>((resolve) => {
          resolveSync = resolve;
        });
      }
      throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${url}`);
    });
    renderLibrary(fetcher);

    expect(
      await screen.findByRole("heading", {
        name: /steam game details are private/i,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /steam privacy guidance/i }),
    ).toHaveAttribute(
      "href",
      "https://help.steampowered.com/en/faqs/view/588C-C67D-0251-C276",
    );
    const retry = screen.getByRole("button", { name: /synchronize library/i });
    await userEvent.click(retry);
    expect(retry).toBeDisabled();
    fireEvent.click(retry);
    expect(
      fetcher.mock.calls.filter(([input]) =>
        String(input).endsWith("/me/library-sync"),
      ),
    ).toHaveLength(1);
    resolveSync?.(json(activeJob, 202));
    expect(await screen.findByText(/synchronization pending/i)).toBeVisible();
  });

  it("keeps content usable when synchronization is throttled", async () => {
    const fetcher = authenticatedFetcher((url, init) => {
      if (url.pathname.endsWith("/me")) return json(profile);
      if (url.pathname.endsWith("/me/library") && !url.search) {
        return json({ items: [portal] });
      }
      if (
        url.pathname.endsWith("/me/library-sync") &&
        init?.method === "POST"
      ) {
        return json(
          {
            title: "Too many requests",
            detail: "Try again after the synchronization cooldown.",
            status: 429,
            requestId: "req-cooldown",
          },
          429,
          "application/problem+json",
        );
      }
      throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${url}`);
    });
    renderLibrary(fetcher);
    expect(
      await screen.findByRole("heading", { name: "Portal" }),
    ).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: /synchronize library/i }),
    );
    expect(await screen.findByText(/once per hour/i)).toBeVisible();
    expect(screen.getByText("Portal")).toBeVisible();
    await userEvent.click(screen.getByText("Support details"));
    expect(screen.getByText("req-cooldown")).toBeVisible();
  });

  it("appends each opaque cursor page once in server order and marks history", async () => {
    const historical = {
      ...portal,
      appId: 401,
      name: "Half-Life",
      currentlyOwned: false,
      effectivelyEligible: false,
    } satisfies LibraryItem;
    const hades = {
      ...portal,
      appId: 402,
      name: "Hades",
    } satisfies LibraryItem;
    const fetcher = authenticatedFetcher((url) => {
      if (url.pathname.endsWith("/me")) return json(profile);
      if (
        url.pathname.endsWith("/me/library") &&
        !url.searchParams.has("cursor")
      ) {
        return json({ items: [portal, historical], nextCursor: "opaque+/=" });
      }
      if (url.searchParams.get("cursor") === "opaque+/=") {
        return json({ items: [portal, hades], nextCursor: null });
      }
      throw new Error(`Unexpected request: GET ${url}`);
    });
    renderLibrary(fetcher);
    expect(
      await screen.findByRole("heading", { name: "Portal" }),
    ).toBeVisible();
    expect(screen.getByText(/historical ownership/i)).toBeVisible();
    expect(
      within(screen.getByRole("article", { name: "Half-Life" })).queryByRole(
        "combobox",
      ),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /load more/i }));
    expect(await screen.findByRole("heading", { name: "Hades" })).toBeVisible();
    expect(screen.getAllByRole("heading", { name: "Portal" })).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: /load more/i }),
    ).not.toBeInTheDocument();
    const names = screen
      .getAllByRole("article")
      .map((card) => within(card).getByRole("heading").textContent);
    expect(names).toEqual(["Portal", "Half-Life", "Hades"]);
  });

  it("shows only the server-confirmed eligibility and preserves it after rejection", async () => {
    let eligibilityAttempts = 0;
    let resolveEligibility: ((response: Response) => void) | undefined;
    const fetcher = authenticatedFetcher((url, init) => {
      if (url.pathname.endsWith("/me")) return json(profile);
      if (url.pathname.endsWith("/me/library"))
        return json({ items: [portal] });
      if (url.pathname.endsWith("/me/library/400/eligibility")) {
        eligibilityAttempts += 1;
        if (eligibilityAttempts === 1) {
          return json(
            { title: "Update rejected", detail: "Please retry.", status: 503 },
            503,
            "application/problem+json",
          );
        }
        expect(JSON.parse(String(init?.body))).toEqual({
          behavior: "EXCLUDED",
        });
        return new Promise<Response>((resolve) => {
          resolveEligibility = resolve;
        });
      }
      throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${url}`);
    });
    renderLibrary(fetcher);
    const control = await screen.findByRole("combobox", {
      name: /eligibility behavior for portal/i,
    });
    expect(control).toHaveValue("DEFAULT");
    await userEvent.selectOptions(control, "EXCLUDED");
    expect(
      await screen.findByRole("button", { name: /retry excluding portal/i }),
    ).toBeVisible();
    expect(control).toHaveValue("DEFAULT");
    await userEvent.click(
      screen.getByRole("button", { name: /retry excluding portal/i }),
    );
    expect(control).toBeDisabled();
    resolveEligibility?.(
      json({
        ...portal,
        eligibilityOverride: "EXCLUDED",
        effectivelyEligible: false,
      }),
    );
    await waitFor(() => expect(control).toHaveValue("EXCLUDED"));
    expect(screen.getByText(/not eligible for comparisons/i)).toBeVisible();
  });

  it("renders 100 contract-shaped entries lazily with accessible controls", async () => {
    const items: LibraryItem[] = Array.from({ length: 100 }, (_, index) => ({
      ...portal,
      appId: index + 1,
      name: `Game ${index + 1}`,
      artworkUrl: `https://cdn.example.test/${index + 1}.jpg`,
    }));
    const fetcher = authenticatedFetcher((url) => {
      if (url.pathname.endsWith("/me")) return json(profile);
      if (url.pathname.endsWith("/me/library")) return json({ items });
      throw new Error(`Unexpected request: GET ${url}`);
    });
    const result = renderLibrary(fetcher);
    expect(
      await screen.findByRole("heading", { name: "Game 100" }),
    ).toBeVisible();
    expect(screen.getAllByRole("article")).toHaveLength(100);
    for (const image of screen.getAllByRole("img")) {
      expect(image).toHaveAttribute("loading", "lazy");
    }
    expect(
      screen.getByRole("combobox", {
        name: /^eligibility behavior for game 1$/i,
      }),
    ).toBeVisible();
    expect(await axe(result.container)).toHaveNoViolations();
  }, 30_000);
});
