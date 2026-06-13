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
    expect(getInterventionsByFamille("formation").length).toBe(17);
    expect(getInterventionsByFamille("un_a_un").length).toBe(5);
    expect(getInterventionsByFamille("audit").length).toBe(4);
    expect(getAllInterventions().length).toBe(26);
  });

  it("résout une prestation par slug → bonne famille", () => {
    expect(getInterventionBySlug("ia-express")?.famille).toBe("formation");
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
  it("formations : 4 groupes par durée couvrant les 17, ordre 4 h → 1 j → 2 j → 3 j", () => {
    const groups = getInterventionsSousGroupes("formation");
    expect(groups).not.toBeNull();
    const total = groups!.reduce((n, g) => n + g.interventions.length, 0);
    expect(total).toBe(17);
    expect(groups!.every((g) => g.interventions.length > 0)).toBe(true);
    expect(groups!.map((g) => g.titre)).toEqual(["4 heures", "1 jour", "2 jours", "3 jours"]);
    const slugs = groups!.flatMap((g) => g.interventions.map((i) => i.slug));
    expect(new Set(slugs).size).toBe(17);
  });

  it("formations : IA Express rangé dans « 4 heures »", () => {
    const g4h = getInterventionsSousGroupes("formation")!.find((g) => g.key === "4h");
    expect(g4h?.interventions.some((i) => i.slug === "ia-express")).toBe(true);
  });

  it("1-to-1 : groupé par public (Dirigeant / Collaborateur / Suivi régulier), couvre les 5", () => {
    const groups = getInterventionsSousGroupes("un_a_un");
    expect(groups).not.toBeNull();
    expect(groups!.map((g) => g.titre)).toEqual(["Dirigeant", "Collaborateur", "Suivi régulier"]);
    const byKey = (k: string) => groups!.find((g) => g.key === k)?.interventions.length ?? 0;
    expect(byKey("dirigeant")).toBe(2);
    expect(byKey("collaborateur")).toBe(2);
    expect(byKey("recurrent")).toBe(1);
    const total = groups!.reduce((n, g) => n + g.interventions.length, 0);
    expect(total).toBe(5);
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
  it("13 slots, répartis sur les 4 catégories", () => {
    const slots = getSlotsByFamille("formation");
    expect(slots.length).toBe(13);
    const byCat = (c: string) => slots.filter((s) => s.categorie === c).length;
    expect(byCat("stagiaires")).toBe(3);
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

describe("intervention-documents-catalog — slots 1-to-1 (AFEST/Qualiopi)", () => {
  it("15 slots répartis sur 4 rayons, clés uniques", () => {
    const slots = getSlotsByFamille("un_a_un");
    expect(slots.length).toBe(15);
    expect(new Set(slots.map((s) => s.key)).size).toBe(15);
    expect(getSlotsByCategorie("un_a_un").length).toBe(4);
  });

  it("AFEST : analyse d'activité (cartographie) + phase réflexive + plan d'optimisation présents", () => {
    expect(getSlot("un_a_un", "analyse_activite")).toBeDefined();
    expect(getSlot("un_a_un", "phase_reflexive")).toBeDefined();
    expect(getSlot("un_a_un", "plan_optimisation")?.visibilite).toBe("stagiaire");
  });

  it("Qualiopi : positionnement/évaluation/satisfaction taggés + attestation-émargement générée", () => {
    expect(getSlot("un_a_un", "positionnement_individuel")?.qualiopiDocType).toBe("positionnement");
    expect(getSlot("un_a_un", "evaluation_progression")?.qualiopiDocType).toBe("grille_evaluation");
    expect(getSlot("un_a_un", "satisfaction_1to1")?.qualiopiDocType).toBe("satisfaction");
    const att = getSlot("un_a_un", "attestation_emargement");
    expect(att?.generatedOnly).toBe(true);
    expect(att?.qualiopiDocType).toBe("attestation");
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
