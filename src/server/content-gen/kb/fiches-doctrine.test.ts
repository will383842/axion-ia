/**
 * Fiches KB : faits AI Act corrigés, cible PME, aucune mention de Grenoble.
 * Audit knowledge du 08/11/2026 (lot R2, PR 1). Module pur, sans base.
 */
import { describe, it, expect } from "vitest";
import { KB_AUDITS } from "./audits";
import { KB_INTERVENTIONS_FORMATIONS } from "./interventions-formations";
import { KB_UN_A_UN } from "./un-a-un";
import { KB_IMPLEMENTATIONS } from "./implementations";
import { KB_SITES_WEB_AUGMENTES } from "./sites-web-augmentes";
import { KB_VILLES_ALL } from "./villes-facts";
import type { KbFact } from "./audits";

const TOUS: readonly KbFact[] = [
  ...KB_AUDITS,
  ...KB_INTERVENTIONS_FORMATIONS,
  ...KB_UN_A_UN,
  ...KB_IMPLEMENTATIONS,
  ...KB_SITES_WEB_AUGMENTES,
  ...KB_VILLES_ALL,
];
const parId = (id: string): KbFact => {
  const f = TOUS.find((x) => x.id === id);
  if (!f) throw new Error(`fiche ${id} absente`);
  return f;
};

describe("faits AI Act corrigés", () => {
  it("audit-002 : plus de « impose depuis août 2026 », renvoi vers EUR-Lex", () => {
    const t = parId("audit-002").text;
    expect(t).not.toMatch(/impose depuis août 2026/);
    expect(t).toMatch(/EUR-Lex/);
  });
  it("audit-020 : l'art. 13 vise le fournisseur, pas un audit XAI obligatoire", () => {
    const t = parId("audit-020").text;
    expect(t).not.toMatch(/critère d'audit obligatoire/);
    expect(t).toMatch(/fournisseurs?/);
  });
  it("audit-026 : l'art. 50 ne vise pas « tout contenu généré par IA »", () => {
    const t = parId("audit-026").text;
    expect(t).not.toMatch(/tout contenu généré par IA/);
    expect(t).not.toMatch(/applicable depuis le 2 août 2026/);
  });
  it("audit-046 : pas d'« audit annuel obligatoire »", () => {
    expect(parId("audit-046").text).not.toMatch(/audit annuel obligatoire/);
    expect(parId("audit-046").text).toMatch(/ne prévoit pas/);
  });
  it("form-059 : l'art. 4 vise tous les systèmes, pas seulement le haut risque", () => {
    const t = parId("form-059").text;
    expect(t).not.toMatch(/dès 2025/);
    expect(t).toMatch(/tous les systèmes d'IA/);
  });
  it("ai-act-019 : l'analyse d'impact (art. 27) ne vise pas les RH privées", () => {
    const t = parId("ai-act-019").text;
    expect(t).not.toMatch(/exige que les systèmes IA haut risque dans les RH/);
    expect(t).toMatch(/art\. 27/);
  });
  it("ai-act-001 : pas d'obligation haut risque « depuis le 2 août 2026 »", () => {
    expect(parId("ai-act-001").text).not.toMatch(/haut risque depuis le 2 août 2026/);
  });
  it("aucun fait ne date une obligation AI Act de « depuis août 2026 »", () => {
    for (const f of TOUS) {
      expect(f.text, f.id).not.toMatch(/AI Act[^.]*depuis (le 2 )?août 2026/i);
    }
  });
});

describe("cible PME, aucune mention de Grenoble", () => {
  it("aucune fiche ne vise les ETI (texte du fait)", () => {
    const fautifs = TOUS.filter((f) => /(^|[^a-zA-Z])ETI([^a-zA-Z]|$)/.test(f.text)).map(
      (f) => f.id,
    );
    expect(fautifs).toEqual([]);
  });
  it("audit-054 : plus d'offre « Audit ETI »", () => {
    expect(parId("audit-054").text).not.toMatch(/ETI|audit-strategique-eti/);
  });
  it("aucune fiche ne mentionne Grenoble", () => {
    const fautifs = TOUS.filter((f) => /grenobl/i.test(`${f.text} ${f.source} ${f.sourceUrl}`)).map(
      (f) => f.id,
    );
    expect(fautifs).toEqual([]);
  });
  it("les ids restent uniques", () => {
    expect(new Set(TOUS.map((f) => f.id)).size).toBe(TOUS.length);
  });
});
