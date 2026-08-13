import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ApiProblem } from "../../api/problem";
import { useAuth } from "../../auth/AuthContext";
import { Artwork } from "../../components/Artwork";
import { ProblemNotice } from "../../components/ProblemNotice";
import { copy } from "../../content/copy";
import { steamStoreUrl } from "../../steam";
import styles from "../../styles/App.module.css";
import { updateEligibility } from "../library/libraryApi";
import { libraryQueryKey } from "../library/ProfileSyncStatus";
import { personalLeaderboardQueryKey } from "../leaderboards/leaderboardApi";
import { recommendationQueryKey } from "../recommendations/recommendationApi";
import {
  getNextComparison,
  submitComparisonResult,
  type Comparison,
  type ComparisonOutcome,
  type ComparisonResult,
} from "./comparisonApi";

type SubmissionState =
  | { kind: "allocating"; previous?: Comparison }
  | {
      kind: "submitting";
      comparison: Comparison;
      outcome: ComparisonOutcome;
    }
  | {
      kind: "uncertain";
      comparison: Comparison;
      outcome: ComparisonOutcome;
      error: unknown;
    }
  | {
      kind: "recorded";
      comparison: Comparison;
      result: ComparisonResult;
    }
  | {
      kind: "excluding" | "exclusion-rejected" | "exclusion-uncertain";
      comparison: Comparison;
      game: Comparison["left"];
      error?: unknown;
    }
  | {
      kind: "retiring" | "retirement-uncertain" | "excluded";
      comparison: Comparison;
      game: Comparison["left"];
      error?: unknown;
    }
  | { kind: "stale"; error: unknown };

type AllocationKind =
  "synchronization" | "eligibility" | "rate-limit" | "no-pair" | "generic";

const outcomeLabels: Record<ComparisonOutcome, string> = {
  LEFT_WIN: "left game",
  RIGHT_WIN: "right game",
  DRAW: "draw",
  SKIP: "skip",
};

const shortcuts: Record<string, ComparisonOutcome> = {
  w: "DRAW",
  a: "LEFT_WIN",
  s: "SKIP",
  d: "RIGHT_WIN",
};

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        "a, button, input, select, textarea, summary, [contenteditable='true']",
      ),
    )
  );
}

function isStaleProblem(error: unknown): boolean {
  if (!(error instanceof ApiProblem)) return false;
  const type = error.type?.toLowerCase() ?? "";
  return (
    error.status === 404 ||
    error.status === 409 ||
    /comparison.*(expired|conflict|missing)|(?:expired|conflict|missing).*comparison/.test(
      type,
    )
  );
}

export function classifyAllocationProblem(error: unknown): AllocationKind {
  if (!(error instanceof ApiProblem)) return "generic";
  if (error.status === 429) return "rate-limit";
  const type = error.type?.toLowerCase() ?? "";
  if (/sync|synchroniz|library.*unavailable/.test(type)) {
    return "synchronization";
  }
  if (/eligible|eligibility|population.*insufficient/.test(type)) {
    return "eligibility";
  }
  if (/no.*(?:pair|comparison)|(?:pair|comparison).*unavailable/.test(type)) {
    return "no-pair";
  }
  return "generic";
}

function expiryState(
  expiresAt: string,
  now: number,
): { text: string; urgent: boolean } {
  const remaining = new Date(expiresAt).getTime() - now;
  const formatted = new Date(expiresAt).toLocaleString();
  if (remaining <= 0) {
    return { text: copy.compare.expiry.passed(formatted), urgent: true };
  }
  if (remaining <= 5 * 60_000) {
    return { text: copy.compare.expiry.soon(formatted), urgent: true };
  }
  return { text: copy.compare.expiry.open(formatted), urgent: false };
}

function ComparisonCard({
  comparison,
  side,
  disabled,
  onChoose,
}: {
  comparison: Comparison;
  side: "left" | "right";
  disabled: boolean;
  onChoose: () => void;
}) {
  const game = comparison[side];
  const shortcut = side === "left" ? "A" : "D";
  return (
    <button
      type="button"
      className={styles.comparisonCard}
      aria-label={`${game.name} choose ${side}`}
      disabled={disabled}
      onClick={onChoose}
    >
      <Artwork src={game.artworkUrl} name={game.name} />
      <span className={styles.comparisonCardBody}>
        <strong>{game.name}</strong>
        <span>
          Choose {side} <kbd>{shortcut}</kbd>
        </span>
      </span>
    </button>
  );
}

function ComparisonChoice({
  comparison,
  side,
  disabled,
  onChoose,
  onExclude,
}: {
  comparison: Comparison;
  side: "left" | "right";
  disabled: boolean;
  onChoose: () => void;
  onExclude: () => void;
}) {
  const game = comparison[side];
  return (
    <div className={styles.comparisonChoice}>
      <ComparisonCard
        comparison={comparison}
        side={side}
        disabled={disabled}
        onChoose={onChoose}
      />
      <div className={styles.comparisonUtilities}>
        <a
          className={styles.steamLink}
          href={steamStoreUrl(game.appId)}
          target="_blank"
          rel="noreferrer"
          aria-label={copy.compare.steam.label(game.name)}
        >
          {copy.compare.steam.action} <span aria-hidden="true">↗</span>
        </a>
        <button
          type="button"
          className={`${styles.secondaryButton} ${styles.excludeButton}`}
          aria-label={copy.compare.exclusion.label(game.name)}
          disabled={disabled}
          onClick={onExclude}
        >
          <span aria-hidden="true">×</span> {copy.compare.exclusion.action}
        </button>
      </div>
    </div>
  );
}

function AllocationRecovery({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  const kind = classifyAllocationProblem(error);
  const recovery = copy.compare.recovery[kind];
  return (
    <section
      className={styles.comparisonRecovery}
      aria-labelledby="recovery-title"
    >
      <p className={styles.eyebrow}>{recovery.eyebrow}</p>
      <h2 id="recovery-title">{recovery.title}</h2>
      <p>{recovery.detail}</p>
      {(kind === "synchronization" || kind === "eligibility") && (
        <Link className={styles.secondaryButton} to="/library">
          Open Library
        </Link>
      )}
      <ProblemNotice
        error={error}
        onRetry={onRetry}
        retryLabel="Try current comparison"
      />
    </section>
  );
}

export function ComparePage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [allocationAttempt, setAllocationAttempt] = useState(0);
  const [state, setState] = useState<SubmissionState>({ kind: "allocating" });
  const [now, setNow] = useState(Date.now);
  const submissionLock = useRef(false);
  const advanceTimer = useRef<number | undefined>(undefined);
  const allocation = useQuery({
    queryKey: ["comparison", "active", allocationAttempt],
    queryFn: ({ signal }) => getNextComparison(session, signal),
    enabled: state.kind === "allocating",
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    meta: { scope: "user" },
  });

  const requestCurrent = useCallback((previous?: Comparison) => {
    if (advanceTimer.current !== undefined) {
      window.clearTimeout(advanceTimer.current);
      advanceTimer.current = undefined;
    }
    submissionLock.current = false;
    setState({ kind: "allocating", previous });
    setAllocationAttempt((attempt) => attempt + 1);
  }, []);

  const interactiveComparison =
    state.kind === "allocating" && allocation.isSuccess
      ? allocation.data
      : state.kind === "exclusion-rejected"
        ? state.comparison
        : undefined;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(
    () => () => {
      if (advanceTimer.current !== undefined) {
        window.clearTimeout(advanceTimer.current);
      }
    },
    [],
  );

  const sendOutcome = useCallback(
    async (comparison: Comparison, outcome: ComparisonOutcome) => {
      setState({ kind: "submitting", comparison, outcome });
      try {
        const result = await submitComparisonResult(
          session,
          comparison.comparisonId,
          outcome,
        );
        await queryClient.invalidateQueries({
          queryKey: recommendationQueryKey,
        });
        setState({ kind: "recorded", comparison, result });
        advanceTimer.current = window.setTimeout(
          () => requestCurrent(comparison),
          450,
        );
      } catch (error) {
        setState(
          isStaleProblem(error)
            ? { kind: "stale", error }
            : { kind: "uncertain", comparison, outcome, error },
        );
      }
    },
    [queryClient, requestCurrent, session],
  );

  const finishExclusion = useCallback(
    (comparison: Comparison, game: Comparison["left"]) => {
      setState({ kind: "excluded", comparison, game });
      advanceTimer.current = window.setTimeout(
        () => requestCurrent(comparison),
        450,
      );
    },
    [requestCurrent],
  );

  const retireExcludedComparison = useCallback(
    async (comparison: Comparison, game: Comparison["left"]) => {
      setState({ kind: "retiring", comparison, game });
      try {
        await submitComparisonResult(session, comparison.comparisonId, "SKIP");
        finishExclusion(comparison, game);
      } catch (error) {
        if (isStaleProblem(error)) {
          finishExclusion(comparison, game);
        } else {
          setState({
            kind: "retirement-uncertain",
            comparison,
            game,
            error,
          });
        }
      }
    },
    [finishExclusion, session],
  );

  const sendExclusion = useCallback(
    async (comparison: Comparison, game: Comparison["left"]) => {
      setState({ kind: "excluding", comparison, game });
      try {
        await updateEligibility(session, game.appId, "EXCLUDED");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: libraryQueryKey }),
          queryClient.invalidateQueries({
            queryKey: personalLeaderboardQueryKey,
          }),
          queryClient.invalidateQueries({ queryKey: recommendationQueryKey }),
        ]);
        await retireExcludedComparison(comparison, game);
      } catch (error) {
        if (error instanceof ApiProblem) {
          submissionLock.current = false;
          setState({
            kind: "exclusion-rejected",
            comparison,
            game,
            error,
          });
        } else {
          setState({
            kind: "exclusion-uncertain",
            comparison,
            game,
            error,
          });
        }
      }
    },
    [queryClient, retireExcludedComparison, session],
  );

  const choose = useCallback(
    (outcome: ComparisonOutcome) => {
      if (!interactiveComparison || submissionLock.current) return;
      submissionLock.current = true;
      void sendOutcome(interactiveComparison, outcome);
    },
    [interactiveComparison, sendOutcome],
  );

  const exclude = useCallback(
    (game: Comparison["left"]) => {
      if (!interactiveComparison || submissionLock.current) return;
      submissionLock.current = true;
      void sendExclusion(interactiveComparison, game);
    },
    [interactiveComparison, sendExclusion],
  );

  const retryOutcome = useCallback(() => {
    if (state.kind !== "uncertain") return;
    void sendOutcome(state.comparison, state.outcome);
  }, [sendOutcome, state]);

  const retryExclusion = useCallback(() => {
    if (
      state.kind !== "exclusion-rejected" &&
      state.kind !== "exclusion-uncertain"
    )
      return;
    submissionLock.current = true;
    void sendExclusion(state.comparison, state.game);
  }, [sendExclusion, state]);

  const retryRetirement = useCallback(() => {
    if (state.kind !== "retirement-uncertain") return;
    void retireExcludedComparison(state.comparison, state.game);
  }, [retireExcludedComparison, state]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isInteractiveTarget(event.target)) return;
      const outcome = shortcuts[event.key.toLowerCase()];
      if (!outcome) return;
      event.preventDefault();
      choose(outcome);
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [choose]);

  const comparison =
    state.kind === "allocating"
      ? (allocation.data ?? state.previous)
      : state.kind === "stale"
        ? undefined
        : state.comparison;
  const locked = !interactiveComparison;
  const status = (() => {
    switch (state.kind) {
      case "allocating":
        return allocation.data
          ? copy.compare.status.ready
          : comparison
            ? copy.compare.loading
            : "";
      case "submitting":
        return copy.compare.status.submitting(outcomeLabels[state.outcome]);
      case "uncertain":
        return copy.compare.status.uncertain(outcomeLabels[state.outcome]);
      case "recorded":
        return state.result.outcome === "SKIP"
          ? copy.compare.status.skipped
          : copy.compare.status.recorded(outcomeLabels[state.result.outcome]);
      case "excluding":
        return copy.compare.exclusion.excluding(state.game.name);
      case "exclusion-rejected":
        return copy.compare.exclusion.rejected(state.game.name);
      case "exclusion-uncertain":
        return copy.compare.exclusion.uncertain(state.game.name);
      case "retiring":
        return copy.compare.exclusion.retiring(state.game.name);
      case "retirement-uncertain":
        return copy.compare.exclusion.retirementUncertain(state.game.name);
      case "excluded":
        return copy.compare.exclusion.excluded(state.game.name);
      default:
        return "";
    }
  })();
  const expiry = comparison
    ? expiryState(comparison.expiresAt, now)
    : undefined;

  return (
    <section className={styles.comparePage} aria-labelledby="compare-title">
      <header className={styles.compareHeader}>
        <p className={styles.eyebrow}>{copy.compare.eyebrow}</p>
        <h1 id="compare-title">{copy.routes.compare}</h1>
        <p className={styles.lede}>{copy.compare.summary}</p>
        <p className={styles.irreversible}>{copy.compare.irreversible}</p>
      </header>

      {state.kind === "allocating" && allocation.isPending && !comparison ? (
        <p role="status">{copy.compare.loading}</p>
      ) : state.kind === "allocating" && allocation.isError ? (
        <AllocationRecovery
          error={allocation.error}
          onRetry={() => requestCurrent()}
        />
      ) : state.kind === "stale" ? (
        <section className={styles.comparisonRecovery}>
          <p className={styles.eyebrow}>{copy.compare.stale.eyebrow}</p>
          <h2>{copy.compare.stale.title}</h2>
          <p>{copy.compare.stale.detail}</p>
          <ProblemNotice
            error={state.error}
            onRetry={() => requestCurrent()}
            retryLabel={copy.compare.stale.action}
          />
        </section>
      ) : comparison ? (
        <>
          {expiry?.urgent ? (
            <p className={styles.expiryWarning}>{expiry.text}</p>
          ) : null}
          <div className={styles.comparisonGrid}>
            <ComparisonChoice
              comparison={comparison}
              side="left"
              disabled={locked}
              onChoose={() => choose("LEFT_WIN")}
              onExclude={() => exclude(comparison.left)}
            />
            <div className={styles.comparisonActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                aria-label="Draw"
                disabled={locked}
                onClick={() => choose("DRAW")}
              >
                Draw <kbd>W</kbd>
              </button>
              <button
                type="button"
                className={styles.secondaryButton}
                aria-label="Skip"
                disabled={locked}
                onClick={() => choose("SKIP")}
              >
                Skip <kbd>S</kbd>
              </button>
            </div>
            <ComparisonChoice
              comparison={comparison}
              side="right"
              disabled={locked}
              onChoose={() => choose("RIGHT_WIN")}
              onExclude={() => exclude(comparison.right)}
            />
          </div>
          <p
            className={styles.comparisonStatus}
            role="status"
            aria-live="polite"
          >
            {status}
          </p>
          {state.kind === "uncertain" ? (
            <ProblemNotice
              error={state.error}
              onRetry={retryOutcome}
              retryLabel={copy.compare.retry(outcomeLabels[state.outcome])}
            />
          ) : null}
          {state.kind === "exclusion-rejected" ||
          state.kind === "exclusion-uncertain" ? (
            <ProblemNotice
              error={state.error}
              onRetry={retryExclusion}
              retryLabel={copy.compare.exclusion.retry(state.game.name)}
            />
          ) : null}
          {state.kind === "retirement-uncertain" ? (
            <ProblemNotice
              error={state.error}
              onRetry={retryRetirement}
              retryLabel={copy.compare.exclusion.retryRetirement(
                state.game.name,
              )}
            />
          ) : null}
          <details className={styles.comparisonDetails}>
            <summary>{copy.compare.details}</summary>
            <div className={styles.comparisonMeta}>
              <p>
                Comparison <code>{comparison.comparisonId}</code>
              </p>
              <p>{expiry?.text}</p>
            </div>
          </details>
          <details className={styles.comparisonDetails}>
            <summary>{copy.compare.shortcuts.title}</summary>
            <p>{copy.compare.shortcuts.detail}</p>
          </details>
        </>
      ) : null}
    </section>
  );
}
