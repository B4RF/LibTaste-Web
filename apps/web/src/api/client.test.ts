import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeConfig } from "../config";
import { SessionManager } from "./client";
import { ApiProblem } from "./problem";

const config: RuntimeConfig = {
  apiBaseUrl: "https://api.example.test/api/v1",
  webClientId: "browser-client",
};

function token(value = "access-1") {
  return new Response(
    JSON.stringify({
      access_token: value,
      token_type: "Bearer",
      expires_in: 900,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

beforeEach(() => {
  document.cookie = "libtaste_csrf=csrf-value; path=/";
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SessionManager", () => {
  it("deduplicates concurrent cookie-backed refresh and echoes CSRF", async () => {
    let resolveResponse!: (value: Response) => void;
    const fetcher = vi.fn<typeof fetch>().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      }),
    );
    const session = new SessionManager(config, { fetcher });
    const pending = Promise.all([
      session.refresh(),
      session.refresh(),
      session.refresh(),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    resolveResponse(token());
    await expect(pending).resolves.toEqual([
      "access-1",
      "access-1",
      "access-1",
    ]);

    const request = fetcher.mock.calls[0]![1]!;
    expect(request.credentials).toBe("include");
    expect(new Headers(request.headers).get("X-CSRF-Token")).toBe("csrf-value");
    expect(request.body).toBe(
      JSON.stringify({
        grant_type: "refresh_token",
        client_id: "browser-client",
      }),
    );
  });

  it("cancels a stalled shared refresh after ten seconds and permits one bounded retry", async () => {
    vi.useFakeTimers();
    const onSessionEvent = vi.fn();
    const fetcher = vi.fn<typeof fetch>((_input, init) => {
      const signal = init?.signal;
      return new Promise<Response>((resolve, reject) => {
        signal?.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
        if (fetcher.mock.calls.length === 2) resolve(token("retried"));
      });
    });
    const session = new SessionManager(config, { fetcher, onSessionEvent });
    const stalled = Promise.all([session.refresh(), session.refresh()]);
    const rejection = expect(stalled).rejects.toMatchObject({
      name: "TimeoutError",
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    const firstSignal = fetcher.mock.calls[0]![1]?.signal;
    await vi.advanceTimersByTimeAsync(9_999);
    expect(firstSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await rejection;
    expect(firstSignal?.aborted).toBe(true);
    expect(onSessionEvent).toHaveBeenCalledWith("recovery-required");
    expect(onSessionEvent).not.toHaveBeenCalledWith("signed-out");

    await expect(session.refresh()).resolves.toBe("retried");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1]![1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("exchanges a code without persisting or sending a client secret", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(token());
    const session = new SessionManager(config, { fetcher });
    await session.exchangeCode("one-time-code", "v".repeat(64));
    const body = JSON.parse(String(fetcher.mock.calls[0]![1]?.body)) as Record<
      string,
      string
    >;
    expect(body).toEqual({
      grant_type: "authorization_code",
      client_id: "browser-client",
      code: "one-time-code",
      code_verifier: "v".repeat(64),
    });
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(localStorage.length).toBe(0);
  });

  it("refreshes once after expiry and continues a protected request with the rotated token", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(token("first"))
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(token("rotated"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    const session = new SessionManager(config, { fetcher });
    await session.refresh();
    const response = await session.request("/me");
    expect(await response.json()).toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(
      new Headers(fetcher.mock.calls[3]![1]?.headers).get("Authorization"),
    ).toBe("Bearer rotated");
  });

  it("does not rotate twice when a delayed request rejects the previous token", async () => {
    let releaseFirst!: (response: Response) => void;
    let releaseSecond!: (response: Response) => void;
    let protectedCalls = 0;
    const fetcher = vi.fn<typeof fetch>().mockImplementation((input, init) => {
      const body = typeof init?.body === "string" ? init.body : "";
      if (body.includes("authorization_code"))
        return Promise.resolve(token("old"));
      if (body.includes("refresh_token"))
        return Promise.resolve(token("rotated"));
      const authorization = new Headers(init?.headers).get("Authorization");
      if (authorization === "Bearer rotated") {
        return Promise.resolve(new Response("{}", { status: 200 }));
      }
      protectedCalls += 1;
      return new Promise<Response>((resolve) => {
        if (protectedCalls === 1) releaseFirst = resolve;
        else releaseSecond = resolve;
      });
    });
    const session = new SessionManager(config, { fetcher });
    await session.exchangeCode("code", "v".repeat(64));
    const first = session.request("/me");
    const second = session.request("/me/library");
    await vi.waitFor(() => expect(protectedCalls).toBe(2));
    releaseFirst(new Response("", { status: 401 }));
    await first;
    releaseSecond(new Response("", { status: 401 }));
    await second;

    const refreshRequests = fetcher.mock.calls.filter(([, init]) =>
      String(init?.body).includes("refresh_token"),
    );
    expect(refreshRequests).toHaveLength(1);
  });

  it("clears the session after one failed refresh and exposes only safe Problem Details", async () => {
    const onSessionEvent = vi.fn();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: "https://example.test/problems/session",
          title: "Session expired",
          status: 401,
          detail: "Sign in again.",
          requestId: "req-401",
          stack: "must never escape",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/problem+json" },
        },
      ),
    );
    const session = new SessionManager(config, { fetcher, onSessionEvent });
    await expect(
      Promise.all([session.refresh(), session.refresh()]),
    ).rejects.toMatchObject({
      title: "Session expired",
      requestId: "req-401",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(onSessionEvent).toHaveBeenCalledWith("signed-out");
  });

  it("fails locally when the readable CSRF cookie is absent", async () => {
    document.cookie = "libtaste_csrf=; Max-Age=0; path=/";
    const fetcher = vi.fn<typeof fetch>();
    const session = new SessionManager(config, { fetcher });
    await expect(session.refresh()).rejects.toBeInstanceOf(ApiProblem);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("sends a destructive request exactly once with bearer, credentials, and CSRF", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(token())
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const session = new SessionManager(config, { fetcher });

    await session.requestOnce("/me", { method: "DELETE" });

    expect(fetcher).toHaveBeenCalledTimes(2);
    const request = fetcher.mock.calls[1]![1]!;
    expect(request.method).toBe("DELETE");
    expect(request.credentials).toBe("include");
    expect(new Headers(request.headers).get("Authorization")).toBe(
      "Bearer access-1",
    );
    expect(new Headers(request.headers).get("X-CSRF-Token")).toBe("csrf-value");
  });

  it("does not replay a destructive request after an unauthorized response", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(token())
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    const session = new SessionManager(config, { fetcher });

    await expect(
      session.requestOnce("/auth/logout-all", { method: "POST" }),
    ).rejects.toMatchObject({ status: 401 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("checks the cookie-backed session after an uncertain destructive result", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(token("before-delete"))
      .mockResolvedValueOnce(token("recovered"));
    const session = new SessionManager(config, { fetcher });
    await session.refresh();

    await expect(session.recoverSession()).resolves.toBe("authenticated");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[1]![1]?.body)).toContain(
      '"grant_type":"refresh_token"',
    );
  });
});
