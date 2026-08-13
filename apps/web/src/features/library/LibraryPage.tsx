import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiProblem } from "../../api/problem";
import { useAuth } from "../../auth/AuthContext";
import { Artwork } from "../../components/Artwork";
import { ProblemNotice } from "../../components/ProblemNotice";
import { copy } from "../../content/copy";
import styles from "../../styles/App.module.css";
import { recommendationQueryKey } from "../recommendations/recommendationApi";
import {
  getLibraryPage,
  requestSync,
  updateEligibility,
  type EligibilityBehavior,
  type LibraryFilters,
  type LibraryItem,
  type LibraryPageData,
  type MeProfile,
} from "./libraryApi";
import {
  libraryQueryKey,
  profileQueryKey,
  useProfileQuery,
} from "./ProfileSyncStatus";

const behaviorLabels: Record<EligibilityBehavior, string> = {
  DEFAULT: copy.library.eligibility.default,
  INCLUDED: copy.library.eligibility.include,
  EXCLUDED: copy.library.eligibility.exclude,
};

function formatPlaytime(minutes: number): string {
  if (minutes === 0) return copy.library.neverPlayed;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours > 0 ? `${hours}h ${remainder}m` : `${remainder}m`;
}

function replaceItem(
  data: InfiniteData<LibraryPageData> | undefined,
  nextItem: LibraryItem,
) {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((item) =>
        item.appId === nextItem.appId ? nextItem : item,
      ),
    })),
  };
}

function LibraryEntry({ item }: { item: LibraryItem }) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [failedBehavior, setFailedBehavior] = useState<EligibilityBehavior>();
  const mutation = useMutation({
    mutationFn: (behavior: EligibilityBehavior) =>
      updateEligibility(session, item.appId, behavior),
    onSuccess: (nextItem) => {
      setFailedBehavior(undefined);
      queryClient.setQueriesData<InfiniteData<LibraryPageData>>(
        { queryKey: libraryQueryKey },
        (current) => replaceItem(current, nextItem),
      );
      void queryClient.invalidateQueries({ queryKey: recommendationQueryKey });
    },
    onError: (_error, behavior) => setFailedBehavior(behavior),
  });

  return (
    <article className={styles.libraryCard} aria-label={item.name}>
      <Artwork src={item.artworkUrl} name={item.name} />
      <div className={styles.libraryCardBody}>
        <h2>{item.name}</h2>
        <dl className={styles.libraryFacts}>
          <div>
            <dt>{copy.library.playtime}</dt>
            <dd>{formatPlaytime(item.playtimeMinutes)}</dd>
          </div>
          <div>
            <dt>{copy.library.ownership}</dt>
            <dd>
              {item.currentlyOwned
                ? copy.library.currentOwnership
                : copy.library.historicalOwnership}
            </dd>
          </div>
        </dl>
        {item.currentlyOwned ? (
          <label className={styles.eligibilityControl}>
            <span>{copy.library.eligibility.label(item.name)}</span>
            <select
              value={item.eligibilityOverride}
              disabled={mutation.isPending}
              onChange={(event) =>
                mutation.mutate(event.target.value as EligibilityBehavior)
              }
            >
              {Object.entries(behaviorLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <p className={styles.eligibilityState} aria-live="polite">
          {item.currentlyOwned && item.effectivelyEligible
            ? copy.library.eligibility.eligible
            : copy.library.eligibility.notEligible}
        </p>
        {mutation.isError && failedBehavior ? (
          <div className={styles.inlineError}>
            <ProblemNotice
              error={mutation.error}
              onRetry={() => mutation.mutate(failedBehavior)}
              retryLabel={copy.library.eligibility.retry(
                behaviorLabels[failedBehavior].toLowerCase(),
                item.name,
              )}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}

function PrivateLibrary() {
  return (
    <section className={styles.privateGuidance}>
      <h2>{copy.library.privateTitle}</h2>
      <p>{copy.library.privateDetail}</p>
      <a
        href="https://help.steampowered.com/en/faqs/view/588C-C67D-0251-C276"
        target="_blank"
        rel="noreferrer"
      >
        {copy.library.privacyGuidance}
      </a>
    </section>
  );
}

export function LibraryPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const profileQuery = useProfileQuery();
  const [searchParameters, setSearchParameters] = useSearchParams();
  const intendedSearchParameters = useRef(
    new URLSearchParams(searchParameters),
  );
  useEffect(() => {
    intendedSearchParameters.current = new URLSearchParams(searchParameters);
  }, [searchParameters]);
  const [pageRequested, setPageRequested] = useState(false);
  const nameParameter = searchParameters.get("name") ?? "";
  const effectiveParameter = searchParameters.get("effectivelyEligible");
  const overrideParameter = searchParameters.get("eligibilityOverride");
  const [nameInput, setNameInput] = useState(nameParameter);
  const [previousNameParameter, setPreviousNameParameter] =
    useState(nameParameter);
  if (previousNameParameter !== nameParameter) {
    setPreviousNameParameter(nameParameter);
    setNameInput(nameParameter);
  }
  const pageRequestPending = useRef(false);
  const filters = useMemo<LibraryFilters>(
    () => ({
      name: nameParameter || undefined,
      effectivelyEligible:
        effectiveParameter === "true"
          ? true
          : effectiveParameter === "false"
            ? false
            : undefined,
      eligibilityOverride: ["DEFAULT", "INCLUDED", "EXCLUDED"].includes(
        overrideParameter ?? "",
      )
        ? (overrideParameter as EligibilityBehavior)
        : undefined,
    }),
    [effectiveParameter, nameParameter, overrideParameter],
  );
  const hasActiveFilters = Boolean(
    filters.name ||
    filters.effectivelyEligible !== undefined ||
    filters.eligibilityOverride,
  );

  const updateFilter = useCallback(
    (name: string, value?: string) => {
      const next = new URLSearchParams(intendedSearchParameters.current);
      if (value) next.set(name, value);
      else next.delete(name);
      intendedSearchParameters.current = next;
      setPageRequested(false);
      setSearchParameters(next, { replace: true });
    },
    [setSearchParameters],
  );

  useEffect(() => {
    const nextName = nameInput.trim();
    if (nextName === nameParameter) return;
    const timer = window.setTimeout(
      () => updateFilter("name", nextName || undefined),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [nameInput, nameParameter, updateFilter]);
  const unavailable = Boolean(
    profileQuery.data?.libraryState === "UNAVAILABLE" ||
    profileQuery.data?.synchronization?.failureCode === "LIBRARY_UNAVAILABLE",
  );
  const libraryQuery = useInfiniteQuery({
    queryKey: [...libraryQueryKey, filters],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      getLibraryPage(session, filters, pageParam, signal),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: profileQuery.isSuccess && !unavailable,
    meta: { scope: "user" },
  });
  const syncMutation = useMutation({
    mutationFn: () => requestSync(session),
    onSuccess: (job) => {
      queryClient.setQueryData<MeProfile>(profileQueryKey, (current) =>
        current ? { ...current, synchronization: job } : current,
      );
      void queryClient.invalidateQueries({ queryKey: recommendationQueryKey });
    },
  });

  const items = (() => {
    const unique = new Map<number, LibraryItem>();
    for (const page of libraryQuery.data?.pages ?? []) {
      for (const item of page.items) {
        if (!unique.has(item.appId)) unique.set(item.appId, item);
      }
    }
    return [...unique.values()];
  })();

  const loadMore = async () => {
    if (pageRequestPending.current || !libraryQuery.hasNextPage) return;
    pageRequestPending.current = true;
    setPageRequested(true);
    try {
      await libraryQuery.fetchNextPage();
    } finally {
      pageRequestPending.current = false;
    }
  };

  return (
    <section className={styles.libraryPage} aria-labelledby="library-title">
      <header className={styles.libraryHeader}>
        <div>
          <p className={styles.eyebrow}>{copy.library.eyebrow}</p>
          <h1 id="library-title">{copy.routes.library}</h1>
          <p>{copy.library.summary}</p>
          <details className={styles.infoDisclosure}>
            <summary>How eligibility works</summary>
            <p>{copy.library.eligibility.defaultExplanation}</p>
          </details>
        </div>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={syncMutation.isPending}
          onClick={() => syncMutation.mutate()}
        >
          {syncMutation.isPending
            ? copy.library.synchronizing
            : copy.library.synchronize}
        </button>
      </header>

      {profileQuery.data ? (
        <dl className={styles.syncDetails}>
          <div>
            <dt>{copy.library.libraryState}</dt>
            <dd>{profileQuery.data.libraryState.replace("_", " ")}</dd>
          </div>
          <div>
            <dt>{copy.library.lastSync}</dt>
            <dd>
              {profileQuery.data.lastLibrarySyncAt
                ? new Date(profileQuery.data.lastLibrarySyncAt).toLocaleString()
                : copy.library.notYet}
            </dd>
          </div>
        </dl>
      ) : null}

      {profileQuery.isSuccess && !unavailable ? (
        <form
          className={styles.libraryFilters}
          aria-label="Library filters"
          onSubmit={(event) => event.preventDefault()}
        >
          <label>
            <span>{copy.library.filters.name}</span>
            <input
              type="search"
              maxLength={200}
              value={nameInput}
              placeholder={copy.library.filters.namePlaceholder}
              onChange={(event) => setNameInput(event.currentTarget.value)}
            />
          </label>
          <label>
            <span>{copy.library.filters.effectiveEligibility}</span>
            <select
              value={
                filters.effectivelyEligible === undefined
                  ? ""
                  : String(filters.effectivelyEligible)
              }
              onChange={(event) =>
                updateFilter(
                  "effectivelyEligible",
                  event.currentTarget.value || undefined,
                )
              }
            >
              <option value="">{copy.library.filters.all}</option>
              <option value="true">{copy.library.filters.eligible}</option>
              <option value="false">{copy.library.filters.notEligible}</option>
            </select>
          </label>
          <label>
            <span>{copy.library.filters.eligibilityOverride}</span>
            <select
              value={filters.eligibilityOverride ?? ""}
              onChange={(event) =>
                updateFilter(
                  "eligibilityOverride",
                  event.currentTarget.value || undefined,
                )
              }
            >
              <option value="">{copy.library.filters.all}</option>
              {Object.entries(behaviorLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={!hasActiveFilters && !nameInput}
            onClick={() => {
              const next = new URLSearchParams(
                intendedSearchParameters.current,
              );
              next.delete("name");
              next.delete("effectivelyEligible");
              next.delete("eligibilityOverride");
              intendedSearchParameters.current = next;
              setNameInput("");
              setPageRequested(false);
              setSearchParameters(next, { replace: true });
            }}
          >
            {copy.library.filters.clear}
          </button>
        </form>
      ) : null}

      {syncMutation.error ? (
        <div>
          {syncMutation.error instanceof ApiProblem &&
          syncMutation.error.status === 429 ? (
            <p>{copy.library.cooldown}</p>
          ) : null}
          <ProblemNotice
            error={syncMutation.error}
            onRetry={() => syncMutation.mutate()}
          />
        </div>
      ) : null}

      {profileQuery.isPending ? (
        <p role="status">{copy.library.loadingProfile}</p>
      ) : profileQuery.isError ? (
        <ProblemNotice
          error={profileQuery.error}
          onRetry={() => profileQuery.refetch()}
        />
      ) : unavailable ? (
        <PrivateLibrary />
      ) : libraryQuery.isPending ? (
        <p role="status">{copy.library.loading}</p>
      ) : libraryQuery.isError && !libraryQuery.data ? (
        <ProblemNotice
          error={libraryQuery.error}
          onRetry={() => libraryQuery.refetch()}
        />
      ) : items.length === 0 ? (
        <p className={styles.emptyState}>
          {profileQuery.data?.libraryState === "NOT_SYNCED"
            ? copy.library.notSynchronized
            : hasActiveFilters
              ? copy.library.noMatches
              : copy.library.empty}
        </p>
      ) : (
        <>
          <div className={styles.libraryGrid}>
            {items.map((item) => (
              <LibraryEntry key={item.appId} item={item} />
            ))}
          </div>
          {libraryQuery.isFetchNextPageError ? (
            <ProblemNotice
              error={libraryQuery.error}
              onRetry={() => void loadMore()}
            />
          ) : null}
          {libraryQuery.hasNextPage ? (
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={libraryQuery.isFetchingNextPage}
              onClick={() => void loadMore()}
            >
              {libraryQuery.isFetchingNextPage
                ? copy.library.loadingMore
                : copy.library.loadMore}
            </button>
          ) : pageRequested || items.length > 0 ? (
            <p className={styles.endState}>{copy.library.end}</p>
          ) : null}
        </>
      )}
    </section>
  );
}
