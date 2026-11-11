import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
    const base = buttonVariants({}).split(/\s+/).filter(Boolean);
    for (const lien of Array.from(container.querySelectorAll("a"))) {
      const classes = new Set(lien.className.split(/\s+/));
      for (const c of base) expect(classes.has(c), c).toBe(true);
    }
    // Barre fixe : le conteneur du lien est hors flux et masqué par transform seul.
    const barre = container.querySelector("a")!.closest("div[aria-hidden]") as HTMLElement;
    expect(barre.className).toMatch(/(^|\s)fixed(\s|$)/);
    expect(barre.className).toContain("translate-y-full");
    expect(barre.className).toContain("transition-transform");
    const toutes = [barre, ...Array.from(barre.querySelectorAll("div"))]
      .map((d) => d.className)
      .join(" ");
    expect(toutes).not.toMatch(/(^|\s)(min-)?h-/);
    expect(toutes).not.toMatch(/transition-(all|\[)/);
  });

  it("la variante link n'est pas une boîte de 52 px", () => {
    render(<Button variant="link">Lien</Button>);
    const c = screen.getByRole("button").className.split(/\s+/);
    expect(c).toContain("h-auto");
    expect(c).toContain("px-0");
    expect(c).not.toContain("h-[52px]");
    expect(c).not.toContain("px-5");
  });

  it("la barre mobile n'importe ni Button, ni cn, ni clsx, ni tailwind-merge, ni cva", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/marketing/StickyMobileCta.tsx"),
      "utf8",
    );
    const imports = source.match(/^\s*import[^;]*?from\s+["'][^"']+["']/gm) ?? [];
    expect(imports.length).toBeGreaterThan(0);
    for (const interdit of [
      "@/components/ui/button",
      "@/lib/utils",
      "clsx",
      "tailwind-merge",
      "class-variance-authority",
    ]) {
      for (const ligne of imports) {
        expect(ligne, interdit).not.toContain(`"${interdit}"`);
      }
      expect(source, interdit).not.toMatch(new RegExp(`from\\s+["']${interdit}["']`));
    }
  });

  it("la barre mobile reste alignée sur Button : chaque classe de la variante est présente (terracotta et défaut)", () => {
    for (const [couleur, variant] of [
      ["terracotta", "terracotta"],
      [undefined, "primary"],
    ] as const) {
      const { container, unmount } = render(
        <StickyMobileCta href="#x" label="Réserver" {...(couleur ? { couleur } : {})} />,
      );
      const attendu = buttonVariants({ variant }).split(/\s+/).filter(Boolean);
      const liens = Array.from(container.querySelectorAll("a"));
      expect(liens.length).toBe(2);
      for (const lien of liens) {
        const classes = new Set(lien.className.split(/\s+/));
        for (const c of attendu) expect(classes.has(c), `${variant}: ${c}`).toBe(true);
        if (couleur === "terracotta") {
          expect(classes.has("focus-visible:ring-terracotta")).toBe(true);
          expect(classes.has("focus-visible:ring-primary")).toBe(false);
          expect(classes.has("text-paper")).toBe(true);
        }
      }
      unmount();
    }
  });
});
