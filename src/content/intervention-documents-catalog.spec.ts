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

describe("intervention-documents-catalog — familles scaffoldées (1-to-1 / audit)", () => {
  it("slots vides pour l'instant (à peupler quand kits fournis)", () => {
    expect(getSlotsByFamille("un_a_un").length).toBe(0);
    expect(getSlotsByFamille("audit").length).toBe(0);
    expect(getSlotsByCategorie("un_a_un").length).toBe(0);
  });

  it("famille inconnue → tableau vide (robustesse)", () => {
    expect(getSlotsByFamille("xxx" as InterventionFamille)).toEqual([]);
  });
});
