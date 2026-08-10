export interface RuntimeConfig {
  apiBaseUrl: string;
  webClientId: string;
  environmentLabel?: string;
}

export class RuntimeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeConfigError";
  }
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RuntimeConfigError(`${name} is missing or empty.`);
  }
  return value.trim();
}

export function parseRuntimeConfig(
  value: unknown,
  origin = window.location.origin,
): RuntimeConfig {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RuntimeConfigError("Runtime configuration is not an object.");
  }

  const candidate = value as Record<string, unknown>;
  const apiBaseUrlValue = requiredString(candidate.apiBaseUrl, "apiBaseUrl");
  const webClientId = requiredString(candidate.webClientId, "webClientId");
  let apiUrl: URL;

  try {
    apiUrl = new URL(apiBaseUrlValue, origin);
  } catch {
    throw new RuntimeConfigError("apiBaseUrl is not a valid URL.");
  }

  if (!["http:", "https:"].includes(apiUrl.protocol)) {
    throw new RuntimeConfigError("apiBaseUrl must use HTTP or HTTPS.");
  }
  if (apiUrl.username || apiUrl.password || apiUrl.search || apiUrl.hash) {
    throw new RuntimeConfigError(
      "apiBaseUrl must not contain credentials, a query, or a fragment.",
    );
  }
  if (new URL(origin).protocol === "https:" && apiUrl.protocol !== "https:") {
    throw new RuntimeConfigError(
      "An HTTPS application requires an HTTPS API URL.",
    );
  }

  const environmentLabel = candidate.environmentLabel;
  if (
    environmentLabel !== undefined &&
    (typeof environmentLabel !== "string" || !environmentLabel.trim())
  ) {
    throw new RuntimeConfigError(
      "environmentLabel must be a non-empty string when provided.",
    );
  }

  return {
    apiBaseUrl: apiUrl.toString().replace(/\/$/, ""),
    webClientId,
    ...(typeof environmentLabel === "string"
      ? { environmentLabel: environmentLabel.trim() }
      : {}),
  };
}

export async function loadRuntimeConfig(
  fetcher: typeof fetch = fetch,
): Promise<RuntimeConfig> {
  const response = await fetcher("/config.json", {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new RuntimeConfigError(
      `Runtime configuration could not be loaded (${response.status}).`,
    );
  }

  try {
    return parseRuntimeConfig(await response.json());
  } catch (error) {
    if (error instanceof RuntimeConfigError) throw error;
    throw new RuntimeConfigError("Runtime configuration is not valid JSON.");
  }
}
