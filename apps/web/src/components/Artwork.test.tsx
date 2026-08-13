import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Artwork } from "./Artwork";

describe("Artwork", () => {
  it("renders a neutral accessible fallback when artwork is absent", () => {
    render(<Artwork name="Portal" />);
    expect(
      screen.getByRole("img", { name: "Portal artwork unavailable" }),
    ).toBeVisible();
  });

  it("replaces a failed image without exposing broken image text", () => {
    render(<Artwork name="Portal" src="https://cdn.example.test/portal.jpg" />);
    fireEvent.error(screen.getByRole("img", { name: "Portal artwork" }));
    expect(
      screen.getByRole("img", { name: "Portal artwork unavailable" }),
    ).toBeVisible();
    expect(screen.queryByAltText("Portal artwork")).not.toBeInTheDocument();
  });

  it("loads an avatar URL that arrives after the profile request", () => {
    const { rerender } = render(<Artwork kind="avatar" name="Test Pilot" />);
    expect(
      screen.getByRole("img", { name: "Test Pilot avatar unavailable" }),
    ).toBeVisible();

    rerender(
      <Artwork
        kind="avatar"
        name="Test Pilot"
        src="https://cdn.example.test/avatar.jpg"
      />,
    );

    expect(
      screen.getByRole("img", { name: "Test Pilot avatar" }),
    ).toHaveAttribute("src", "https://cdn.example.test/avatar.jpg");
  });
});
