import { ApiProblem } from "../api/problem";
import { copy } from "../content/copy";
import styles from "../styles/App.module.css";

export function ProblemNotice({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const problem = error instanceof ApiProblem ? error : undefined;
  return (
    <section
      className={styles.problem}
      role="alert"
      aria-labelledby="problem-title"
    >
      <h2 id="problem-title">{problem?.title ?? copy.errors.fallbackTitle}</h2>
      <p>{problem?.detail ?? copy.errors.fallbackDetail}</p>
      {onRetry ? (
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={onRetry}
        >
          {copy.errors.retry}
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
