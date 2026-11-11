import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { Button, buttonVariants } from "./button";
import { Cta } from "@/components/marketing/Cta";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));


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
    expect(screen.getByRole("button").className).toContain("h-[52px]");
  });

  it("renders ghost variant without bg-primary", () => {
    render(<Button variant="ghost">G</Button>);
    expect(screen.getByRole("button").className).toContain("text-fg");
    expect(screen.getByRole("button").className).not.toContain("bg-primary ");
  });

  it("Cta porte exactement les classes de Button (V4-08)", () => {
    render(
      <>
        <Cta href="/contact">Cta</Cta>
        <Button asChild>
          <a href="https://example.com/">Bouton</a>
        </Button>
      </>,
    );
    const a = screen.getByRole("link", { name: "Cta" }).className;
    const b = screen.getByRole("link", { name: "Bouton" }).className;
    expect(a).toBe(b);
    expect(a).toBe(buttonVariants({}));
  });

  it("la barre mobile collante réutilise les classes de Button, sans décalage de mise en page", () => {
    const { container } = render(<StickyMobileCta href="#x" label="Réserver" />);
    const base = buttonVariants({}).split(" ");
    for (const lien of Array.from(container.querySelectorAll("a"))) {
      for (const c of base) expect(lien.className).toContain(c);
    }
    // Barre fixe : hors flux, donc aucun décalage (CLS) à l'apparition.
    expect(container.innerHTML).toContain("fixed");
  });
});
