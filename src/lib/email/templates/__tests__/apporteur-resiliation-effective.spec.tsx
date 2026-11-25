import { describe, expect, it } from "vitest";

import { renderEmailTemplate } from "../index";

const INTERDITS = ["reproche", "objectif", "relance", "n'oubliez pas", "Grenoble", "gain garanti"];

async function rendu(payload: Record<string, unknown>) {
  const r = await renderEmailTemplate("apporteur-resiliation-effective" as never, "fr", payload);
  return { ...r, t: r.text.replace(/\s+/g, " "), html: r.html };
}

describe("apporteur-resiliation-effective", () => {
  it("dit la prise d'effet et les commissions acquises, sans mot interdit", async () => {
    const r = await rendu({ prenom: "Claire", effetLe: "25 décembre 2026" });
    expect(r.t).toContain("25 décembre 2026");
    expect(r.t).toContain("article 12.3");
    expect(r.t).toContain("article 12.2");
    for (const mot of INTERDITS) expect(r.t.toLowerCase()).not.toContain(mot.toLowerCase());
  });

  it("sans argent en jeu : aucun lien", async () => {
    const r = await rendu({ prenom: "Claire", effetLe: "25 décembre 2026" });
    expect(r.html).not.toContain("https://exemple.test/espace");
  });

  it("argent en jeu : porte le lien du mode restreint", async () => {
    const r = await rendu({
      prenom: "Claire",
      effetLe: "25 décembre 2026",
      argentEnJeu: true,
      lien: "https://exemple.test/espace",
    });
    expect(r.html).toContain("https://exemple.test/espace");
  });

  it("salue par le prénom seul", async () => {
    const r = await rendu({ prenom: "Claire", effetLe: "25 décembre 2026" });
    expect(r.t).toContain("Bonjour Claire,");
  });
});
