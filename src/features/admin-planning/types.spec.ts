/** Tests — types.ts (planning unifié) : construction des liens de fiche. */

import { describe, it, expect } from "vitest";
import {
  deduireCommercialStatut,
  planningDetailHref,
  PLANNING_STATUT_LABELS,
  PLANNING_TYPE_LABELS,
} from "./types";

describe("planningDetailHref", () => {
  it("pointe vers la fiche 360° d'une formation", () => {
    expect(planningDetailHref("adm-x", { type: "formation", id: "f1" })).toBe(
      "/fr/adm-x/planning/formation/f1",
    );
  });

  it("pointe vers la fiche 360° d'un coaching", () => {
    expect(planningDetailHref("adm-x", { type: "coaching", id: "c1" })).toBe(
      "/fr/adm-x/planning/coaching/c1",
    );
  });

  // 🔴 Un audit menait à une 404 : la route `/planning/[type]/[id]` n'accepte
  // que `formation` et `coaching`, alors que le calendrier, la timeline, le hub
  // et le prévisionnel affichent tous des audits. Ils ont leur propre fiche.
  it("envoie un audit vers sa fiche Qualiopi, pas vers une route qui ne l'accepte pas", () => {
    expect(planningDetailHref("adm-x", { type: "audit", id: "a1" })).toBe(
      "/fr/adm-x/qualiopi/audits/a1",
    );
  });
});

describe("libellés", () => {
  it("couvre tous les statuts du planning", () => {
    expect(Object.keys(PLANNING_STATUT_LABELS).sort()).toEqual([
      "annulee",
      "en_cours",
      "planifiee",
      "realisee",
      "reportee",
    ]);
  });

  it("couvre les trois types de prestation", () => {
    expect(Object.keys(PLANNING_TYPE_LABELS).sort()).toEqual(["audit", "coaching", "formation"]);
  });
});

describe("deduireCommercialStatut", () => {
  it("convention signée = validé, quel que soit le devis", () => {
    expect(deduireCommercialStatut(null, true)).toBe("valide");
    expect(deduireCommercialStatut("envoye", true)).toBe("valide");
  });

  it("devis accepté ou transformé = validé", () => {
    expect(deduireCommercialStatut("accepte", false)).toBe("valide");
    expect(deduireCommercialStatut("transforme_convention", false)).toBe("valide");
  });

  it("devis envoyé sans réponse = en devis", () => {
    expect(deduireCommercialStatut("envoye", false)).toBe("en_devis");
  });

  it("brouillon, refus, expiration, ou aucun devis = aucune pastille", () => {
    expect(deduireCommercialStatut("brouillon", false)).toBeNull();
    expect(deduireCommercialStatut("refuse", false)).toBeNull();
    expect(deduireCommercialStatut("expire", false)).toBeNull();
    expect(deduireCommercialStatut(null, false)).toBeNull();
  });
});
