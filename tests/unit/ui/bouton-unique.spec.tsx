/**
 * V4-07 — Bouton unique : 52 px de haut, rayon 12 px (jeton `rounded-lg`),
 * focus visible, cible tactile >= 48 px. Aucune couleur bleue ou jaune.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button, buttonVariants } from "@/components/ui/button";

const TAILLES = ["sm", "md", "lg", "xl", "icon"] as const;
const FORMES = ["rounded", "pill"] as const;
// Toutes les variantes sauf `link`, qui n'est pas une boîte de 52 px.
const VARIANTES_BOITE = [
  "primary",
  "secondary",
  "ghost",
  "outline",
  "terracotta",
  "destructive",
] as const;

function hauteursClasses(classes: string): string[] {
  return classes.split(/\s+/).filter((c) => /^(min-)?h-/.test(c));
}

describe("Button — bouton unique", () => {
  it("toute taille et toute forme donnent 52 px de haut et un rayon de 12 px", () => {
    for (const size of TAILLES) {
      for (const shape of FORMES) {
        const c = buttonVariants({ size, shape });
        expect(c, `${size}/${shape}`).toContain("h-[52px]");
        expect(c, `${size}/${shape}`).toContain("rounded-lg");
        expect(c, `${size}/${shape}`).not.toMatch(/rounded-(full|md|xl|2xl|sm)\b/);
        expect(c, `${size}/${shape}`).not.toMatch(/(^|\s)h-(9|11|12|14)(\s|$)/);
      }
    }
  });

  it("la cible tactile est d'au moins 48 px, sans autre h-* ni min-h-* dans toute la chaîne", () => {
    for (const variant of VARIANTES_BOITE) {
      for (const size of TAILLES) {
        for (const shape of FORMES) {
          const c = buttonVariants({ variant, size, shape });
          const etiquette = `${variant}/${size}/${shape}`;
          const hs = hauteursClasses(c);
          // Une seule classe de hauteur, et c'est h-[52px] : rien avant, rien après.
          expect(hs, etiquette).toEqual(["h-[52px]"]);
          expect(Number(c.match(/(?:^|\s)h-\[(\d+)px\]/)![1]), etiquette).toBeGreaterThanOrEqual(
            48,
          );
        }
      }
    }
    expect(buttonVariants({ size: "icon" })).toContain("w-[52px]");
  });

  it("le focus clavier est visible (anneau terracotta décalé)", () => {
    const c = buttonVariants({});
    expect(c).toContain("focus-visible:ring-2");
    expect(c).toContain("focus-visible:ring-offset-2");
    expect(c).toContain("focus-visible:ring-primary");
    // L'anneau du bouton terracotta lui est propre (#B23F16), sans ring-primary.
    const t = buttonVariants({ variant: "terracotta" });
    expect(t).toContain("focus-visible:ring-terracotta");
    expect(t).not.toContain("ring-primary");
    expect(t).toContain("text-paper");
    expect(c).not.toContain("focus-visible:ring-0");
  });

  it("le bouton principal est terracotta, texte blanc, survol #8F3412 (jetons)", () => {
    const c = buttonVariants({ variant: "primary" });
    expect(c).toContain("bg-primary");
    expect(c).toContain("text-primary-fg");
    expect(c).toContain("hover:bg-primary-hover");
  });

  it("aucune classe bleue, jaune ou dégradé", () => {
    const tout = [
      ...(
        ["primary", "secondary", "ghost", "outline", "terracotta", "link", "destructive"] as const
      ).map((variant) => buttonVariants({ variant })),
    ].join(" ");
    expect(tout).not.toMatch(/blue|indigo|sky|yellow|amber|gradient/i);
  });

  it("se rend avec la hauteur unique, et asChild la garde", () => {
    render(
      <>
        <Button>Réserver</Button>
        <Button asChild>
          <a href="https://example.com/">Lien</a>
        </Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Réserver" }).className).toContain("h-[52px]");
    expect(screen.getByRole("link", { name: "Lien" }).className).toContain("h-[52px]");
  });
});
