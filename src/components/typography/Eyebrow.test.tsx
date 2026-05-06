import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Eyebrow } from "./Eyebrow";

describe("<Eyebrow>", () => {
  it("renders uppercase styling by default", () => {
    render(<Eyebrow>label</Eyebrow>);
    const node = screen.getByText("label");
    expect(node.className).toContain("uppercase");
    expect(node.className).toContain("tracking-[0.1em]");
    expect(node.className).toContain("text-gray-700");
  });

  it("applies module variant color", () => {
    render(<Eyebrow variant="orange">audit</Eyebrow>);
    expect(screen.getByText("audit").className).toContain("text-accent-orange");
  });

  it("applies primary variant for Module 1", () => {
    render(<Eyebrow variant="primary">interventions</Eyebrow>);
    expect(screen.getByText("interventions").className).toContain("text-primary");
  });
});
