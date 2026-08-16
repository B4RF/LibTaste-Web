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
export type FriendLeaderboardSharing =
  components["schemas"]["FriendLeaderboardSharing"];
export type ParticipatingFriendEntry =
  components["schemas"]["ParticipatingFriendEntry"];
export type ParticipatingFriendPageData =
  components["schemas"]["ParticipatingFriendPage"];
export type FriendLeaderboardEntry =
  components["schemas"]["FriendLeaderboardEntry"];
export type FriendLeaderboardPageData =
  components["schemas"]["FriendLeaderboardPage"];

export const personalLeaderboardQueryKey = ["leaderboard", "personal"] as const;
export const friendLeaderboardSharingQueryKey = [
  "friend-leaderboard-sharing",
] as const;
export const friendLeaderboardDataQueryKey = [
  "leaderboard",
  "friends",
] as const;
export const participatingFriendsQueryKey = [
  ...friendLeaderboardDataQueryKey,
  "list",
] as const;
export const friendGameLeaderboardQueryKey = (friendId: string) =>
  [...friendLeaderboardDataQueryKey, "ranking", friendId] as const;

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
  cursor?: string,
  signal?: AbortSignal,
): Promise<PersonalLeaderboardPageData> {
  return readJson<PersonalLeaderboardPageData>(
    await session.request(`/me/leaderboard${cursorQuery(cursor)}`, { signal }),
  );
}

export async function getFriendLeaderboardSharing(
  session: SessionManager,
  signal?: AbortSignal,
): Promise<FriendLeaderboardSharing> {
  return readJson<FriendLeaderboardSharing>(
    await session.request("/me/friend-leaderboard-sharing", { signal }),
  );
}

export async function updateFriendLeaderboardSharing(
  session: SessionManager,
  enabled: boolean,
): Promise<FriendLeaderboardSharing> {
  return readJson<FriendLeaderboardSharing>(
    await session.request("/me/friend-leaderboard-sharing", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    }),
  );
}

export async function getParticipatingFriendsPage(
  session: SessionManager,
  cursor?: string,
  signal?: AbortSignal,
): Promise<ParticipatingFriendPageData> {
  return readJson<ParticipatingFriendPageData>(
    await session.request(`/me/friends${cursorQuery(cursor)}`, { signal }),
  );
}

export async function getFriendLeaderboardPage(
  session: SessionManager,
  friendId: string,
  cursor?: string,
  signal?: AbortSignal,
): Promise<FriendLeaderboardPageData> {
  return readJson<FriendLeaderboardPageData>(
    await session.request(
      `/me/friends/${encodeURIComponent(friendId)}/leaderboard${cursorQuery(cursor)}`,
      { signal },
    ),
  );
}
