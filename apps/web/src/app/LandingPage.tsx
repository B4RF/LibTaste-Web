import { Link } from "react-router-dom";
import type { RuntimeConfig } from "../config";
import { copy } from "../content/copy";
import styles from "../styles/App.module.css";
import { startAuthentication } from "../auth/pkce";

export function LandingPage({ config }: { config: RuntimeConfig }) {
  return (
    <section className={styles.hero} aria-labelledby="landing-title">
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>{copy.landing.eyebrow}</p>
        <h1 id="landing-title">{copy.landing.title}</h1>
        <p className={styles.lede}>{copy.landing.summary}</p>
        <div className={styles.actions}>
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => void startAuthentication(config)}
          >
            {copy.landing.signIn}
          </button>
          <Link className={styles.secondaryButton} to="/leaderboard/global">
            {copy.landing.leaderboard}
          </Link>
        </div>
        <p className={styles.privacyNote}>{copy.landing.privacy}</p>
      </div>
      <div className={styles.pairPreview} aria-label="Pairwise ranking example">
        <article>
          <span aria-hidden="true">01</span>
          <h2>Choose this one</h2>
          <p>Fast, instinctive comparisons</p>
        </article>
        <p aria-hidden="true">or</p>
        <article>
          <span aria-hidden="true">02</span>
          <h2>Choose that one</h2>
          <p>A ranking shaped by your taste</p>
        </article>
      </div>
    </section>
  );
}
