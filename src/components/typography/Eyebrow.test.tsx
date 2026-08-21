import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Eyebrow } from "./Eyebrow";

describe("<Eyebrow>", () => {
  it("renders uppercase styling by default", () => {
    render(<Eyebrow>label</Eyebrow>);
    const node = screen.getByText("label");
    expect(node.className).toContain("uppercase");
    expect(node.className).toContain("tracking-[0.1em]");
    expect(node.className).toContain("text-fg-muted");
  });

  // 🔴 2026-08-21 — ce test exigeait `text-accent-orange`. Mesuré sur le fond du
  // site, ce jeton rend 2,69:1 : il échoue AA même au seuil « texte large », alors
  // qu'un eyebrow est du texte à 0,8 rem. Le test verrouillait donc une violation.
  //
  // Il vérifie désormais ce qui compte — que la variante peint bien quelque chose,
  // et que ce quelque chose n'est PAS un accent réservé aux fonds. La liste noire
  // est explicite : `accent-purple` reste légitime (5,02:1), les cinq autres non.
  it("applique une couleur de module lisible, jamais un accent réservé aux fonds", () => {
    render(<Eyebrow variant="orange">audit</Eyebrow>);
    const classe = screen.getByText("audit").className;
    expect(classe, "la variante doit peindre quelque chose").toContain("text-warning");
    for (const inerte of [
      "text-accent-orange",
      "text-accent-green",
      "text-accent-yellow",
      "text-accent-pink",
      "text-accent-red",
    ]) {
      expect(classe, `${inerte} échoue AA sur le fond du site`).not.toContain(inerte);
    }
  });

  it("la variante « green » pointe sur sage, assombri pour AA par un sprint précédent", () => {
    render(<Eyebrow variant="green">cas concrets</Eyebrow>);
    expect(screen.getByText("cas concrets").className).toContain("text-sage");
  });

  it("applies primary variant for Module 1", () => {
    render(<Eyebrow variant="primary">interventions</Eyebrow>);
    expect(screen.getByText("interventions").className).toContain("text-primary");
  });
});
