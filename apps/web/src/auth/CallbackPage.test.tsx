import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { SessionManager } from "../api/client";
import type { RuntimeConfig } from "../config";
import { ApplicationProviders } from "../app/App";
import { CallbackPage } from "./CallbackPage";

const config: RuntimeConfig = {
  apiBaseUrl: "https://api.example.test/api/v1",
  webClientId: "web-client",
};

function setTransaction(destination = "/library") {
  sessionStorage.setItem(
    "libtaste.auth.transaction",
    JSON.stringify({
      verifier: "v".repeat(64),
      destination,
      createdAt: Date.now(),
    }),
  );
}

function renderCallback(route: string, session: SessionManager) {
  return render(
    <ApplicationProviders config={config} session={session}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route
            path="/auth/callback"
            element={<CallbackPage config={config} />}
          />
          <Route path="/library" element={<h1>Library destination</h1>} />
          <Route path="/compare" element={<h1>Compare destination</h1>} />
        </Routes>
      </MemoryRouter>
    </ApplicationProviders>,
  );
}

describe("authentication callback", () => {
  it("exchanges a single-use code and restores the protected destination", async () => {
    setTransaction("/library");
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "memory-only",
          token_type: "Bearer",
          expires_in: 900,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    renderCallback(
      "/auth/callback?code=one-time-code",
      new SessionManager(config, { fetcher }),
    );
    expect(
      await screen.findByRole("heading", { name: "Library destination" }),
    ).toBeVisible();
    expect(sessionStorage.getItem("libtaste.auth.transaction")).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("defaults a callback destination to Compare", async () => {
    setTransaction("https://external.example/steal");
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "memory-only",
          token_type: "Bearer",
          expires_in: 900,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    renderCallback(
      "/auth/callback?code=one-time-code",
      new SessionManager(config, { fetcher }),
    );
    expect(
      await screen.findByRole("heading", { name: "Compare destination" }),
    ).toBeVisible();
  });

  it("rejects a missing or reused transaction without creating a session", async () => {
    const fetcher = vi.fn<typeof fetch>();
    renderCallback(
      "/auth/callback?code=orphaned",
      new SessionManager(config, { fetcher }),
    );
    expect(
      await screen.findByRole("heading", { name: /could not be completed/i }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: /try again/i })).toBeEnabled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("shows safe Problem Details and expandable request support information", async () => {
    setTransaction();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: "https://example.test/problem",
          title: "Code expired",
          status: 400,
          detail: "Start a fresh sign-in.",
          requestId: "req-callback",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/problem+json" },
        },
      ),
    );
    renderCallback(
      "/auth/callback?code=expired",
      new SessionManager(config, { fetcher }),
    );
    expect(await screen.findByText("Start a fresh sign-in.")).toBeVisible();
    await userEvent.click(screen.getByText("Support details"));
    expect(screen.getByText(/req-callback/)).toBeVisible();
  });
});
