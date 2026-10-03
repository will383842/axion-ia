/**
 * Tests — entreeRegimeDepuisSession (chantier OPCO A3) : ce que la console lit
 * de la session pour calculer le régime de paiement OPCO.
 */

import { describe, it, expect } from "vitest";
import { entreeRegimeDepuisSession } from "./regime-paiement-session";

const J = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function dossier(surcharge: Record<string, unknown> = {}) {
  return {
    id: "d1",
    type: "opco" as const,
    accordAt: null,
    accordEcritLe: null,
    depotFaitLe: null,
    subrogationConfirmeeParAccord: null,
    payeurs: [] as { payeurType: string }[],
    ...surcharge,
  };
}

describe("entreeRegimeDepuisSession", () => {
  it("lit l'OPCO et l'effectif du client", () => {
    const { entree } = entreeRegimeDepuisSession({
      client: { opco: "akto", effectif: 12 },
      dossiersFinancement: [],
    });
    expect(entree.opco).toBe("akto");
    expect(entree.effectif).toBe(12);
    expect(entree.cofinancement).toBe(false);
  });

  it("sans client : OPCO et effectif nuls", () => {
    const { entree, dossierId } = entreeRegimeDepuisSession({
      client: null,
      dossiersFinancement: [],
    });
    expect(entree.opco).toBeNull();
    expect(entree.effectif).toBeNull();
    expect(dossierId).toBeNull();
  });

  it("dossier mixte → cofinancement", () => {
    const { entree } = entreeRegimeDepuisSession({
      client: null,
      dossiersFinancement: [dossier({ type: "mixte" })],
    });
    expect(entree.cofinancement).toBe(true);
  });

  it("deux payeurs non-entreprise → cofinancement ; un seul + l'entreprise → non", () => {
    const deux = entreeRegimeDepuisSession({
      client: null,
      dossiersFinancement: [
        dossier({ payeurs: [{ payeurType: "opco_subroge" }, { payeurType: "france_travail" }] }),
      ],
    });
    expect(deux.entree.cofinancement).toBe(true);
    const un = entreeRegimeDepuisSession({
      client: null,
      dossiersFinancement: [
        dossier({ payeurs: [{ payeurType: "opco_subroge" }, { payeurType: "entreprise" }] }),
      ],
    });
    expect(un.entree.cofinancement).toBe(false);
  });

  it("date d'accord : la date écrite prime sur l'horodatage du clic", () => {
    const { entree, dossierId, confirmeParAccord } = entreeRegimeDepuisSession({
      client: null,
      dossiersFinancement: [
        dossier({
          accordAt: J("2026-10-05"),
          accordEcritLe: J("2026-09-28"),
          depotFaitLe: J("2026-09-10"),
          subrogationConfirmeeParAccord: true,
        }),
      ],
    });
    expect(entree.dateAccord).toEqual(J("2026-09-28"));
    expect(entree.dateDepot).toEqual(J("2026-09-10"));
    expect(dossierId).toBe("d1");
    expect(confirmeParAccord).toBe(true);
  });

  it("sans date écrite, l'accord est daté par accordAt", () => {
    const { entree } = entreeRegimeDepuisSession({
      client: null,
      dossiersFinancement: [dossier({ accordAt: J("2026-10-05") })],
    });
    expect(entree.dateAccord).toEqual(J("2026-10-05"));
  });
});
