import type { RuntimeConfig } from "../config";
import { safeProtectedDestination } from "./destination";

const TRANSACTION_KEY = "libtaste.auth.transaction";
const TRANSACTION_MAX_AGE_MS = 10 * 60 * 1000;

interface AuthTransaction {
  verifier: string;
  destination: string;
  createdAt: number;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export function createVerifier(cryptoProvider: Crypto = crypto): string {
  const bytes = new Uint8Array(64);
  cryptoProvider.getRandomValues(bytes);
  return base64Url(bytes);
}

export async function createChallenge(
  verifier: string,
  cryptoProvider: Crypto = crypto,
): Promise<string> {
  const digest = await cryptoProvider.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64Url(new Uint8Array(digest));
}

export async function buildAuthorizationUrl(
  config: RuntimeConfig,
  requestedDestination: string | null | undefined,
): Promise<string> {
  const verifier = createVerifier();
  const destination = safeProtectedDestination(requestedDestination);
  const transaction: AuthTransaction = {
    verifier,
    destination,
    createdAt: Date.now(),
  };
  sessionStorage.setItem(TRANSACTION_KEY, JSON.stringify(transaction));

  const url = new URL(`${config.apiBaseUrl}/auth/steam/authorize`);
  url.searchParams.set("client_id", config.webClientId);
  url.searchParams.set("return_uri", `${window.location.origin}/auth/callback`);
  url.searchParams.set("code_challenge", await createChallenge(verifier));
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export async function startAuthentication(
  config: RuntimeConfig,
  requestedDestination?: string | null,
): Promise<void> {
  const authorizationUrl = await buildAuthorizationUrl(
    config,
    requestedDestination,
  );
  window.location.assign(authorizationUrl);
}

export function consumeAuthTransaction(
  now = Date.now(),
): AuthTransaction | null {
  const serialized = sessionStorage.getItem(TRANSACTION_KEY);
  sessionStorage.removeItem(TRANSACTION_KEY);
  if (!serialized) return null;

  try {
    const value = JSON.parse(serialized) as Partial<AuthTransaction>;
    if (
      typeof value.verifier !== "string" ||
      value.verifier.length < 43 ||
      typeof value.destination !== "string" ||
      typeof value.createdAt !== "number" ||
      now - value.createdAt > TRANSACTION_MAX_AGE_MS ||
      value.createdAt > now
    ) {
      return null;
    }
    return {
      verifier: value.verifier,
      destination: safeProtectedDestination(value.destination),
      createdAt: value.createdAt,
    };
  } catch {
    return null;
  }
}

export function clearAuthTransaction(): void {
  sessionStorage.removeItem(TRANSACTION_KEY);
}
