/**
 * ⛔ UN BATTEMENT QUI REVIENT ROUVRE L'ENREGISTREMENT (PR 5, plan §3.6 C2).
 *
 * Le serveur a passé l'enregistrement `interrompu` (10 min sans signe) pendant
 * une coupure du site ; la capture continuait. Le battement suivant le rouvre
 * `en_cours`, et le journal le dit.
 *
 * Mutation qui rougit : dans `battementSession`, traiter `interrompu` comme
 * les états sans changement → le statut reste `interrompu`.
 * Contre-témoin : un battement sur un enregistrement REFUSÉ ne rouvre rien
 * (409, la capture doit s'arrêter).
 */

import { describe, expect, it } from "vitest";

import { battementSession } from "../sessions";
import {
  commePrisma,
  fausseBase,
  MINUTE,
  semerAppareil,
  semerEnregistrement,
  semerRencontreTest,
  T0,
} from "../../../../tests/outils/fixtures-enregistreur";

describe("⛔ un battement qui revient rouvre l'enregistrement", () => {
  it("interrompu → en_cours, signe de vie daté, journal « reprise_battement »", async () => {
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    const { rencontreId } = semerRencontreTest(db);
    const id = semerEnregistrement(db, { rencontreId, appareilId, statut: "interrompu" });
    const quand = new Date(T0.getTime() + 25 * MINUTE);
    const r = await battementSession(commePrisma(db), {
      appareil: { id: appareilId, adminUserId },
      enregistrementId: id,
      maintenant: quand,
    });
    expect(r.statut).toBe(200);
    const e = db.lignes("enregistrement")[0];
    expect(e?.["statut"]).toBe("en_cours");
    expect((e?.["updatedAt"] as Date).getTime()).toBe(quand.getTime());
    expect(String(e?.["evenements"])).toContain("reprise_battement");
  });

  it("contre-témoin : un enregistrement refusé ne se rouvre pas (409)", async () => {
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    const { rencontreId } = semerRencontreTest(db);
    const id = semerEnregistrement(db, { rencontreId, appareilId, statut: "refuse" });
    const r = await battementSession(commePrisma(db), {
      appareil: { id: appareilId, adminUserId },
      enregistrementId: id,
      maintenant: T0,
    });
    expect(r.statut).toBe(409);
    expect(db.lignes("enregistrement")[0]?.["statut"]).toBe("refuse");
  });
});
