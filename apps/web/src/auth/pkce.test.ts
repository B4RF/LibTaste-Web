import { webcrypto } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { RuntimeConfig } from "../config";
import {
  buildAuthorizationUrl,
  clearAuthTransaction,
  consumeAuthTransaction,
  createChallenge,
  createVerifier,
} from "./pkce";

const config: RuntimeConfig = {
  apiBaseUrl: "https://api.example.test/api/v1",
  webClientId: "browser-client",
};

beforeAll(() => {
  vi.stubGlobal("crypto", webcrypto);
});

describe("Steam PKCE authorization", () => {
  it("creates an S256 request with an exact callback and safe destination", async () => {
    const url = new URL(
      await buildAuthorizationUrl(config, "/library?from=landing"),
    );
    expect(url.origin + url.pathname).toBe(
      "https://api.example.test/api/v1/auth/steam/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("browser-client");
    expect(url.searchParams.get("return_uri")).toBe(
      `${window.location.origin}/auth/callback`,
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toMatch(
      /^[A-Za-z0-9_-]{43}$/,
    );

    const transaction = consumeAuthTransaction();
    expect(transaction?.destination).toBe("/library?from=landing");
    expect(transaction?.verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(sessionStorage.length).toBe(0);
  });

  it("uses cryptographic random input and the SHA-256 challenge", async () => {
    const cryptoProvider = webcrypto as unknown as Crypto;
    const verifier = createVerifier(cryptoProvider);
    expect(verifier).toHaveLength(86);
    expect(await createChallenge(verifier, cryptoProvider)).toMatch(
      /^[A-Za-z0-9_-]{43}$/,
    );
  });

  it("never restores an external destination", async () => {
    await buildAuthorizationUrl(config, "https://evil.example/phish");
    expect(consumeAuthTransaction()?.destination).toBe("/compare");
  });

  it("rejects expired, future, malformed, and cleared transactions", () => {
    sessionStorage.setItem(
      "libtaste.auth.transaction",
      JSON.stringify({
        verifier: "v".repeat(64),
        destination: "/settings",
        createdAt: 1,
      }),
    );
    expect(consumeAuthTransaction(1_000_000)).toBeNull();

    sessionStorage.setItem(
      "libtaste.auth.transaction",
      JSON.stringify({
        verifier: "v".repeat(64),
        destination: "/settings",
        createdAt: 200,
      }),
    );
    expect(consumeAuthTransaction(100)).toBeNull();

    sessionStorage.setItem("libtaste.auth.transaction", "{bad json");
    expect(consumeAuthTransaction()).toBeNull();
    clearAuthTransaction();
    expect(consumeAuthTransaction()).toBeNull();
  });
});
