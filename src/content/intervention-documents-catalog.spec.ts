import { describe, it, expect } from "vitest";
import {
  DOC_CATEGORIES,
  FAMILLES,
  FAMILLE_TO_BOOKING,
  BOOKING_TO_FAMILLE,
  getInterventionsByFamille,
  getAllInterventions,
  getInterventionBySlug,
  getSlotsByFamille,
  getSlotsByCategorie,
  getSlot,
  getInterventionsSousGroupes,
  type InterventionFamille,
} from "./intervention-documents-catalog";

describe("intervention-documents-catalog — dérivation booking-catalog", () => {
  it("dérive les prestations par famille (cross-check booking-catalog)", () => {
    expect(getInterventionsByFamille("formation").length).toBe(18);
    // 1-to-1 : offre active seule (kits AXION 16/17 + coaching regulier) —
    // les variantes 2 jours ont ete retirees de la vente (2026-07-17).
    expect(getInterventionsByFamille("un_a_un").length).toBe(3);
    expect(getInterventionsByFamille("audit").length).toBe(4);
    expect(getAllInterventions().length).toBe(25);
  });

  it("résout une prestation par slug → bonne famille", () => {
    expect(getInterventionBySlug("bien-demarrer-avec-l-ia-4h")?.famille).toBe("formation");
    expect(getInterventionBySlug("un-a-un-recurrent")?.famille).toBe("un_a_un");
    expect(getInterventionBySlug("audit-flash-onsite")?.famille).toBe("audit");
    expect(getInterventionBySlug("slug-inexistant")).toBeUndefined();
  });

  it("tous les slugs dérivés sont uniques et non vides", () => {
    const slugs = getAllInterventions().map((i) => i.slug);
    expect(slugs.every((s) => s.length > 0)).toBe(true);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("intervention-documents-catalog — sous-groupes d'affichage", () => {
  it("formations : groupes par durée couvrant les 18 (offre AXION), ordre 4 h → 1 j → 2 j → 3 j", () => {
    const groups = getInterventionsSousGroupes("formation");
    expect(groups).not.toBeNull();
    const total = groups!.reduce((n, g) => n + g.interventions.length, 0);
    expect(total).toBe(18);
    expect(groups!.every((g) => g.interventions.length > 0)).toBe(true);
    expect(groups!.map((g) => g.titre)).toEqual(["4 heures", "1 jour", "2 jours", "3 jours"]);
    const slugs = groups!.flatMap((g) => g.interventions.map((i) => i.slug));
    expect(new Set(slugs).size).toBe(18);
  });

  it("formations : Bien démarrer (4 h) rangé dans « 4 heures »", () => {
    const g4h = getInterventionsSousGroupes("formation")!.find((g) => g.key === "4h");
    expect(g4h?.interventions.some((i) => i.slug === "bien-demarrer-avec-l-ia-4h")).toBe(true);
  });

  it("1-to-1 : groupé par public (Dirigeant / Collaborateur / Suivi régulier), couvre les 3", () => {
    const groups = getInterventionsSousGroupes("un_a_un");
    expect(groups).not.toBeNull();
    expect(groups!.map((g) => g.titre)).toEqual(["Dirigeant", "Collaborateur", "Suivi régulier"]);
    const byKey = (k: string) => groups!.find((g) => g.key === k)?.interventions.length ?? 0;
    expect(byKey("dirigeant")).toBe(1);
    expect(byKey("collaborateur")).toBe(1);
    expect(byKey("recurrent")).toBe(1);
    const total = groups!.reduce((n, g) => n + g.interventions.length, 0);
    expect(total).toBe(3);
  });

  it("audit : pas de sous-groupe (liste à plat → null)", () => {
    expect(getInterventionsSousGroupes("audit")).toBeNull();
  });

  it("formations : chaque prestation porte une durée ; 1-to-1 et audits non", () => {
    expect(getInterventionsByFamille("formation").every((i) => i.duree != null)).toBe(true);
    expect(getInterventionsByFamille("un_a_un").every((i) => i.duree == null)).toBe(true);
    expect(getInterventionsByFamille("audit").every((i) => i.duree == null)).toBe(true);
  });
});

describe("intervention-documents-catalog — ponts famille ↔ booking", () => {
  it("round-trip FAMILLE_TO_BOOKING / BOOKING_TO_FAMILLE", () => {
    for (const { key } of FAMILLES) {
      expect(BOOKING_TO_FAMILLE[FAMILLE_TO_BOOKING[key]]).toBe(key);
    }
    expect(FAMILLE_TO_BOOKING.un_a_un).toBe("un-a-un");
    expect(BOOKING_TO_FAMILLE["un-a-un"]).toBe("un_a_un");
  });
});

describe("intervention-documents-catalog — slots FORMATION (kit IA Express)", () => {
  it("21 slots, répartis sur les 4 catégories", () => {
    const slots = getSlotsByFamille("formation");
    expect(slots.length).toBe(21);
    const byCat = (c: string) => slots.filter((s) => s.categorie === c).length;
    expect(byCat("stagiaires")).toBe(11);
    expect(byCat("formateur")).toBe(4);
    expect(byCat("cadre")).toBe(2);
    expect(byCat("evaluation")).toBe(4);
  });

  it("clés de slot uniques", () => {
    const keys = getSlotsByFamille("formation").map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("chaque slot a une catégorie déclarée dans DOC_CATEGORIES", () => {
    const cats = new Set(DOC_CATEGORIES.map((c) => c.key));
    for (const s of getSlotsByFamille("formation")) {
      expect(cats.has(s.categorie)).toBe(true);
    }
  });

  it("agrégation Qualiopi : attestation/émargement = generatedOnly (lien seul)", () => {
    const att = getSlot("formation", "attestation_emargement");
    expect(att?.generatedOnly).toBe(true);
    expect(att?.qualiopiDocType).toBe("attestation");
  });

  it("test de positionnement agrège le DocumentType Qualiopi", () => {
    expect(getSlot("formation", "test_positionnement")?.qualiopiDocType).toBe("positionnement");
  });

  it("getSlotsByCategorie ne renvoie que des groupes non vides, triés", () => {
    const groups = getSlotsByCategorie("formation");
    expect(groups.length).toBe(4);
    expect(groups.every((g) => g.slots.length > 0)).toBe(true);
    const ordres = groups.map((g) => g.categorie.ordre);
    expect(ordres).toEqual([...ordres].sort((a, b) => a - b));
  });
});

describe("intervention-documents-catalog — slots AUDIT", () => {
  it("9 slots répartis sur 4 rayons, clés uniques", () => {
    const slots = getSlotsByFamille("audit");
    expect(slots.length).toBe(9);
    expect(new Set(slots.map((s) => s.key)).size).toBe(9);
    expect(getSlotsByCategorie("audit").length).toBe(4);
  });

  it("livrable principal = rapport d'audit (client) ; pas d'attestation Qualiopi", () => {
    expect(getSlot("audit", "audit_rapport")?.visibilite).toBe("stagiaire");
    // un audit n'est pas une formation Qualiopi → aucun slot généré / attestation
    const slots = getSlotsByFamille("audit");
    expect(slots.every((s) => !s.generatedOnly && !s.qualiopiDocType)).toBe(true);
    expect(getSlot("audit", "attestation_emargement")).toBeUndefined();
  });

  it("rayons audit affichés avec le vocabulaire conseil (Cadrage en 1er)", () => {
    const groups = getSlotsByCategorie("audit");
    expect(groups[0]?.categorie.titre).toBe("Cadrage & méthode");
    expect(groups.map((g) => g.categorie.titre)).toContain("Livrables client");
  });
});

describe("intervention-documents-catalog — slots 1-to-1 (conseil, kits AXION 16/17)", () => {
  it("6 slots alignés sur le contenu réel des kits, clés uniques", () => {
    const slots = getSlotsByFamille("un_a_un");
    expect(slots.length).toBe(6);
    expect(new Set(slots.map((s) => s.key)).size).toBe(6);
    expect(slots.map((s) => s.key)).toEqual([
      "programme",
      "support_journee",
      "guide_intervenant",
      "livrable_client",
      "memo_methode",
      "ressources",
    ]);
  });

  it("le support de la journée accepte le .pptx (document central du tête-à-tête)", () => {
    const support = getSlot("un_a_un", "support_journee");
    expect(support?.formats).toContain("pptx");
    expect(support?.formats).toContain("pdf");
  });

  // Les kits 16/17 sont du CONSEIL : « pas de QCM, pas d'attestation, non
  // finançable OPCO ». AUCUN slot ne doit porter de doc Qualiopi ni etre généré
  // par le Formation Engine — l'ancienne doctrine AFEST est abandonnée.
  it("aucun slot Qualiopi ni generatedOnly (conseil, pas une formation)", () => {
    for (const slot of getSlotsByFamille("un_a_un")) {
      expect(slot.qualiopiDocType, `slot ${slot.key} porte un qualiopiDocType`).toBeUndefined();
      expect(slot.generatedOnly ?? false, `slot ${slot.key} est generatedOnly`).toBe(false);
    }
    expect(getSlot("un_a_un", "attestation_emargement")).toBeUndefined();
    expect(getSlot("un_a_un", "positionnement_individuel")).toBeUndefined();
    expect(getSlot("un_a_un", "phase_reflexive")).toBeUndefined();
  });

  it("rayons 1-to-1 affichés avec le vocabulaire coaching", () => {
    const titres = getSlotsByCategorie("un_a_un").map((g) => g.categorie.titre);
    expect(titres).toContain("Documents bénéficiaire");
    expect(titres).toContain("Documents coach");
  });
});

describe("intervention-documents-catalog — intégrité globale", () => {
  it("toutes familles : catégories de slot valides + ordres triés", () => {
    const cats = new Set(DOC_CATEGORIES.map((c) => c.key));
    for (const fam of ["formation", "un_a_un", "audit"] as const) {
      for (const s of getSlotsByFamille(fam)) expect(cats.has(s.categorie)).toBe(true);
      const ordres = getSlotsByCategorie(fam).map((g) => g.categorie.ordre);
      expect(ordres).toEqual([...ordres].sort((a, b) => a - b));
    }
  });

  it("famille inconnue → tableau vide (robustesse)", () => {
    expect(getSlotsByFamille("xxx" as InterventionFamille)).toEqual([]);
  });
});
