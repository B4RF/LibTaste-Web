import { describe, expect, it, vi } from "vitest";
import {
  loadRuntimeConfig,
  parseRuntimeConfig,
  RuntimeConfigError,
} from "./config";

describe("runtime configuration", () => {
  it("normalizes valid non-secret settings", () => {
    expect(
      parseRuntimeConfig({
        apiBaseUrl: "https://api.example.com/api/v1/",
        webClientId: " web-client ",
        environmentLabel: " Preview ",
      }),
    ).toEqual({
      apiBaseUrl: "https://api.example.com/api/v1",
      webClientId: "web-client",
      environmentLabel: "Preview",
    });
  });

  it.each([
    [null, "not an object"],
    [{ apiBaseUrl: "", webClientId: "client" }, "apiBaseUrl"],
    [{ apiBaseUrl: "file:///tmp/api", webClientId: "client" }, "HTTP or HTTPS"],
    [
      {
        apiBaseUrl: "https://name:secret@example.com/api",
        webClientId: "client",
      },
      "credentials",
    ],
    [{ apiBaseUrl: "https://api.example.com", webClientId: "" }, "webClientId"],
    [
      {
        apiBaseUrl: "https://api.example.com",
        webClientId: "client",
        environmentLabel: "",
      },
      "environmentLabel",
    ],
  ])("rejects malformed required settings", (value, message) => {
    expect(() => parseRuntimeConfig(value)).toThrow(message as string);
  });

  it("rejects mixed content for an HTTPS deployment", () => {
    expect(() =>
      parseRuntimeConfig(
        { apiBaseUrl: "http://api.example.com", webClientId: "client" },
        "https://web.example.com",
      ),
    ).toThrow("HTTPS API");
  });

  it("loads configuration without caching or ambient credentials", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ apiBaseUrl: "/api/v1", webClientId: "client" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const config = await loadRuntimeConfig(fetcher);
    expect(config.apiBaseUrl).toBe(`${window.location.origin}/api/v1`);
    expect(fetcher).toHaveBeenCalledWith("/config.json", {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  });

  it("reports a safe load failure", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("", { status: 500 }));
    await expect(loadRuntimeConfig(fetcher)).rejects.toBeInstanceOf(
      RuntimeConfigError,
    );
  });
});
