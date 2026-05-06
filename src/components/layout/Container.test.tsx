import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Container } from "./Container";

describe("<Container>", () => {
  it("renders a div by default with the max-width and responsive padding", () => {
    render(<Container>hello</Container>);
    const node = screen.getByText("hello");
    expect(node.className).toContain("max-w-[1440px]");
    expect(node.className).toContain("mx-auto");
    expect(node.className).toContain("px-4");
  });

  it("supports `as` prop to render any element", () => {
    render(<Container as="section">section content</Container>);
    const node = screen.getByText("section content");
    expect(node.tagName).toBe("SECTION");
  });

  it("merges extra className", () => {
    render(<Container className="bg-primary">x</Container>);
    expect(screen.getByText("x").className).toContain("bg-primary");
  });
});
