import type { SessionManager } from "../../api/client";
import type { components } from "../../api/generated";

export type RecommendationResponse =
  components["schemas"]["RecommendationResponse"];
export type RecommendationEntry = components["schemas"]["RecommendationEntry"];
export type RecommendationBecauseOf =
  components["schemas"]["RecommendationBecauseOf"];
export type RecommendationSource =
  components["schemas"]["RecommendationSource"];

export const recommendationQueryKey = ["recommendations"] as const;

export async function getRecommendations(
  session: SessionManager,
  signal?: AbortSignal,
): Promise<RecommendationResponse> {
  const response = await session.request("/me/recommendations", { signal });
  return (await response.json()) as RecommendationResponse;
}
