import type { RuntimeConfig } from "../config";
import type { components } from "./generated";
import { ApiProblem, toApiProblem } from "./problem";

type TokenResponse = components["schemas"]["TokenResponse"];
type TokenRequest = components["schemas"]["TokenRequest"];

export type SessionEvent = "authenticated" | "signed-out" | "recovery-required";
export type SessionRecovery = "authenticated" | "signed-out" | "unknown";

const REFRESH_TIMEOUT_MS = 10_000;

export interface SessionManagerOptions {
  fetcher?: typeof fetch;
  now?: () => number;
  onSessionEvent?: (event: SessionEvent) => void;
}

function readCookie(name: string): string | undefined {
  const prefix = `${encodeURIComponent(name)}=`;
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
}

export class SessionManager {
  private accessToken?: string;
  private expiresAt = 0;
  private refreshPromise?: Promise<string>;
  private readonly fetcher: typeof fetch;
  private readonly now: () => number;
  private readonly listeners = new Set<(event: SessionEvent) => void>();

  constructor(
    private readonly config: RuntimeConfig,
    options: SessionManagerOptions = {},
  ) {
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
    this.now = options.now ?? Date.now;
    if (options.onSessionEvent) this.listeners.add(options.onSessionEvent);
  }

  subscribe(listener: (event: SessionEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: SessionEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private retainToken(token: TokenResponse): string {
    this.accessToken = token.access_token;
    this.expiresAt = this.now() + token.expires_in * 1000;
    this.emit("authenticated");
    return token.access_token;
  }

  private hasCurrentToken(): boolean {
    return Boolean(this.accessToken) && this.expiresAt - 30_000 > this.now();
  }

  private async requestRefreshToken(): Promise<string> {
    const csrf = readCookie("libtaste_csrf");
    if (!csrf)
      throw new ApiProblem(
        401,
        "Sign-in required",
        "No browser session is available.",
      );

    const body: TokenRequest = {
      grant_type: "refresh_token",
      client_id: this.config.webClientId,
    };
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(
      () =>
        controller.abort(
          new DOMException(
            "The session refresh deadline expired.",
            "TimeoutError",
          ),
        ),
      REFRESH_TIMEOUT_MS,
    );
    try {
      const response = await this.fetcher(
        `${this.config.apiBaseUrl}/auth/token`,
        {
          method: "POST",
          credentials: "include",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-CSRF-Token": decodeURIComponent(csrf),
          },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) throw await toApiProblem(response);
      return this.retainToken((await response.json()) as TokenResponse);
    } finally {
      globalThis.clearTimeout(timeout);
    }
  }

  clear(): void {
    this.accessToken = undefined;
    this.expiresAt = 0;
    this.emit("signed-out");
  }

  async exchangeCode(code: string, verifier: string): Promise<void> {
    const body: TokenRequest = {
      grant_type: "authorization_code",
      client_id: this.config.webClientId,
      code,
      code_verifier: verifier,
    };
    const response = await this.fetcher(
      `${this.config.apiBaseUrl}/auth/token`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) throw await toApiProblem(response);
    this.retainToken((await response.json()) as TokenResponse);
  }

  async refresh(): Promise<string> {
    if (this.hasCurrentToken()) return this.accessToken!;
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = this.requestRefreshToken()
      .catch((error: unknown) => {
        if (error instanceof ApiProblem && error.status === 401) this.clear();
        else this.emit("recovery-required");
        throw error;
      })
      .finally(() => {
        this.refreshPromise = undefined;
      });

    return this.refreshPromise;
  }

  async recoverSession(): Promise<SessionRecovery> {
    this.accessToken = undefined;
    this.expiresAt = 0;
    try {
      await this.requestRefreshToken();
      return "authenticated";
    } catch (error) {
      if (error instanceof ApiProblem && error.status === 401) {
        this.clear();
        return "signed-out";
      }
      return "unknown";
    }
  }

  async publicRequest(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("Accept", headers.get("Accept") ?? "application/json");
    const response = await this.fetcher(`${this.config.apiBaseUrl}${path}`, {
      ...init,
      headers,
      credentials: "omit",
    });
    if (!response.ok) throw await toApiProblem(response);
    return response;
  }

  async request(path: string, init: RequestInit = {}): Promise<Response> {
    const send = async (token: string): Promise<Response> => {
      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${token}`);
      headers.set("Accept", headers.get("Accept") ?? "application/json");
      return this.fetcher(`${this.config.apiBaseUrl}${path}`, {
        ...init,
        headers,
        credentials: "include",
      });
    };

    let token = await this.refresh();
    let response = await send(token);
    if (response.status === 401) {
      if (this.accessToken === token) {
        this.accessToken = undefined;
        this.expiresAt = 0;
      }
      token = await this.refresh();
      response = await send(token);
    }
    if (response.status === 401) this.clear();
    if (!response.ok) throw await toApiProblem(response);
    return response;
  }

  async requestOnce(path: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.refresh();
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("Accept", headers.get("Accept") ?? "application/json");
    const method = (init.method ?? "GET").toUpperCase();
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      const csrf = readCookie("libtaste_csrf");
      if (!csrf)
        throw new ApiProblem(
          401,
          "Sign-in required",
          "No browser session is available.",
        );
      headers.set("X-CSRF-Token", decodeURIComponent(csrf));
    }
    const response = await this.fetcher(`${this.config.apiBaseUrl}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });
    if (response.status === 401) this.clear();
    if (!response.ok) throw await toApiProblem(response);
    return response;
  }
}
