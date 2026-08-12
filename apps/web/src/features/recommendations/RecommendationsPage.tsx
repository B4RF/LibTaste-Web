import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ApiProblem } from "../../api/problem";
import { useAuth } from "../../auth/AuthContext";
import { Artwork } from "../../components/Artwork";
import { ProblemNotice } from "../../components/ProblemNotice";
import { copy } from "../../content/copy";
import styles from "../../styles/App.module.css";
import {
  getRecommendations,
  recommendationQueryKey,
  type RecommendationEntry,
  type RecommendationResponse,
  type RecommendationSource,
} from "./recommendationApi";

const sourceLabels: Record<RecommendationSource, string> = {
  ITEM: copy.recommendations.sources.item,
  USER: copy.recommendations.sources.user,
  BLENDED: copy.recommendations.sources.blended,
};

function EmptyRecommendations({
  response,
}: {
  response: RecommendationResponse;
}) {
  if (response.status === "NO_CANDIDATES") {
    return (
      <section
        className={styles.recommendationEmpty}
        aria-labelledby="recommendation-empty-title"
      >
        <h2 id="recommendation-empty-title">
          {copy.recommendations.empty.exhausted.title}
        </h2>
        <p>{copy.recommendations.empty.exhausted.detail}</p>
      </section>
    );
  }

  if (response.status === "INSUFFICIENT_DATA") {
    const content = response.reason
      ? copy.recommendations.empty[response.reason]
      : copy.recommendations.empty.unknown;
    return (
      <section
        className={styles.recommendationEmpty}
        aria-labelledby="recommendation-empty-title"
      >
        <h2 id="recommendation-empty-title">{content.title}</h2>
        <p>{content.detail}</p>
        {content.compare ? (
          <Link className={styles.secondaryButton} to="/compare">
            {copy.recommendations.compare}
          </Link>
        ) : null}
      </section>
    );
  }

  return (
    <section
      className={styles.recommendationEmpty}
      aria-labelledby="recommendation-empty-title"
    >
      <h2 id="recommendation-empty-title">
        {copy.recommendations.empty.none.title}
      </h2>
      <p>{copy.recommendations.empty.none.detail}</p>
    </section>
  );
}

function RecommendationCard({ entry }: { entry: RecommendationEntry }) {
  const itemEvidence = entry.source === "ITEM" || entry.source === "BLENDED";
  const userEvidence = entry.source === "USER" || entry.source === "BLENDED";
  const headingId = `recommendation-${entry.appId}`;
  const becauseOf = itemEvidence ? (entry.becauseOf ?? []) : [];
  const omittedCount = Math.max(
    0,
    (itemEvidence ? (entry.becauseOfTotalCount ?? becauseOf.length) : 0) -
      becauseOf.length,
  );

  return (
    <article className={styles.recommendationCard} aria-labelledby={headingId}>
      <Artwork src={entry.artworkUrl} name={entry.name} />
      <div className={styles.recommendationCardBody}>
        <header>
          <p className={styles.recommendationSource}>
            {sourceLabels[entry.source]}
          </p>
          <h2 id={headingId}>{entry.name}</h2>
        </header>
        <p className={styles.predictedRank}>
          {copy.recommendations.predictedRank(entry.predictedRankPercentile)}
        </p>
        <ul
          className={styles.recommendationSupport}
          aria-label={copy.recommendations.supportLabel}
        >
          {userEvidence ? (
            <li>
              {copy.recommendations.playerSupport(entry.neighborSupportCount)}
            </li>
          ) : null}
          {itemEvidence ? (
            <li>{copy.recommendations.gameSupport(entry.seedSupportCount)}</li>
          ) : null}
        </ul>
        {itemEvidence ? (
          <section
            className={styles.becauseOf}
            aria-labelledby={`${headingId} ${headingId}-because-of`}
          >
            <h3 id={`${headingId}-because-of`}>
              {copy.recommendations.becauseOf}
            </h3>
            {becauseOf.length > 0 ? (
              <ul>
                {becauseOf.map((seed) => (
                  <li key={seed.appId}>
                    <Artwork src={seed.artworkUrl} name={seed.name} />
                    <span>
                      <strong>{seed.name}</strong>
                      <span>
                        {copy.recommendations.similarity(
                          seed.adjustedSimilarity,
                        )}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {omittedCount > 0 ? (
              <p>{copy.recommendations.more(omittedCount)}</p>
            ) : null}
          </section>
        ) : null}
        <a
          className={styles.secondaryButton}
          href={`https://store.steampowered.com/app/${entry.appId}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={copy.recommendations.steamLinkLabel(entry.name)}
        >
          {copy.recommendations.steamLink}
        </a>
      </div>
    </article>
  );
}

export function RecommendationsPage() {
  const { session } = useAuth();
  const recommendations = useQuery({
    queryKey: recommendationQueryKey,
    queryFn: ({ signal }) => getRecommendations(session, signal),
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    meta: { scope: "user" },
  });

  return (
    <section
      className={styles.recommendationsPage}
      aria-labelledby="recommendations-title"
    >
      <header className={styles.recommendationsHeader}>
        <p className={styles.eyebrow}>{copy.recommendations.eyebrow}</p>
        <h1 id="recommendations-title">{copy.routes.recommendations}</h1>
        <p className={styles.lede}>{copy.recommendations.introduction}</p>
      </header>

      {recommendations.isPending ? (
        <p role="status" aria-label={copy.recommendations.loading}>
          {copy.recommendations.loading}
        </p>
      ) : recommendations.isError ? (
        <div className={styles.recommendationError}>
          {recommendations.error instanceof ApiProblem &&
          recommendations.error.status === 429 ? (
            <>
              <p role="status">{copy.recommendations.rateLimited}</p>
              <ProblemNotice error={recommendations.error} />
            </>
          ) : (
            <ProblemNotice
              error={recommendations.error}
              onRetry={() => void recommendations.refetch()}
            />
          )}
        </div>
      ) : recommendations.data.status !== "OK" ||
        recommendations.data.recommendations.length === 0 ? (
        <EmptyRecommendations response={recommendations.data} />
      ) : (
        <div className={styles.recommendationGrid}>
          {recommendations.data.recommendations.map((entry) => (
            <RecommendationCard key={entry.appId} entry={entry} />
          ))}
        </div>
      )}
    </section>
  );
}
