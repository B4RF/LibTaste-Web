import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type ReactNode } from "react";
import { ApiProblem } from "../../api/problem";
import { useAuth } from "../../auth/AuthContext";
import { Artwork } from "../../components/Artwork";
import { ProblemNotice } from "../../components/ProblemNotice";
import { copy } from "../../content/copy";
import styles from "../../styles/App.module.css";
import {
  getGlobalLeaderboardPage,
  getPersonalLeaderboardPage,
  personalLeaderboardQueryKey,
  type GlobalLeaderboardEntry,
  type PersonalLeaderboardEntry,
} from "./leaderboardApi";

const globalQueryKey = ["leaderboard", "global"] as const;
const personalQueryKey = (includeHistorical: boolean) =>
  [...personalLeaderboardQueryKey, includeHistorical] as const;
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
  scoreSummary: string;
  scoreHelp: string;
  action?: ReactNode;
}) {
  return (
    <header className={styles.leaderboardHeader}>
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1>{title}</h1>
        <p>{summary}</p>
        <p className={styles.leaderboardHelp}>{scoreSummary}</p>
        <details className={styles.infoDisclosure}>
          <summary>{copy.leaderboards.scoringInfo}</summary>
          <p className={styles.leaderboardHelp}>{scoreHelp}</p>
          <StatusHelp />
        </details>
      </div>
      {action}
    </header>
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
              <th scope="row">{entry.name}</th>
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
              <th scope="row">{entry.name}</th>
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
  children,
}: {
  entries: { appId: number }[];
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
  children: ReactNode;
}) {
  if (isPending) return <p role="status">{loading}</p>;
  if (isError && entries.length === 0) {
    return (
      <div>
        {error instanceof ApiProblem && error.status === 429 ? (
          <p>{copy.leaderboards.rateLimited}</p>
        ) : null}
        <ProblemNotice error={error} onRetry={onRetry} />
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
          <ProblemNotice
            error={error}
            onRetry={onLoadMore}
            retryLabel={copy.leaderboards.retryMore}
          />
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
  const queryClient = useQueryClient();
  const [includeHistorical, setIncludeHistorical] = useState(false);
  const query = useInfiniteQuery({
    queryKey: personalQueryKey(includeHistorical),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      getPersonalLeaderboardPage(session, includeHistorical, pageParam, signal),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    meta: { scope: "user" },
  });
  const entries = uniqueEntries(query.data?.pages);
  const { loadMore, pageRequested } = useLoadMore(
    Boolean(query.hasNextPage),
    () => query.fetchNextPage(),
  );
  const changeHistory = (nextValue: boolean) => {
    queryClient.removeQueries({
      queryKey: personalQueryKey(includeHistorical),
      exact: true,
    });
    setIncludeHistorical(nextValue);
  };

  return (
    <section className={styles.leaderboardPage}>
      <PageHeader
        title={copy.routes.personalRanking}
        eyebrow={copy.leaderboards.personal.eyebrow}
        summary={copy.leaderboards.personal.summary}
        scoreSummary={copy.leaderboards.personal.scoreSummary}
        scoreHelp={copy.leaderboards.personal.scoreHelp}
        action={
          <label className={styles.historyToggle}>
            <input
              type="checkbox"
              checked={includeHistorical}
              onChange={(event) => changeHistory(event.currentTarget.checked)}
            />
            {copy.leaderboards.personal.includeHistorical}
          </label>
        }
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
