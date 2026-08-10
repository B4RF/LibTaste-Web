import { useQueryClient } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useReducer } from "react";
import { describe, expect, it, vi } from "vitest";
import { SessionManager } from "../api/client";
import type { RuntimeConfig } from "../config";
import { ApplicationProviders } from "../app/App";
import { useAuth } from "./AuthContext";

const config: RuntimeConfig = {
  apiBaseUrl: "https://api.example.test/api/v1",
  webClientId: "web-client",
};

function CleanupProbe({
  onAbort,
  onReady,
}: {
  onAbort: () => void;
  onReady: () => void;
}) {
  const { restore, session, status } = useAuth();
  const queryClient = useQueryClient();
  const [, rerender] = useReducer((revision: number) => revision + 1, 0);

  useEffect(
    () => queryClient.getQueryCache().subscribe(() => rerender()),
    [queryClient],
  );

  useEffect(() => {
    if (status === "unknown") void restore();
  }, [restore, status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    queryClient.setQueryDefaults(["global-leaderboard"], {
      meta: { scope: "public" },
    });
    queryClient.setQueryData(["global-leaderboard"], "public-data");
    void queryClient
      .fetchQuery({
        queryKey: ["protected-poll"],
        meta: { scope: "user" },
        queryFn: ({ signal }) =>
          new Promise<never>((_, reject) => {
            signal.addEventListener("abort", () => {
              onAbort();
              reject(new DOMException("Cancelled", "AbortError"));
            });
          }),
      })
      .catch(() => undefined);
    onReady();
  }, [onAbort, onReady, queryClient, status]);

  return (
    <>
      <p>{status}</p>
      <button type="button" onClick={() => session.clear()}>
        Clear session
      </button>
      <output data-testid="public-cache">
        {String(queryClient.getQueryData(["global-leaderboard"]) ?? "")}
      </output>
      <output data-testid="user-cache">
        {String(queryClient.getQueryState(["protected-poll"])?.status ?? "")}
      </output>
    </>
  );
}

describe("AuthProvider cleanup", () => {
  it("cancels protected work, removes user caches and PKCE, and retains public data", async () => {
    document.cookie = "libtaste_csrf=cleanup; path=/";
    sessionStorage.setItem("libtaste.auth.transaction", "transient");
    const onAbort = vi.fn();
    const onReady = vi.fn();
    const session = new SessionManager(config, {
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: "access",
            token_type: "Bearer",
            expires_in: 900,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    });
    render(
      <ApplicationProviders config={config} session={session}>
        <CleanupProbe onAbort={onAbort} onReady={onReady} />
      </ApplicationProviders>,
    );

    await screen.findByText("authenticated");
    await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
    await userEvent.click(
      screen.getByRole("button", { name: "Clear session" }),
    );

    await screen.findByText("signed-out");
    await waitFor(() => expect(onAbort).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(screen.getByTestId("user-cache")).toBeEmptyDOMElement(),
    );
    expect(screen.getByTestId("public-cache")).toHaveTextContent("public-data");
    expect(sessionStorage.getItem("libtaste.auth.transaction")).toBeNull();
  });
});
