import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Hero } from "./Hero";

describe("<Hero>", () => {
  it("renders eyebrow + h1 + description in order", () => {
    render(
      <Hero eyebrow="Module" title="Cabinet IA opérationnel" description="Concise tagline." />,
    );
    expect(screen.getByText("Module")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Cabinet IA");
    expect(screen.getByText("Concise tagline.")).toBeTruthy();
  });

  it("scales the title for the home variant", () => {
    render(<Hero variant="home" title="Big" />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.className).toContain("text-display-editorial");
  });

  it("uses module accent indicator dot color", () => {
    const { container } = render(
      <Hero accent="orange" eyebrow="Audit module" title="Audit complet" />,
    );
    // Indicator dot is the first <span> inside the eyebrow paragraph.
    const eyebrow = screen.getByText("Audit module");
    const dot = eyebrow.querySelector("span");
    expect(dot?.className).toContain("bg-accent-orange");
    // Also assert the markup did render the eyebrow text.
    expect(container.textContent).toContain("Audit module");
  });
});
