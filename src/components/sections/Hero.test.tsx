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
    expect(h1.className).toContain("clamp(3rem,7vw,5rem)");
  });

  it("uses module accent eyebrow color", () => {
    render(<Hero accent="orange" eyebrow="Audit module" title="Audit complet" />);
    expect(screen.getByText("Audit module").className).toContain("text-accent-orange");
  });
});
