import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Price } from "./Price";

describe("<Price>", () => {
  it("formats EUR by default", () => {
    const { container } = render(<Price amount={490} />);
    expect(container.textContent).toContain("490");
    expect(container.textContent).toContain("€");
  });

  it("uses tabular numerals (font-feature-settings tnum)", () => {
    const { container } = render(<Price amount={1290} />);
    // Walk the rendered span tree and assert at least one wrapper carries the
    // tnum utility class (Tailwind passes the literal string through to DOM).
    const hasTnum = Array.from(container.querySelectorAll("span")).some((s) =>
      s.className.includes("[font-feature-settings:'tnum']"),
    );
    expect(hasTnum).toBe(true);
  });

  it("renders suffix when provided", () => {
    render(<Price amount={490} suffix="HT" />);
    expect(screen.getByText("HT")).toBeTruthy();
  });

  it("supports USD currency", () => {
    const { container } = render(<Price amount={100} currency="USD" />);
    expect(container.textContent).toContain("$");
  });
});
