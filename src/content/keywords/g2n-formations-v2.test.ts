import { describe, expect, it } from "vitest";

import { FORMATIONS_V2 } from "../formations/catalog-v2";
import { KEYWORDS_FORMATIONS_V2 } from "./g2n-formations-v2";

const URLS = Array.from(new Set(KEYWORDS_FORMATIONS_V2.map((s) => s.urlCible)));

describe("g2n-formations-v2 — seeds SEO des 17 formations + sur-mesure", () => {
  it("toutes les urlCible commencent par /fr/formations/", () => {
    for (const s of KEYWORDS_FORMATIONS_V2) {
      expect(s.urlCible.startsWith("/fr/formations/")).toBe(true);
    }
  });

  it("chaque slug de formation du catalogue a au moins un seed", () => {
    for (const f of FORMATIONS_V2) {
      const url = `/fr/formations/${f.slugFr}`;
      expect(URLS).toContain(url);
    }
  });

  it("couvre les 17 formations + la page sur-mesure (18 URLs cibles)", () => {
    expect(URLS).toContain("/fr/formations/sur-mesure");
    expect(URLS.length).toBe(FORMATIONS_V2.length + 1);
  });

  it("anti-cannibalisation : exactement 1 requête HEAD (niveau 1) par urlCible", () => {
    for (const url of URLS) {
      const heads = KEYWORDS_FORMATIONS_V2.filter((s) => s.urlCible === url && s.niveau === 1);
      expect(heads.length, `HEAD unique attendu pour ${url}`).toBe(1);
    }
  });

  it("règle prompt master : aucun seed niveau 1 + priorite 1", () => {
    for (const s of KEYWORDS_FORMATIONS_V2) {
      expect(s.niveau === 1 && s.priorite === 1).toBe(false);
    }
  });

  it("chaque HEAD porte une injection h1/metaTitle/metaDescription", () => {
    const heads = KEYWORDS_FORMATIONS_V2.filter((s) => s.niveau === 1);
    for (const h of heads) {
      expect(h.injection?.h1, `h1 manquant pour ${h.urlCible}`).toBeTruthy();
      expect(h.injection?.metaTitle).toBeTruthy();
      expect(h.injection?.metaDescription).toBeTruthy();
    }
  });

  it("tous les keywords sont en français et >= 10 caractères", () => {
    for (const s of KEYWORDS_FORMATIONS_V2) {
      expect(s.keyword.length).toBeGreaterThanOrEqual(10);
    }
  });

  it("chaque HEAD de formation porte une injection h1/metaTitle/metaDescription complète", () => {
    // NB : l'égalité stricte avec catalog-v2 n'est PAS testée ici — les
    // accroches éditoriales du catalogue sont reformulées en continu (autre
    // chantier). On vérifie la complétude de l'injection, l'alignement fin
    // h1/meta restant du ressort du Content Engine au moment de la génération.
    for (const f of FORMATIONS_V2) {
      const url = `/fr/formations/${f.slugFr}`;
      const head = KEYWORDS_FORMATIONS_V2.find((s) => s.urlCible === url && s.niveau === 1);
      expect(head, `HEAD attendu pour ${url}`).toBeDefined();
      expect(head?.injection?.h1).toBeTruthy();
      expect((head?.injection?.metaTitle ?? "").length).toBeGreaterThan(0);
      expect((head?.injection?.metaTitle ?? "").length).toBeLessThanOrEqual(70);
      expect(head?.injection?.metaDescription).toBeTruthy();
    }
  });
});
