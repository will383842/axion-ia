import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./button";

describe("<Button>", () => {
  it("renders as <button> by default with primary variant", () => {
    render(<Button>Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.className).toContain("bg-primary");
    expect(btn.className).toContain("cta-lift");
  });

  it("supports asChild via Slot", () => {
    render(
      <Button asChild>
        <a href="/x">link</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "link" });
    expect(link.tagName).toBe("A");
    expect(link.className).toContain("bg-primary");
  });

  it("disables and shows spinner when loading", () => {
    render(<Button loading>Sending</Button>);
    const btn = screen.getByRole("button", { name: /Sending/ });
    expect(btn).toBeDisabled();
    expect(btn.querySelector('[role="status"]')).toBeTruthy();
  });

  it("respects size variant", () => {
    render(<Button size="lg">Big</Button>);
    expect(screen.getByRole("button").className).toContain("h-12");
  });

  it("renders ghost variant without bg-primary", () => {
    render(<Button variant="ghost">G</Button>);
    expect(screen.getByRole("button").className).toContain("text-fg");
    expect(screen.getByRole("button").className).not.toContain("bg-primary ");
  });

});
