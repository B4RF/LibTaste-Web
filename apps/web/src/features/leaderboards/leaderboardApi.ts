import type { SessionManager } from "../../api/client";
import type { components } from "../../api/generated";

export type GlobalLeaderboardEntry =
  components["schemas"]["GlobalLeaderboardEntry"];
export type GlobalLeaderboardPageData =
  components["schemas"]["GlobalLeaderboardPage"];
export type PersonalLeaderboardEntry =
  components["schemas"]["PersonalLeaderboardEntry"];
export type PersonalLeaderboardPageData =
  components["schemas"]["PersonalLeaderboardPage"];

export const personalLeaderboardQueryKey = ["leaderboard", "personal"] as const;

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function cursorQuery(cursor?: string): string {
  if (!cursor) return "";
  return `?${new URLSearchParams({ cursor })}`;
}

export async function getGlobalLeaderboardPage(
  session: SessionManager,
  cursor?: string,
  signal?: AbortSignal,
): Promise<GlobalLeaderboardPageData> {
  return readJson<GlobalLeaderboardPageData>(
    await session.publicRequest(`/leaderboards/global${cursorQuery(cursor)}`, {
      signal,
    }),
  );
}

export async function getPersonalLeaderboardPage(
  session: SessionManager,
  includeHistorical: boolean,
  cursor?: string,
  signal?: AbortSignal,
): Promise<PersonalLeaderboardPageData> {
  const query = new URLSearchParams({
    includeHistorical: String(includeHistorical),
  });
  if (cursor) query.set("cursor", cursor);
  return readJson<PersonalLeaderboardPageData>(
    await session.request(`/me/leaderboard?${query}`, { signal }),
  );
}
