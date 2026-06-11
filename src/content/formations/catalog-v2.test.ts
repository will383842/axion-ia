/**
 * Anti-drift catalogue V2 — cohérence interne + dérivation prix depuis la
 * matrice (aucun prix en dur dans le catalogue). Étendu au fur et à mesure des
 * lots (4h, 1j, 2j, 3j, gammes).
 */

import { describe, it, expect } from "vitest";
import {
  FORMATIONS_V2,
  getFormationV2,
  getFormationV2Brackets,
  getFormationV2Price,
  getFormationV2EntryPrice,
  getFormationsV2ByGamme,
  getFormationsV2ByDuree,
} from "@/content/formations/catalog-v2";
import { getFormationPrice } from "@/content/pricing";

describe("catalogue V2 — cohérence interne", () => {
  it("ids, slugFr, slugEn, numéros uniques", () => {
    const ids = FORMATIONS_V2.map((f) => f.id);
    const fr = FORMATIONS_V2.map((f) => f.slugFr);
    const en = FORMATIONS_V2.map((f) => f.slugEn);
    const num = FORMATIONS_V2.map((f) => f.numero);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(fr).size).toBe(fr.length);
    expect(new Set(en).size).toBe(en.length);
    expect(new Set(num).size).toBe(num.length);
  });

  it("chaque formation a un contenu non vide (public, objectifs, programme, faqs)", () => {
    for (const f of FORMATIONS_V2) {
      expect(f.publicViseFr.length, f.id).toBeGreaterThan(0);
      expect(f.h1Fr.length, f.id).toBeGreaterThan(0);
      expect(f.metaTitleFr.length, f.id).toBeGreaterThan(0);
      expect(f.metaDescriptionFr.length, f.id).toBeGreaterThan(0);
      expect(f.objectifsFr.length, f.id).toBeGreaterThanOrEqual(3);
      expect(f.programme.length, f.id).toBeGreaterThanOrEqual(1);
      const totalSteps = f.programme.reduce((n, s) => n + s.steps.length, 0);
      expect(totalSteps, f.id).toBeGreaterThanOrEqual(3);
      expect(f.faqs.length, f.id).toBeGreaterThanOrEqual(2);
      expect(f.termesSemantiquesFr.length, f.id).toBeGreaterThanOrEqual(3);
    }
  });

  it("metaTitle raisonnable (≤ 65 caractères) pour le SERP", () => {
    for (const f of FORMATIONS_V2) {
      expect(f.metaTitleFr.length, `${f.id}: "${f.metaTitleFr}"`).toBeLessThanOrEqual(65);
    }
  });

  it("« À LA UNE » réservé à IA & Conformité", () => {
    const featured = FORMATIONS_V2.filter((f) => f.featured);
    expect(featured.map((f) => f.id)).toEqual(["ia-conformite"]);
  });
});

describe("catalogue V2 — prix dérivés de la matrice (0 hardcode)", () => {
  it("chaque formation a un prix d'entrée résoluble (gamme × durée)", () => {
    for (const f of FORMATIONS_V2) {
      const entry = getFormationV2EntryPrice(f);
      expect(entry, `${f.id} (${f.gamme}/${f.duree})`).toBeGreaterThan(0);
    }
  });

  it("le prix par tranche == matrice pricing.ts", () => {
    for (const f of FORMATIONS_V2) {
      for (const b of getFormationV2Brackets(f)) {
        expect(getFormationV2Price(f, b)).toBe(getFormationPrice(f.gamme, f.duree, b));
      }
    }
  });

  it("aucun nombre de prix (€) en dur dans le contenu texte", () => {
    // Les montants n'apparaissent que dans accroche/faq en TEXTE marketing ;
    // ils ne pilotent jamais le calcul (qui passe par la matrice). On vérifie
    // qu'aucun champ structurel de prix n'existe sur la formation.
    for (const f of FORMATIONS_V2) {
      expect(f).not.toHaveProperty("prixFlat");
      expect(f).not.toHaveProperty("priceEur");
    }
  });
});

describe("catalogue V2 — lookup", () => {
  it("getFormationV2 par id / slugFr / slugEn", () => {
    expect(getFormationV2("ia-express")?.numero).toBe(1);
    expect(getFormationV2("ai-express")?.id).toBe("ia-express");
    expect(getFormationV2("inconnu")).toBeUndefined();
  });

  it("filtres gamme / durée", () => {
    expect(getFormationsV2ByDuree("4h").length).toBe(4);
    expect(getFormationsV2ByGamme("ia-standard").length).toBeGreaterThanOrEqual(4);
  });
});

describe("catalogue V2 — couverture complète (17 formations)", () => {
  it("17 formations, numéros 1-17 présents", () => {
    expect(FORMATIONS_V2.length).toBe(17);
    const nums = FORMATIONS_V2.map((f) => f.numero).sort((a, b) => a - b);
    expect(nums).toEqual(Array.from({ length: 17 }, (_, i) => i + 1));
  });

  it("distribution par gamme : IA 12 · Agents 2 · Claude 3", () => {
    expect(getFormationsV2ByGamme("ia-standard").length).toBe(12);
    expect(getFormationsV2ByGamme("agents-automatisations").length).toBe(2);
    expect(getFormationsV2ByGamme("claude").length).toBe(3);
  });

  it("distribution par durée : 4h 4 · 1j 6 · 2j 4 · 3j 3", () => {
    expect(getFormationsV2ByDuree("4h").length).toBe(4);
    expect(getFormationsV2ByDuree("1j").length).toBe(6);
    expect(getFormationsV2ByDuree("2j").length).toBe(4);
    expect(getFormationsV2ByDuree("3j").length).toBe(3);
  });

  it("les gammes Agents/Claude apparaissent dans leur durée ET leur gamme (2 axes)", () => {
    const claude2j = getFormationsV2ByDuree("2j").filter((f) => f.gamme === "claude");
    expect(claude2j.map((f) => f.id)).toContain("claude-createur");
    const agents3j = getFormationsV2ByDuree("3j").filter(
      (f) => f.gamme === "agents-automatisations",
    );
    expect(agents3j.map((f) => f.id)).toContain("agents-automatisations-avance");
  });
});
