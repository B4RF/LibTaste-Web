import { type ReactNode, useEffect } from "react";
import { useLocation } from "react-router-dom";
import type { RuntimeConfig } from "../config";
import { copy } from "../content/copy";
import styles from "../styles/App.module.css";
import { startAuthentication } from "./pkce";
import { useAuth } from "./AuthContext";

export function ProtectedRoute({
  children,
  config,
}: {
  children: ReactNode;
  config: RuntimeConfig;
}) {
  const { status, restore } = useAuth();
  const location = useLocation();
  const destination = `${location.pathname}${location.search}${location.hash}`;

  useEffect(() => {
    if (status === "unknown") void restore();
  }, [restore, status]);

  if (status === "unknown" || status === "checking") {
    return <p role="status">{copy.protected.checking}</p>;
  }
  if (status === "signed-out") {
    return (
      <section
        className={styles.centeredPanel}
        aria-labelledby="protected-title"
      >
        <p className={styles.eyebrow}>{copy.protected.eyebrow}</p>
        <h1 id="protected-title">{copy.protected.title}</h1>
        <p>{copy.protected.summary}</p>
        <button
          className={styles.primaryButton}
          type="button"
          onClick={() => void startAuthentication(config, destination)}
        >
          {copy.landing.signIn}
        </button>
      </section>
    );
  }
  return children;
}
