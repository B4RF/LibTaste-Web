import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Bootstrap } from "./bootstrap";
import { RuntimeConfigError } from "./config";

describe("application bootstrap", () => {
  it("shows a clear configuration error without starting the application", async () => {
    const load = vi
      .fn()
      .mockRejectedValue(
        new RuntimeConfigError("webClientId is missing or empty."),
      );
    render(<Bootstrap load={load} />);
    expect(
      await screen.findByRole("heading", {
        name: "LibTaste is not configured",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /steam/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/site operator/i)).toBeVisible();
  });

  it("starts the public app after valid configuration loads", async () => {
    const load = vi
      .fn()
      .mockResolvedValue({ apiBaseUrl: "/api/v1", webClientId: "client" });
    render(<Bootstrap load={load} />);
    expect(screen.getByRole("status")).toHaveTextContent("Starting LibTaste");
    expect(
      await screen.findByRole("heading", { name: /games you truly love/i }),
    ).toBeVisible();
  });
});
