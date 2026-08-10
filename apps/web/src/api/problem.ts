import type { components } from "./generated";

export type Problem = components["schemas"]["Problem"];

export class ApiProblem extends Error {
  readonly status: number;
  readonly title: string;
  readonly detail: string;
  readonly requestId?: string;

  constructor(
    status: number,
    title: string,
    detail: string,
    requestId?: string,
  ) {
    super(detail);
    this.name = "ApiProblem";
    this.status = status;
    this.title = title;
    this.detail = detail;
    this.requestId = requestId;
  }
}

export async function toApiProblem(response: Response): Promise<ApiProblem> {
  let body: Partial<Problem> = {};
  if (
    response.headers.get("content-type")?.includes("application/problem+json")
  ) {
    try {
      body = (await response.json()) as Partial<Problem>;
    } catch {
      body = {};
    }
  }

  const title = typeof body.title === "string" ? body.title : "Request failed";
  const detail =
    typeof body.detail === "string"
      ? body.detail
      : "LibTaste could not complete the request. Please try again.";
  const requestId =
    typeof body.requestId === "string"
      ? body.requestId
      : (response.headers.get("X-Request-ID") ?? undefined);
  return new ApiProblem(response.status, title, detail, requestId);
}
