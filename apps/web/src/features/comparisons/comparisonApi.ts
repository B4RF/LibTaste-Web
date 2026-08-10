import type { SessionManager } from "../../api/client";
import type { components } from "../../api/generated";

export type Comparison = components["schemas"]["Comparison"];
export type ComparisonOutcome =
  components["schemas"]["ComparisonResultRequest"]["outcome"];
export type ComparisonResult = components["schemas"]["ComparisonResult"];

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export async function getNextComparison(
  session: SessionManager,
  signal?: AbortSignal,
): Promise<Comparison> {
  return readJson<Comparison>(
    await session.request("/comparisons/next", { method: "POST", signal }),
  );
}

export async function submitComparisonResult(
  session: SessionManager,
  comparisonId: string,
  outcome: ComparisonOutcome,
): Promise<ComparisonResult> {
  return readJson<ComparisonResult>(
    await session.request(
      `/comparisons/${encodeURIComponent(comparisonId)}/result`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      },
    ),
  );
}
