import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ApiProblem } from "../../api/problem";
import { useAuth } from "../../auth/AuthContext";
import { Artwork } from "../../components/Artwork";
import { ProblemNotice } from "../../components/ProblemNotice";
import { copy } from "../../content/copy";
import styles from "../../styles/App.module.css";
import {
  getLibraryPage,
  requestSync,
  updateEligibility,
  type EligibilityBehavior,
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
      queryClient.setQueryData<InfiniteData<LibraryPageData>>(
        libraryQueryKey,
        (current) => replaceItem(current, nextItem),
      );
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
  const [pageRequested, setPageRequested] = useState(false);
  const pageRequestPending = useRef(false);
  const unavailable = Boolean(
    profileQuery.data?.libraryState === "UNAVAILABLE" ||
    profileQuery.data?.synchronization?.failureCode === "LIBRARY_UNAVAILABLE",
  );
  const libraryQuery = useInfiniteQuery({
    queryKey: libraryQueryKey,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      getLibraryPage(session, pageParam, signal),
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
          <p>{copy.library.eligibility.defaultExplanation}</p>
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
