import { describe, expect, it } from "vitest";

import { renderEmailTemplate } from "../index";

const INTERDITS = ["reproche", "objectif", "relance", "n'oubliez pas", "Grenoble", "gain garanti"];
const base = { prenom: "Claire", notifieeLe: "25 novembre 2026", effetLe: "25 décembre 2026" };
const FONDEMENTS = ["11.1-societe", "11.1-apporteur", "11.2", "12.5"] as const;

async function rendu(extra: Record<string, unknown>) {
  const r = await renderEmailTemplate("apporteur-resiliation-notifiee" as never, "fr", {
    ...base,
    ...extra,
  });
  return { ...r, t: r.text.replace(/\s+/g, " ") };
}

describe("apporteur-resiliation-notifiee", () => {
  for (const fondement of FONDEMENTS) {
    it(`${fondement} : date d'effet présente, aucun mot interdit`, async () => {
      const r = await rendu({
        fondement,
        motif: "Motif de test.",
        miseEnDemeureLe: "1 novembre 2026",
      });
      expect(r.t).toContain("25 décembre 2026");
      for (const mot of INTERDITS) expect(r.t.toLowerCase()).not.toContain(mot.toLowerCase());
    });
  }

  it("11.1 à l'initiative de la Société : texte de l'audit, sans motif", async () => {
    const r = await rendu({ fondement: "11.1-societe", motif: "NE DOIT PAS APPARAÎTRE" });
    expect(r.t).toContain("article 11.1");
    expect(r.t).toContain("continuer à nous présenter");
    expect(r.t).toContain("article 12.3");
    expect(r.t).toContain("article 12.2");
    expect(r.t).not.toContain("NE DOIT PAS APPARAÎTRE");
    expect(r.t.toLowerCase()).not.toContain("motif");
  });

  it("11.2 : porte le motif et la date de la mise en demeure", async () => {
    const r = await rendu({
      fondement: "11.2",
      motif: "Inexécution de l'article 8.",
      miseEnDemeureLe: "1 novembre 2026",
    });
    expect(r.t).toContain("article 11.2");
    expect(r.t).toContain("Inexécution de l'article 8.");
    expect(r.t).toContain("1 novembre 2026");
  });

  it("12.5 : porte le motif", async () => {
    const r = await rendu({ fondement: "12.5", motif: "Radiation constatée le 3 novembre 2026." });
    expect(r.t).toContain("article 12.5");
    expect(r.t).toContain("Radiation constatée le 3 novembre 2026.");
  });

  it("11.1 à l'initiative de l'apporteur : accusé de réception", async () => {
    const r = await rendu({ fondement: "11.1-apporteur" });
    expect(r.t).toContain("accusons réception");
    expect(r.t).toContain("25 novembre 2026");
  });

  it("salue par le prénom seul", async () => {
    const r = await rendu({ fondement: "11.1-societe", prenom: "Claire" });
    expect(r.t).toContain("Bonjour Claire,");
  });
});
