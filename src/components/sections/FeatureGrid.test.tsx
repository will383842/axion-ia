import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeatureGrid } from "./FeatureGrid";

const items = [
  { id: "a", title: "Fast", description: "Optimized." },
  { id: "b", title: "Safe", description: "Hardened." },
  { id: "c", title: "Open", description: "MIT-licensed." },
];

describe("<FeatureGrid>", () => {
  it("renders one <li> per feature", () => {
    const { container } = render(<FeatureGrid items={items} />);
    expect(container.querySelectorAll("li").length).toBe(3);
  });

  it("renders the feature titles as h3", () => {
    render(<FeatureGrid items={items} />);
    expect(screen.getByRole("heading", { level: 3, name: "Fast" })).toBeTruthy();
  });

  it("respects columns prop class", () => {
    const { container } = render(<FeatureGrid items={items} columns={4} />);
    expect((container.firstChild as HTMLElement).className).toContain("lg:grid-cols-4");
  });
});
