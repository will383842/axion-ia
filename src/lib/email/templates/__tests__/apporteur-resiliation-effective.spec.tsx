import { describe, expect, it } from "vitest";

import { COPY_RESILIATION_EFFECTIVE } from "../apporteur-resiliation-effective";
import { renderEmailTemplate } from "../index";

const INTERDITS = ["reproche", "objectif", "relance", "n'oubliez pas"];

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

  it("ne dit jamais que l'espace reste accessible : le lien est coupé à la fin du contrat", async () => {
    for (const argentEnJeu of [false, true]) {
      const r = await rendu({
        prenom: "Claire",
        effetLe: "25 décembre 2026",
        argentEnJeu,
        lien: "https://exemple.test/espace",
      });
      expect(r.t).not.toContain("reste accessible");
      expect(r.t).toContain("Votre accès à l'espace prend fin avec votre contrat");
      expect(r.html).not.toContain("https://exemple.test/espace");
    }
  });

  it("dit que autofactures, avoirs et décomptes continuent d'arriver par e-mail (art. 12.3) : la coupure de l'espace n'est pas celle des commissions", async () => {
    for (const argentEnJeu of [false, true]) {
      const r = await rendu({ prenom: "Claire", effetLe: "25 décembre 2026", argentEnJeu });
      expect(r.t).toContain("autofactures, vos avoirs et vos décomptes");
      expect(r.t).toContain("par e-mail");
    }
  });

  it("salue par le prénom seul", async () => {
    const r = await rendu({ prenom: "Claire", effetLe: "25 décembre 2026" });
    expect(r.t).toContain("Bonjour Claire,");
  });
});

describe("textes du gabarit : mots exclus", () => {
  it("ne contient ni « Grenoble » ni « gain garanti »", () => {
    const s = JSON.stringify(Object.values(COPY_RESILIATION_EFFECTIVE).map(String)).toLowerCase();
    expect(s).not.toContain("grenoble");
    expect(s).not.toContain("gain garanti");
    expect(s).not.toContain("aucun gain");
  });
});
