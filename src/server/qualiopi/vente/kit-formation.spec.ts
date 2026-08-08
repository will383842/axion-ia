/**
 * Tests — vente/kit-formation.ts (pont Formation ↔ kit documentaire).
 *
 * Module PUR : aucun mock. Vérifie l'exhaustivité de la correspondance
 * SupportType → slot, l'existence RÉELLE de chaque slot référencé dans le
 * catalogue, et le fail-visible de la résolution de slug (jamais deviné).
 */

import { describe, it, expect } from "vitest";
import {
  resolveInterventionSlugForFormation,
  SUPPORT_TYPE_TO_SLOT,
  SUPPORT_TYPES,
  SLOTS_PROJETES_EN_SALLE,
} from "./kit-formation";
import {
  getInterventionsByFamille,
  getSlotsByFamille,
} from "@/content/intervention-documents-catalog";

// Valeurs de l'enum Prisma SupportType — figées ici : si l'enum bouge, ce test
// rougit et force à statuer sur la correspondance du nouveau type.
const ENUM_SUPPORT_TYPES = [
  "slides_formateur",
  "slides_stagiaire",
  "livret_stagiaire",
  "memo",
  "guide_animation",
  "exercices",
  "grille_eval",
  "kit_formateur_imprime",
] as const;

describe("SUPPORT_TYPE_TO_SLOT", () => {
  it("couvre exactement chaque valeur de l'enum SupportType (null accepté)", () => {
    expect(Object.keys(SUPPORT_TYPE_TO_SLOT).sort()).toEqual([...ENUM_SUPPORT_TYPES].sort());
    expect([...SUPPORT_TYPES].sort()).toEqual([...ENUM_SUPPORT_TYPES].sort());
  });

  it("chaque slot référencé existe réellement dans le catalogue formation", () => {
    const slotKeys = new Set(getSlotsByFamille("formation").map((s) => s.key));
    for (const [type, slot] of Object.entries(SUPPORT_TYPE_TO_SLOT)) {
      if (slot === null) continue;
      expect(slotKeys.has(slot), `${type} → slot inconnu « ${slot} »`).toBe(true);
    }
  });

  it("slides_formateur ne mappe PAS vers le slot diaporama (objets différents)", () => {
    expect(SUPPORT_TYPE_TO_SLOT.slides_formateur).toBeNull();
  });

  it("les slots projetés en salle existent dans le catalogue formation", () => {
    const slotKeys = new Set(getSlotsByFamille("formation").map((s) => s.key));
    for (const slot of SLOTS_PROJETES_EN_SALLE) {
      expect(slotKeys.has(slot), `slot projeté inconnu « ${slot} »`).toBe(true);
    }
  });
});

describe("resolveInterventionSlugForFormation", () => {
  it("retourne le slug quand il correspond à une formation du catalogue", () => {
    const premiere = getInterventionsByFamille("formation")[0];
    expect(premiere).toBeDefined();
    expect(resolveInterventionSlugForFormation({ slug: premiere!.slug })).toBe(premiere!.slug);
  });

  it("retourne null pour un slug inconnu (formation dupliquée) — jamais deviné", () => {
    expect(resolveInterventionSlugForFormation({ slug: "ia-express-copie" })).toBeNull();
  });

  it("retourne null pour un slug vide", () => {
    expect(resolveInterventionSlugForFormation({ slug: "" })).toBeNull();
  });

  it("ne résout pas un slug d'une AUTRE famille (audit / 1-to-1)", () => {
    const audit = getInterventionsByFamille("audit")[0];
    expect(audit).toBeDefined();
    expect(resolveInterventionSlugForFormation({ slug: audit!.slug })).toBeNull();
  });

  // 🔴 Vérifié en PRODUCTION le 2026-08-05 : 34 des 56 formations publiées
  // portaient un kit déposé (diaporamas de juin) que l'écran « Tout pour
  // animer » déclarait absent — leurs slugs, hérités de l'offre d'avant
  // juillet, ne sont plus au catalogue. Le dépôt réel doit primer.
  it("reconnaît un kit DÉPOSÉ dont le slug n'est plus au catalogue (offre renommée)", () => {
    const legacy = "agents-automatisations";
    expect(resolveInterventionSlugForFormation({ slug: legacy })).toBeNull();
    expect(resolveInterventionSlugForFormation({ slug: legacy }, new Set([legacy]))).toBe(legacy);
  });

  it("un slug vide reste refusé même si le Set en contient un (Set mal construit)", () => {
    expect(resolveInterventionSlugForFormation({ slug: "" }, new Set([""]))).toBeNull();
  });

  it("le Set n'ouvre que les slugs qu'il contient — pas les autres", () => {
    expect(
      resolveInterventionSlugForFormation({ slug: "ia-express-copie" }, new Set(["autre-slug"])),
    ).toBeNull();
  });
});
