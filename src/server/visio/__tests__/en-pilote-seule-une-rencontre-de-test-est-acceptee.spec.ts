/**
 * En mode `pilote`, seule une rencontre de test (client fictif) est acceptée
 * (PR 5) ; une vraie rencontre « Discutons » est refusée avec un motif clair.
 */

import { describe, expect, it } from "vitest";

import { creerOuReprendreSession } from "../sessions";
import {
  commePrisma,
  corpsSession,
  fausseBase,
  semerAppareil,
  semerRencontreCalendly,
  semerRencontreTest,
  T0,
} from "../../../../tests/outils/fixtures-enregistreur";

describe("en pilote, seule une rencontre de test est acceptée", () => {
  it("rencontre de test : acceptée", async () => {
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    const { rencontreId } = semerRencontreTest(db);
    const r = await creerOuReprendreSession(commePrisma(db), {
      appareil: { id: appareilId, adminUserId },
      corps: corpsSession(rencontreId),
      mode: "pilote",
      maintenant: T0,
    });
    expect(r.statut).toBe(200);
  });

  it("vraie rencontre « Discutons » : 409 « pilote_rencontre_non_test »", async () => {
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    const { rencontreId } = semerRencontreCalendly(db);
    const r = await creerOuReprendreSession(commePrisma(db), {
      appareil: { id: appareilId, adminUserId },
      corps: corpsSession(rencontreId as string),
      mode: "pilote",
      maintenant: T0,
    });
    expect(r.statut).toBe(409);
    expect(r.corps["erreur"]).toBe("pilote_rencontre_non_test");
    expect(db.lignes("enregistrement")).toHaveLength(0);
  });

  it("rencontre saisie non test (mode pilote) : refusée aussi", async () => {
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    const { rencontreId } = semerRencontreTest(db, { estTestInterne: false });
    const r = await creerOuReprendreSession(commePrisma(db), {
      appareil: { id: appareilId, adminUserId },
      corps: corpsSession(rencontreId),
      mode: "pilote",
      maintenant: T0,
    });
    expect(r.corps["erreur"]).toBe("pilote_rencontre_non_test");
  });
});
