import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./badge";

describe("<Badge>", () => {
  it("renders neutral variant by default", () => {
    render(<Badge>NEW</Badge>);
    expect(screen.getByText("NEW").className).toContain("bg-border/60");
  });

  it("applies accent variant tint", () => {
    render(<Badge variant="accent">A</Badge>);
    expect(screen.getByText("A").className).toContain("text-primary");
  });

  it("is uppercase by default (Webflow doctrine)", () => {
    render(<Badge>x</Badge>);
    expect(screen.getByText("x").className).toContain("uppercase");
  });

});
