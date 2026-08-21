import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiProblem } from "../../api/problem";
import { useAuth } from "../../auth/AuthContext";
import { Artwork } from "../../components/Artwork";
import { ProblemNotice } from "../../components/ProblemNotice";
import { copy } from "../../content/copy";
import { steamStoreUrl } from "../../steam";
import styles from "../../styles/App.module.css";
import {
  getGlobalLeaderboardPage,
  getFriendLeaderboardPage,
  getFriendLeaderboardSharing,
  getParticipatingFriendsPage,
  getPersonalLeaderboardPage,
  friendGameLeaderboardQueryKey,
  friendLeaderboardSharingQueryKey,
  participatingFriendsQueryKey,
  personalLeaderboardQueryKey,
  type FriendLeaderboardEntry,
  type GlobalLeaderboardEntry,
  type ParticipatingFriendEntry,
  type PersonalLeaderboardEntry,
} from "./leaderboardApi";

const globalQueryKey = ["leaderboard", "global"] as const;
const scoreFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

export function formatScore(score: number): string {
  return scoreFormatter.format(score);
}

function uniqueEntries<T extends { appId: number; rank: number }>(
  pages: { items: T[] }[] | undefined,
): T[] {
  const appIds = new Set<number>();
  const ranks = new Set<number>();
  const entries: T[] = [];
  for (const page of pages ?? []) {
    for (const entry of page.items) {
      if (appIds.has(entry.appId) || ranks.has(entry.rank)) continue;
      appIds.add(entry.appId);
      ranks.add(entry.rank);
      entries.push(entry);
    }
  }
  return entries;
}

function uniqueFriends(
  pages: { items: ParticipatingFriendEntry[] }[] | undefined,
): ParticipatingFriendEntry[] {
  const friendIds = new Set<string>();
  return (pages ?? []).flatMap((page) =>
    page.items.filter((friend) => {
      if (friendIds.has(friend.friendId)) return false;
      friendIds.add(friend.friendId);
      return true;
    }),
  );
}

function useLoadMore(
  hasNextPage: boolean,
  fetchNextPage: () => Promise<unknown>,
) {
  const requestPending = useRef(false);
  const [pageRequested, setPageRequested] = useState(false);
  const loadMore = async () => {
    if (requestPending.current || !hasNextPage) return;
    requestPending.current = true;
    setPageRequested(true);
    try {
      await fetchNextPage();
    } finally {
      requestPending.current = false;
    }
  };
  return { loadMore, pageRequested };
}

function StatusHelp() {
  return (
    <p className={styles.leaderboardHelp}>
      <strong>{copy.leaderboards.status.provisional}:</strong>{" "}
      {copy.leaderboards.status.provisionalMeaning}{" "}
      <strong>{copy.leaderboards.status.ranked}:</strong>{" "}
      {copy.leaderboards.status.rankedMeaning}
    </p>
  );
}

function PageHeader({
  title,
  eyebrow,
  summary,
  scoreSummary,
  scoreHelp,
  action,
}: {
  title: string;
  eyebrow: string;
  summary: string;
  scoreSummary?: string;
  scoreHelp?: string;
  action?: ReactNode;
}) {
  return (
    <header className={styles.leaderboardHeader}>
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1>{title}</h1>
        <p>{summary}</p>
        {scoreSummary ? (
          <p className={styles.leaderboardHelp}>{scoreSummary}</p>
        ) : null}
        {scoreHelp ? (
          <details className={styles.infoDisclosure}>
            <summary>{copy.leaderboards.scoringInfo}</summary>
            <p className={styles.leaderboardHelp}>{scoreHelp}</p>
            <StatusHelp />
          </details>
        ) : null}
      </div>
      {action}
    </header>
  );
}

function SteamGameName({ appId, name }: { appId: number; name: string }) {
  return (
    <a
      href={steamStoreUrl(appId)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={copy.leaderboards.gameLinkLabel(name)}
    >
      {name}
    </a>
  );
}

function GlobalTable({ entries }: { entries: GlobalLeaderboardEntry[] }) {
  return (
    <div
      className={styles.leaderboardTableRegion}
      role="region"
      aria-label={copy.leaderboards.global.tableLabel}
      tabIndex={0}
    >
      <table className={styles.leaderboardTable}>
        <thead>
          <tr>
            <th scope="col">{copy.leaderboards.columns.rank}</th>
            <th scope="col">{copy.leaderboards.columns.artwork}</th>
            <th scope="col">{copy.leaderboards.columns.game}</th>
            <th scope="col">{copy.leaderboards.columns.status}</th>
            <th scope="col">{copy.leaderboards.columns.contributors}</th>
            <th scope="col">{copy.leaderboards.columns.globalScore}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.appId}>
              <td>{entry.rank}</td>
              <td className={styles.leaderboardArtwork}>
                <Artwork src={entry.artworkUrl} name={entry.name} />
              </td>
              <th scope="row" aria-label={entry.name}>
                <SteamGameName appId={entry.appId} name={entry.name} />
              </th>
              <td>{entry.status === "RANKED" ? "Ranked" : "Provisional"}</td>
              <td>
                {copy.leaderboards.global.contributors(entry.contributorCount)}
              </td>
              <td>{formatScore(entry.score)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PersonalTable({ entries }: { entries: PersonalLeaderboardEntry[] }) {
  return (
    <div
      className={styles.leaderboardTableRegion}
      role="region"
      aria-label={copy.leaderboards.personal.tableLabel}
      tabIndex={0}
    >
      <table className={styles.leaderboardTable}>
        <thead>
          <tr>
            <th scope="col">{copy.leaderboards.columns.rank}</th>
            <th scope="col">{copy.leaderboards.columns.artwork}</th>
            <th scope="col">{copy.leaderboards.columns.game}</th>
            <th scope="col">{copy.leaderboards.columns.status}</th>
            <th scope="col">{copy.leaderboards.columns.comparisons}</th>
            <th scope="col">{copy.leaderboards.columns.ownership}</th>
            <th scope="col">{copy.leaderboards.columns.eligibility}</th>
            <th scope="col">{copy.leaderboards.columns.personalScore}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.appId}>
              <td>{entry.rank}</td>
              <td className={styles.leaderboardArtwork}>
                <Artwork src={entry.artworkUrl} name={entry.name} />
              </td>
              <th scope="row" aria-label={entry.name}>
                <SteamGameName appId={entry.appId} name={entry.name} />
              </th>
              <td>{entry.status === "RANKED" ? "Ranked" : "Provisional"}</td>
              <td>
                {copy.leaderboards.personal.comparisons(entry.comparisonCount)}
              </td>
              <td>
                {entry.currentlyOwned
                  ? copy.leaderboards.personal.current
                  : copy.leaderboards.personal.historical}
              </td>
              <td>
                {entry.effectivelyEligible
                  ? copy.leaderboards.personal.eligible
                  : copy.leaderboards.personal.ineligible}
              </td>
              <td>
                {entry.score === null
                  ? copy.leaderboards.personal.unscored
                  : formatScore(entry.score)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ParticipatingFriendsTable({
  entries,
}: {
  entries: ParticipatingFriendEntry[];
}) {
  return (
    <div
      className={styles.leaderboardTableRegion}
      role="region"
      aria-label={copy.leaderboards.friends.tableLabel}
      tabIndex={0}
    >
      <table className={`${styles.leaderboardTable} ${styles.friendTable}`}>
        <thead>
          <tr>
            <th scope="col">{copy.leaderboards.columns.avatar}</th>
            <th scope="col">{copy.leaderboards.columns.friend}</th>
            <th scope="col">{copy.leaderboards.columns.actions}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((friend) => (
            <tr key={friend.friendId}>
              <td className={styles.friendAvatar}>
                <Artwork
                  kind="avatar"
                  src={friend.avatarUrl}
                  name={friend.displayName}
                />
              </td>
              <th scope="row">{friend.displayName}</th>
              <td>
                <div className={styles.friendActions}>
                  {friend.profileUrl ? (
                    <a
                      href={friend.profileUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={copy.leaderboards.friends.profileLabel(
                        friend.displayName,
                      )}
                    >
                      {copy.leaderboards.friends.profile} ↗
                    </a>
                  ) : null}
                  <Link
                    to={`/leaderboard/friends/${friend.friendId}`}
                    aria-label={copy.leaderboards.friends.rankingLabel(
                      friend.displayName,
                    )}
                  >
                    {copy.leaderboards.friends.ranking}
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FriendLeaderboardTable({
  entries,
}: {
  entries: FriendLeaderboardEntry[];
}) {
  return (
    <div
      className={styles.leaderboardTableRegion}
      role="region"
      aria-label={copy.leaderboards.friendRanking.tableLabel}
      tabIndex={0}
    >
      <table
        className={`${styles.leaderboardTable} ${styles.friendRankingTable}`}
      >
        <thead>
          <tr>
            <th scope="col">{copy.leaderboards.columns.rank}</th>
            <th scope="col">{copy.leaderboards.columns.artwork}</th>
            <th scope="col">{copy.leaderboards.columns.game}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.appId}>
              <td>{entry.rank}</td>
              <td className={styles.leaderboardArtwork}>
                <Artwork src={entry.artworkUrl} name={entry.name} />
              </td>
              <th scope="row" aria-label={entry.name}>
                <SteamGameName appId={entry.appId} name={entry.name} />
              </th>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function problemType(error: unknown): string | undefined {
  return error instanceof ApiProblem
    ? error.type?.split("/").at(-1)
    : undefined;
}

function FriendProblemNotice({
  error,
  onRetry,
  retryLabel,
  target = false,
}: {
  error: unknown;
  onRetry: () => void;
  retryLabel?: string;
  target?: boolean;
}) {
  const kind = problemType(error);
  if (
    target &&
    (kind === "friend-not-found" ||
      (error instanceof ApiProblem && error.status === 404))
  ) {
    const safeError = new ApiProblem(
      404,
      copy.leaderboards.errors.notFoundTitle,
      copy.leaderboards.errors.notFoundDetail,
      error instanceof ApiProblem ? error.requestId : undefined,
      kind,
    );
    return (
      <div>
        <ProblemNotice error={safeError} />
        <Link className={styles.secondaryButton} to="/leaderboard/friends">
          {copy.leaderboards.friendRanking.back}
        </Link>
      </div>
    );
  }

  const guidance =
    kind === "friend-leaderboard-sharing-required"
      ? copy.leaderboards.errors.sharingRequired
      : kind === "steam-friend-list-private"
        ? copy.leaderboards.errors.privateList
        : kind === "steam-friends-unavailable"
          ? copy.leaderboards.errors.unavailable
          : error instanceof ApiProblem && error.status === 429
            ? copy.leaderboards.errors.rateLimited
            : undefined;
  return (
    <div>
      {guidance ? <p className={styles.inlineError}>{guidance}</p> : null}
      {kind === "steam-friend-list-private" ? (
        <a
          className={styles.secondaryButton}
          href="https://help.steampowered.com/en/faqs/view/588C-C67D-0251-C276"
          target="_blank"
          rel="noreferrer"
        >
          {copy.leaderboards.errors.privacyGuidance}
        </a>
      ) : null}
      <ProblemNotice error={error} onRetry={onRetry} retryLabel={retryLabel} />
      {kind === "friend-leaderboard-sharing-required" ? (
        <Link className={styles.secondaryButton} to="/settings">
          {copy.leaderboards.friends.openSettings}
        </Link>
      ) : null}
    </div>
  );
}

function QueryState({
  entries,
  isPending,
  isError,
  error,
  isFetchNextPageError,
  isFetchingNextPage,
  hasNextPage,
  pageRequested,
  loading,
  loadingMore,
  empty,
  end,
  onRetry,
  onLoadMore,
  renderProblem,
  children,
}: {
  entries: readonly unknown[];
  isPending: boolean;
  isError: boolean;
  error: unknown;
  isFetchNextPageError: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  pageRequested: boolean;
  loading: string;
  loadingMore: string;
  empty: string;
  end: string;
  onRetry: () => void;
  onLoadMore: () => void;
  renderProblem?: (onRetry: () => void, retryLabel?: string) => ReactNode;
  children: ReactNode;
}) {
  if (isPending) return <p role="status">{loading}</p>;
  if (isError && entries.length === 0) {
    return (
      <div>
        {error instanceof ApiProblem && error.status === 429 ? (
          <p>{copy.leaderboards.rateLimited}</p>
        ) : null}
        {renderProblem ? (
          renderProblem(onRetry)
        ) : (
          <ProblemNotice error={error} onRetry={onRetry} />
        )}
      </div>
    );
  }
  if (entries.length === 0) return <p className={styles.emptyState}>{empty}</p>;
  return (
    <>
      {children}
      {isFetchNextPageError ? (
        <div>
          {error instanceof ApiProblem && error.status === 429 ? (
            <p>{copy.leaderboards.rateLimited}</p>
          ) : null}
          {renderProblem ? (
            renderProblem(onLoadMore, copy.leaderboards.retryMore)
          ) : (
            <ProblemNotice
              error={error}
              onRetry={onLoadMore}
              retryLabel={copy.leaderboards.retryMore}
            />
          )}
        </div>
      ) : null}
      {hasNextPage && !isFetchNextPageError ? (
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={isFetchingNextPage}
          onClick={onLoadMore}
        >
          {isFetchingNextPage ? loadingMore : copy.leaderboards.loadMore}
        </button>
      ) : !isFetchNextPageError && (pageRequested || entries.length > 0) ? (
        <p className={styles.endState}>{end}</p>
      ) : null}
    </>
  );
}

export function GlobalLeaderboardPage() {
  const { session } = useAuth();
  const query = useInfiniteQuery({
    queryKey: globalQueryKey,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      getGlobalLeaderboardPage(session, pageParam, signal),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    meta: { scope: "public" },
  });
  const entries = uniqueEntries(query.data?.pages);
  const { loadMore, pageRequested } = useLoadMore(
    Boolean(query.hasNextPage),
    () => query.fetchNextPage(),
  );

  return (
    <section className={styles.leaderboardPage}>
      <PageHeader
        title={copy.routes.globalTitle}
        eyebrow={copy.routes.globalEyebrow}
        summary={copy.leaderboards.global.summary}
        scoreSummary={copy.leaderboards.global.scoreSummary}
        scoreHelp={copy.leaderboards.global.scoreHelp}
      />
      <QueryState
        entries={entries}
        isPending={query.isPending}
        isError={query.isError}
        error={query.error}
        isFetchNextPageError={query.isFetchNextPageError}
        isFetchingNextPage={query.isFetchingNextPage}
        hasNextPage={Boolean(query.hasNextPage)}
        pageRequested={pageRequested}
        loading={copy.leaderboards.global.loading}
        loadingMore={copy.leaderboards.global.loadingMore}
        empty={copy.leaderboards.global.empty}
        end={copy.leaderboards.global.end}
        onRetry={() => void query.refetch()}
        onLoadMore={() => void loadMore()}
      >
        <GlobalTable entries={entries} />
      </QueryState>
    </section>
  );
}

export function PersonalLeaderboardPage() {
  const { session } = useAuth();
  const query = useInfiniteQuery({
    queryKey: personalLeaderboardQueryKey,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      getPersonalLeaderboardPage(session, pageParam, signal),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    meta: { scope: "user" },
  });
  const entries = uniqueEntries(query.data?.pages);
  const { loadMore, pageRequested } = useLoadMore(
    Boolean(query.hasNextPage),
    () => query.fetchNextPage(),
  );
  return (
    <section className={styles.leaderboardPage}>
      <PageHeader
        title={copy.routes.personalRanking}
        eyebrow={copy.leaderboards.personal.eyebrow}
        summary={copy.leaderboards.personal.summary}
        scoreSummary={copy.leaderboards.personal.scoreSummary}
        scoreHelp={copy.leaderboards.personal.scoreHelp}
      />
      <QueryState
        entries={entries}
        isPending={query.isPending}
        isError={query.isError}
        error={query.error}
        isFetchNextPageError={query.isFetchNextPageError}
        isFetchingNextPage={query.isFetchingNextPage}
        hasNextPage={Boolean(query.hasNextPage)}
        pageRequested={pageRequested}
        loading={copy.leaderboards.personal.loading}
        loadingMore={copy.leaderboards.personal.loadingMore}
        empty={copy.leaderboards.personal.empty}
        end={copy.leaderboards.personal.end}
        onRetry={() => void query.refetch()}
        onLoadMore={() => void loadMore()}
      >
        <PersonalTable entries={entries} />
      </QueryState>
    </section>
  );
}

export function FriendsLeaderboardPage() {
  const { session } = useAuth();
  const sharingQuery = useQuery({
    queryKey: friendLeaderboardSharingQueryKey,
    queryFn: ({ signal }) => getFriendLeaderboardSharing(session, signal),
    meta: { scope: "user" },
  });
  const query = useInfiniteQuery({
    queryKey: participatingFriendsQueryKey,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      getParticipatingFriendsPage(session, pageParam, signal),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: sharingQuery.data?.enabled === true,
    meta: { scope: "user" },
  });
  const entries = uniqueFriends(query.data?.pages);
  const { loadMore, pageRequested } = useLoadMore(
    Boolean(query.hasNextPage),
    () => query.fetchNextPage(),
  );

  return (
    <section className={styles.leaderboardPage}>
      <PageHeader
        title={copy.routes.friends}
        eyebrow={copy.leaderboards.friends.eyebrow}
        summary={copy.leaderboards.friends.summary}
      />
      {sharingQuery.isPending ? (
        <p role="status">{copy.leaderboards.friends.checkingSharing}</p>
      ) : sharingQuery.isError ? (
        <ProblemNotice
          error={sharingQuery.error}
          onRetry={() => void sharingQuery.refetch()}
        />
      ) : !sharingQuery.data.enabled ? (
        <div className={styles.settingsCard}>
          <h2>{copy.leaderboards.friends.disabledTitle}</h2>
          <p>{copy.leaderboards.friends.disabledDetail}</p>
          <Link className={styles.secondaryButton} to="/settings">
            {copy.leaderboards.friends.openSettings}
          </Link>
        </div>
      ) : (
        <QueryState
          entries={entries}
          isPending={query.isPending}
          isError={query.isError}
          error={query.error}
          isFetchNextPageError={query.isFetchNextPageError}
          isFetchingNextPage={query.isFetchingNextPage}
          hasNextPage={Boolean(query.hasNextPage)}
          pageRequested={pageRequested}
          loading={copy.leaderboards.friends.loading}
          loadingMore={copy.leaderboards.friends.loadingMore}
          empty={copy.leaderboards.friends.empty}
          end={copy.leaderboards.friends.end}
          onRetry={() => void query.refetch()}
          onLoadMore={() => void loadMore()}
          renderProblem={(retry, retryLabel) => (
            <FriendProblemNotice
              error={query.error}
              onRetry={retry}
              retryLabel={retryLabel}
            />
          )}
        >
          <ParticipatingFriendsTable entries={entries} />
        </QueryState>
      )}
    </section>
  );
}

export function FriendLeaderboardPage() {
  const { friendId = "" } = useParams();
  const { session } = useAuth();
  const sharingQuery = useQuery({
    queryKey: friendLeaderboardSharingQueryKey,
    queryFn: ({ signal }) => getFriendLeaderboardSharing(session, signal),
    meta: { scope: "user" },
  });
  const query = useInfiniteQuery({
    queryKey: friendGameLeaderboardQueryKey(friendId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      getFriendLeaderboardPage(session, friendId, pageParam, signal),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(friendId) && sharingQuery.data?.enabled === true,
    meta: { scope: "user" },
  });
  const entries = uniqueEntries(query.data?.pages);
  const { loadMore, pageRequested } = useLoadMore(
    Boolean(query.hasNextPage),
    () => query.fetchNextPage(),
  );

  return (
    <section className={styles.leaderboardPage}>
      <PageHeader
        title={copy.routes.friendRanking}
        eyebrow={copy.leaderboards.friendRanking.eyebrow}
        summary={copy.leaderboards.friendRanking.summary}
      />
      {sharingQuery.isPending ? (
        <p role="status">{copy.leaderboards.friends.checkingSharing}</p>
      ) : sharingQuery.isError ? (
        <ProblemNotice
          error={sharingQuery.error}
          onRetry={() => void sharingQuery.refetch()}
        />
      ) : !sharingQuery.data.enabled ? (
        <div className={styles.settingsCard}>
          <h2>{copy.leaderboards.friends.disabledTitle}</h2>
          <p>{copy.leaderboards.friends.disabledDetail}</p>
          <Link className={styles.secondaryButton} to="/settings">
            {copy.leaderboards.friends.openSettings}
          </Link>
        </div>
      ) : (
        <QueryState
          entries={entries}
          isPending={query.isPending}
          isError={query.isError}
          error={query.error}
          isFetchNextPageError={query.isFetchNextPageError}
          isFetchingNextPage={query.isFetchingNextPage}
          hasNextPage={Boolean(query.hasNextPage)}
          pageRequested={pageRequested}
          loading={copy.leaderboards.friendRanking.loading}
          loadingMore={copy.leaderboards.friendRanking.loadingMore}
          empty={copy.leaderboards.friendRanking.empty}
          end={copy.leaderboards.friendRanking.end}
          onRetry={() => void query.refetch()}
          onLoadMore={() => void loadMore()}
          renderProblem={(retry, retryLabel) => (
            <FriendProblemNotice
              error={query.error}
              onRetry={retry}
              retryLabel={retryLabel}
              target
            />
          )}
        >
          <FriendLeaderboardTable entries={entries} />
        </QueryState>
      )}
    </section>
  );
}
