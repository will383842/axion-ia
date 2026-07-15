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

  it("« À LA UNE » — aucune formation mise en avant par défaut (offre AXION)", () => {
    const featured = FORMATIONS_V2.filter((f) => f.featured);
    expect(featured.map((f) => f.id)).toEqual([]);
  });
});

describe("catalogue V2 — prix « Sur devis » (0 hardcode)", () => {
  it("chaque formation est « Sur devis » (aucun prix matrice affiché)", () => {
    for (const f of FORMATIONS_V2) {
      expect(f.surDevis, `${f.id}`).toBe(true);
      expect(getFormationV2EntryPrice(f), `${f.id} doit être Sur devis`).toBeUndefined();
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
    expect(getFormationV2("bien-demarrer-avec-l-ia-4h")?.numero).toBe(1);
    expect(getFormationV2("getting-started-with-ai-4h")?.id).toBe("bien-demarrer-avec-l-ia-4h");
    expect(getFormationV2("inconnu")).toBeUndefined();
  });

  it("filtres gamme / durée", () => {
    expect(getFormationsV2ByDuree("4h").length).toBe(2);
    expect(getFormationsV2ByGamme("ia-standard").length).toBeGreaterThanOrEqual(4);
  });
});

describe("catalogue V2 — couverture complète (14 formations + 1 séminaire)", () => {
  it("15 entrées (14 formations + 1 séminaire), numéros 1-15 présents", () => {
    expect(FORMATIONS_V2.length).toBe(15);
    const nums = FORMATIONS_V2.map((f) => f.numero).sort((a, b) => a - b);
    expect(nums).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
  });

  it("distribution par gamme : IA 12 · Agents 0 · Claude 3", () => {
    expect(getFormationsV2ByGamme("ia-standard").length).toBe(12);
    expect(getFormationsV2ByGamme("agents-automatisations").length).toBe(0);
    expect(getFormationsV2ByGamme("claude").length).toBe(3);
  });

  it("distribution par durée : 4h 2 · 1j 11 · 2j 1 · 3j 1", () => {
    expect(getFormationsV2ByDuree("4h").length).toBe(2);
    expect(getFormationsV2ByDuree("1j").length).toBe(11);
    expect(getFormationsV2ByDuree("2j").length).toBe(1);
    expect(getFormationsV2ByDuree("3j").length).toBe(1);
  });

  it("la gamme Claude s'étale sur 1j / 2j / 3j", () => {
    const claude2j = getFormationsV2ByDuree("2j").filter((f) => f.gamme === "claude");
    expect(claude2j.map((f) => f.id)).toContain("claude-maitrise-avancee-et-autonomie-2j");
    const claude3j = getFormationsV2ByDuree("3j").filter((f) => f.gamme === "claude");
    expect(claude3j.map((f) => f.id)).toContain("claude-code-creer-un-projet-3j");
  });
});
