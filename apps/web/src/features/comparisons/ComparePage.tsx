import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ApiProblem } from "../../api/problem";
import { useAuth } from "../../auth/AuthContext";
import { Artwork } from "../../components/Artwork";
import { ProblemNotice } from "../../components/ProblemNotice";
import { copy } from "../../content/copy";
import styles from "../../styles/App.module.css";
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
  l: "LEFT_WIN",
  r: "RIGHT_WIN",
  d: "DRAW",
  s: "SKIP",
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
  const shortcut = side === "left" ? "L" : "R";
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

  const choose = useCallback(
    (outcome: ComparisonOutcome) => {
      if (
        state.kind !== "allocating" ||
        !allocation.data ||
        submissionLock.current
      )
        return;
      submissionLock.current = true;
      void sendOutcome(allocation.data, outcome);
    },
    [allocation.data, sendOutcome, state.kind],
  );

  const retryOutcome = useCallback(() => {
    if (state.kind !== "uncertain") return;
    void sendOutcome(state.comparison, state.outcome);
  }, [sendOutcome, state]);

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
      : state.kind === "submitting" ||
          state.kind === "uncertain" ||
          state.kind === "recorded"
        ? state.comparison
        : undefined;
  const locked = !(state.kind === "allocating" && allocation.isSuccess);
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
            <ComparisonCard
              comparison={comparison}
              side="left"
              disabled={locked}
              onChoose={() => choose("LEFT_WIN")}
            />
            <p className={styles.versus} aria-hidden="true">
              or
            </p>
            <ComparisonCard
              comparison={comparison}
              side="right"
              disabled={locked}
              onChoose={() => choose("RIGHT_WIN")}
            />
          </div>
          <div className={styles.comparisonActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              aria-label="Draw"
              disabled={locked}
              onClick={() => choose("DRAW")}
            >
              Draw <kbd>D</kbd>
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
