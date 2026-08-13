import type { SessionManager } from "../../api/client";
import type { components } from "../../api/generated";

export type MeProfile = components["schemas"]["MeProfile"];
export type LibrarySyncJob = components["schemas"]["LibrarySyncJob"];
export type LibraryItem = components["schemas"]["LibraryItem"];
export type LibraryPageData = components["schemas"]["LibraryPage"];
export type EligibilityBehavior =
  components["schemas"]["EligibilityRequest"]["behavior"];
export interface LibraryFilters {
  name?: string;
  effectivelyEligible?: boolean;
  eligibilityOverride?: EligibilityBehavior;
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export async function getProfile(
  session: SessionManager,
  signal?: AbortSignal,
): Promise<MeProfile> {
  return readJson<MeProfile>(await session.request("/me", { signal }));
}

export async function getLibraryPage(
  session: SessionManager,
  filters: LibraryFilters,
  cursor?: string,
  signal?: AbortSignal,
): Promise<LibraryPageData> {
  const parameters = new URLSearchParams();
  if (cursor) parameters.set("cursor", cursor);
  if (filters.name) parameters.set("name", filters.name);
  if (filters.effectivelyEligible !== undefined) {
    parameters.set("effectivelyEligible", String(filters.effectivelyEligible));
  }
  if (filters.eligibilityOverride) {
    parameters.set("eligibilityOverride", filters.eligibilityOverride);
  }
  const query = parameters.size > 0 ? `?${parameters}` : "";
  return readJson<LibraryPageData>(
    await session.request(`/me/library${query}`, { signal }),
  );
}

export async function getSyncJob(
  session: SessionManager,
  signal?: AbortSignal,
): Promise<LibrarySyncJob> {
  return readJson<LibrarySyncJob>(
    await session.request("/me/library-sync", { signal }),
  );
}

export async function requestSync(
  session: SessionManager,
): Promise<LibrarySyncJob> {
  return readJson<LibrarySyncJob>(
    await session.request("/me/library-sync", { method: "POST" }),
  );
}

export async function updateEligibility(
  session: SessionManager,
  appId: number,
  behavior: EligibilityBehavior,
): Promise<LibraryItem> {
  return readJson<LibraryItem>(
    await session.request(`/me/library/${appId}/eligibility`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ behavior }),
    }),
  );
}
