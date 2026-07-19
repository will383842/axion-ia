/**
 * Anti-drift catalogue — cohérence interne + dérivation prix depuis la matrice
 * (aucun prix structurel en dur dans le catalogue). Refonte 2026-07-19 :
 * 21 formations (4 générales + 9 métiers + 8 secteurs) + 1 séminaire conservé,
 * prix PUBLICS fixes par groupe (catégorie × durée).
 */

import { describe, it, expect } from "vitest";
import {
  FORMATIONS_V2,
  getFormationsV2,
  getSeminairesV2,
  getFormationV2,
  getFormationV2Brackets,
  getFormationV2Price,
  getFormationV2EntryPrice,
  getFormationsV2ByCategorie,
  getFormationsV2ByDuree,
} from "@/content/formations/catalog-v2";
import { getFormationPrice } from "@/content/pricing";

describe("catalogue — cohérence interne", () => {
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

  it("chaque formation hors séminaire porte une catégorie ; le séminaire n'en a pas", () => {
    for (const f of FORMATIONS_V2) {
      if (f.seminaire) {
        expect(f.categorie, f.id).toBeUndefined();
      } else {
        expect(f.categorie, f.id).toBeDefined();
      }
    }
  });

  it("chaque formation métier/secteur porte un axeLabelFr (badge)", () => {
    for (const f of FORMATIONS_V2) {
      if (f.categorie === "metier" || f.categorie === "secteur") {
        expect(f.axeLabelFr, f.id).toBeTruthy();
      }
    }
  });

  it("les formations 2 jours sont toutes scindables (2×1j)", () => {
    for (const f of FORMATIONS_V2.filter((x) => x.duree === "2j")) {
      expect(f.scindable, f.id).toBe(true);
    }
  });
});

describe("catalogue — prix publics (0 hardcode structurel)", () => {
  it("chaque formation catégorisée a un prix fixe dérivé de la matrice", () => {
    for (const f of getFormationsV2()) {
      expect(f.surDevis, f.id).toBeUndefined();
      const entry = getFormationV2EntryPrice(f);
      expect(entry, f.id).toBeGreaterThan(0);
      expect(entry).toBe(getFormationPrice(f.categorie!, f.duree));
    }
  });

  it("le séminaire reste « Sur devis » (aucun prix matrice)", () => {
    for (const s of getSeminairesV2()) {
      expect(getFormationV2EntryPrice(s), s.id).toBeUndefined();
      expect(getFormationV2Brackets(s), s.id).toHaveLength(0);
    }
  });

  it("tranche unique 2-15 pour chaque formation catégorisée", () => {
    for (const f of getFormationsV2()) {
      expect(getFormationV2Brackets(f), f.id).toEqual(["2-15"]);
      expect(getFormationV2Price(f, "2-15")).toBe(getFormationV2EntryPrice(f));
    }
  });

  it("aucun champ structurel de prix sur la formation", () => {
    for (const f of FORMATIONS_V2) {
      expect(f).not.toHaveProperty("prixFlat");
      expect(f).not.toHaveProperty("priceEur");
    }
  });
});

describe("catalogue — lookup", () => {
  it("getFormationV2 par id / slugFr / slugEn", () => {
    expect(getFormationV2("ia-pour-bien-commencer")?.numero).toBe(1);
    expect(getFormationV2("ai-for-getting-started")?.id).toBe("ia-pour-bien-commencer");
    expect(getFormationV2("inconnu")).toBeUndefined();
  });

  it("filtres catégorie / durée", () => {
    expect(getFormationsV2ByCategorie("generale").length).toBe(4);
    expect(getFormationsV2ByCategorie("metier").length).toBe(9);
    expect(getFormationsV2ByCategorie("secteur").length).toBe(8);
    expect(getFormationsV2ByDuree("4h").length).toBe(1);
  });
});

describe("catalogue — couverture complète (21 formations + 1 séminaire)", () => {
  it("22 entrées (21 formations + 1 séminaire), numéros 1-22 présents", () => {
    expect(FORMATIONS_V2.length).toBe(22);
    expect(getFormationsV2().length).toBe(21);
    expect(getSeminairesV2().length).toBe(1);
    const nums = FORMATIONS_V2.map((f) => f.numero).sort((a, b) => a - b);
    expect(nums).toEqual(Array.from({ length: 22 }, (_, i) => i + 1));
  });

  it("distribution par durée (hors séminaire) : 4h 1 · 1j 16 · 2j 4", () => {
    const sansSem = getFormationsV2();
    expect(sansSem.filter((f) => f.duree === "4h").length).toBe(1);
    expect(sansSem.filter((f) => f.duree === "1j").length).toBe(16);
    expect(sansSem.filter((f) => f.duree === "2j").length).toBe(4);
    expect(sansSem.filter((f) => f.duree === "3j").length).toBe(0);
  });

  it("les 2 formats « bien commencer » existent (4 h condensé + journée complète)", () => {
    expect(getFormationV2("ia-pour-bien-commencer")?.duree).toBe("4h");
    expect(getFormationV2("ia-pour-bien-commencer-journee")?.duree).toBe("1j");
  });

  it("le séminaire conservé est inchangé (slug + effectif 50)", () => {
    const sem = getSeminairesV2()[0];
    expect(sem?.slugFr).toBe("seminaire-ia-toute-l-entreprise-1j");
    expect(sem?.effectifFr).toContain("50");
    expect(sem?.surDevis).toBe(true);
  });
});
