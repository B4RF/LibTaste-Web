import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ApiProblem } from "../api/problem";
import type { RuntimeConfig } from "../config";
import { ProblemNotice } from "../components/ProblemNotice";
import { copy } from "../content/copy";
import styles from "../styles/App.module.css";
import { useAuth } from "./AuthContext";
import { consumeAuthTransaction, startAuthentication } from "./pkce";

export function CallbackPage({ config }: { config: RuntimeConfig }) {
  const { session } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const started = useRef(false);
  const [error, setError] = useState<unknown>();

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const code = params.get("code");
    const transaction = consumeAuthTransaction();
    if (!code || !transaction) {
      queueMicrotask(() =>
        setError(
          new ApiProblem(
            400,
            copy.callback.invalidTitle,
            copy.callback.invalidDetail,
          ),
        ),
      );
      return;
    }

    void session
      .exchangeCode(code, transaction.verifier)
      .then(() => navigate(transaction.destination, { replace: true }))
      .catch((reason: unknown) => setError(reason));
  }, [navigate, params, session]);

  if (error) {
    return (
      <div className={styles.centeredPanel}>
        <ProblemNotice
          error={error}
          onRetry={() => void startAuthentication(config)}
        />
      </div>
    );
  }
  return <p role="status">{copy.callback.working}</p>;
}
