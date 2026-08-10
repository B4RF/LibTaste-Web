import type { SessionManager } from "../../api/client";
import type { components } from "../../api/generated";

export type MeProfile = components["schemas"]["MeProfile"];
export type LibrarySyncJob = components["schemas"]["LibrarySyncJob"];
export type LibraryItem = components["schemas"]["LibraryItem"];
export type LibraryPageData = components["schemas"]["LibraryPage"];
export type EligibilityBehavior =
  components["schemas"]["EligibilityRequest"]["behavior"];

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
  cursor?: string,
  signal?: AbortSignal,
): Promise<LibraryPageData> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
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
