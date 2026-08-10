import { describe, expect, it } from "vitest";
import { toApiProblem } from "./problem";

describe("Problem Details", () => {
  it("uses only safe contracted fields", async () => {
    const problem = await toApiProblem(
      new Response(
        JSON.stringify({
          title: "Try later",
          detail: "Please retry.",
          requestId: "req-7",
          exception: "secret",
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/problem+json" },
        },
      ),
    );
    expect(problem).toMatchObject({
      status: 429,
      title: "Try later",
      detail: "Please retry.",
      requestId: "req-7",
    });
    expect(JSON.stringify(problem)).not.toContain("secret");
  });

  it("falls back safely for a malformed non-problem response", async () => {
    const problem = await toApiProblem(
      new Response("<html>no</html>", {
        status: 503,
        headers: { "X-Request-ID": "req-header" },
      }),
    );
    expect(problem.detail).toContain("could not complete");
    expect(problem.requestId).toBe("req-header");
  });
});
