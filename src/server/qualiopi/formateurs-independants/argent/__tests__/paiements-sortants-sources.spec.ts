// @vitest-environment node

/**
 * FAC-9 — la vue neutre des paiements sortants et la zone Qualiopi parlent des
 * MÊMES règles (le module neutre ne peut pas importer la zone : l'égalité est
 * vérifiée ici, côté zone).
 */

import { describe, expect, expectTypeOf, it } from "vitest";

import {
  SEUIL_DAS2_COMMUN_CENTS,
  STATUTS_RELEVE_A_VIRER,
} from "@/server/paiements-sortants/parametres";
import type { lireVirementsSortants } from "@/server/paiements-sortants/virements";
import { echeanceEffective, STATUTS_RELEVE_DU } from "@/server/qualiopi/remuneration/echeance";

import { PARAMETRES_ARGENT_FORMATEURS } from "../parametres";

describe("paiements sortants ↔ rémunération des formateurs", () => {
  it("les statuts « à virer » de la vue sont les statuts DUS des relevés", () => {
    expect([...STATUTS_RELEVE_A_VIRER].sort()).toEqual([...STATUTS_RELEVE_DU].sort());
  });

  it("le seuil DAS 2 du paiement par mission EST le paramètre commun", () => {
    expect(PARAMETRES_ARGENT_FORMATEURS.seuilDas2Cents).toBe(SEUIL_DAS2_COMMUN_CENTS);
  });

  it("l'échéance de la vue se branche sur `echeanceEffective` (repli facture + 30 jours)", () => {
    expectTypeOf(echeanceEffective).toMatchTypeOf<Parameters<typeof lireVirementsSortants>[1]>();
    const dateFacture = new Date("2026-08-01T00:00:00Z");
    expect(
      echeanceEffective({ statut: "facture_recue", dateFacture, echeanceAt: null, payeAt: null }),
    ).not.toBeNull();
  });
});
