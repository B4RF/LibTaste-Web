import { useEffect, useState } from "react";
import { App } from "./app/App";
import {
  loadRuntimeConfig,
  RuntimeConfigError,
  type RuntimeConfig,
} from "./config";
import { copy } from "./content/copy";
import styles from "./styles/App.module.css";

export function Bootstrap({
  load = loadRuntimeConfig,
}: {
  load?: () => Promise<RuntimeConfig>;
}) {
  const [config, setConfig] = useState<RuntimeConfig>();
  const [error, setError] = useState<RuntimeConfigError>();

  useEffect(() => {
    void load()
      .then(setConfig)
      .catch((reason: unknown) =>
        setError(
          reason instanceof RuntimeConfigError
            ? reason
            : new RuntimeConfigError(
                "Runtime configuration could not be loaded.",
              ),
        ),
      );
  }, [load]);

  if (error) {
    return (
      <main className={styles.configurationError}>
        <section role="alert" aria-labelledby="configuration-error-title">
          <p className={styles.eyebrow}>Configuration error</p>
          <h1 id="configuration-error-title">{copy.config.title}</h1>
          <p>{copy.config.summary}</p>
          <details>
            <summary>Operator details</summary>
            <p>{error.message}</p>
          </details>
        </section>
      </main>
    );
  }
  if (!config)
    return (
      <p className={styles.startup} role="status">
        Starting LibTaste…
      </p>
    );
  return <App config={config} />;
}
