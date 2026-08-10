import { ApiProblem } from "../api/problem";
import { useId } from "react";
import { copy } from "../content/copy";
import styles from "../styles/App.module.css";

export function ProblemNotice({
  error,
  onRetry,
  retryLabel = copy.errors.retry,
}: {
  error: unknown;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  const titleId = useId();
  const problem = error instanceof ApiProblem ? error : undefined;
  return (
    <section className={styles.problem} role="alert" aria-labelledby={titleId}>
      <h2 id={titleId}>{problem?.title ?? copy.errors.fallbackTitle}</h2>
      <p>{problem?.detail ?? copy.errors.fallbackDetail}</p>
      {onRetry ? (
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={onRetry}
        >
          {retryLabel}
        </button>
      ) : null}
      {problem?.requestId ? (
        <details>
          <summary>{copy.errors.support}</summary>
          <p>
            {copy.errors.requestId}: <code>{problem.requestId}</code>
          </p>
        </details>
      ) : null}
    </section>
  );
}
