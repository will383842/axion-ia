/**
 * ⛔ UN ACCORD ARRIVÉ APRÈS LA CLÔTURE SERVEUR EST ACCEPTÉ (PR 5, plan §3.6 C2).
 *
 * Le site a été coupé (déploiement) pendant l'appel : le serveur a clos
 * d'office en `accord_non_confirme`, alors que Will avait cliqué « Accord
 * obtenu » à temps. L'accord, daté par l'extension dans les 3 minutes du
 * début, relève la clôture : l'enregistrement repasse `en_cours`.
 *
 * Mutation qui rougit : dans `declarerAccord`, n'accepter que
 * `accord_en_attente` → 409 au lieu de 200 (1er cas).
 * Contre-témoins : un accord daté hors délai est refusé ; un accord après un
 * REFUS ne rouvre jamais rien.
 * Angle mort : l'horloge de l'extension fait foi pour les deux dates (début et
 * accord) ; une horloge fausse décale les deux ensemble, sans effet sur l'écart.
 */

import { describe, expect, it } from "vitest";

import { declarerAccord } from "../sessions";
import {
  commePrisma,
  fausseBase,
  MINUTE,
  semerAppareil,
  semerEnregistrement,
  semerRencontreTest,
  T0,
} from "../../../../tests/outils/fixtures-enregistreur";

function accord(minutes: number) {
  return {
    accordLe: new Date(T0.getTime() + minutes * MINUTE).toISOString(),
    nbParticipants: 2,
    versionTexte: "annonce-v1",
    nouvellePersonne: false,
  };
}

describe("⛔ un accord arrivé après la clôture serveur est accepté", () => {
  it("accord_non_confirme + accord daté à +2 min → en_cours, clôture levée", async () => {
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    const { rencontreId } = semerRencontreTest(db);
    const id = semerEnregistrement(db, {
      rencontreId,
      appareilId,
      statut: "accord_non_confirme",
      motifArret: "accord_non_confirme",
      fin: new Date(T0.getTime() + 4 * MINUTE),
    });
    const r = await declarerAccord(commePrisma(db), {
      appareil: { id: appareilId, adminUserId },
      enregistrementId: id,
      corps: accord(2),
    });
    expect(r.statut).toBe(200);
    const e = db.lignes("enregistrement")[0];
    expect(e?.["statut"]).toBe("en_cours");
    expect(e?.["motifArret"]).toBeNull();
    expect(e?.["fin"]).toBeNull();
    expect(String(e?.["evenements"])).toContain("accord_en_retard_accepte");
    expect(db.lignes("enregistrementConsentement")).toHaveLength(1);
  });

  it("contre-témoin : un accord daté à +5 min reste refusé", async () => {
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    const { rencontreId } = semerRencontreTest(db);
    const id = semerEnregistrement(db, { rencontreId, appareilId, statut: "accord_non_confirme" });
    const r = await declarerAccord(commePrisma(db), {
      appareil: { id: appareilId, adminUserId },
      enregistrementId: id,
      corps: accord(5),
    });
    expect(r.statut).toBe(409);
    expect(r.corps["erreur"]).toBe("accord_hors_delai");
  });

  it("jamais après un refus : la destruction est définitive", async () => {
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    const { rencontreId } = semerRencontreTest(db);
    const id = semerEnregistrement(db, { rencontreId, appareilId, statut: "refuse" });
    const r = await declarerAccord(commePrisma(db), {
      appareil: { id: appareilId, adminUserId },
      enregistrementId: id,
      corps: accord(1),
    });
    expect(r.statut).toBe(409);
    expect(db.lignes("enregistrement")[0]?.["statut"]).toBe("refuse");
  });

  it("un autre appareil ne voit pas l'enregistrement (404)", async () => {
    const db = fausseBase();
    const a = semerAppareil(db);
    const b = semerAppareil(db);
    const { rencontreId } = semerRencontreTest(db);
    const id = semerEnregistrement(db, {
      rencontreId,
      appareilId: a.appareilId,
      statut: "accord_en_attente",
    });
    const r = await declarerAccord(commePrisma(db), {
      appareil: { id: b.appareilId, adminUserId: b.adminUserId },
      enregistrementId: id,
      corps: accord(1),
    });
    expect(r.statut).toBe(404);
  });
});
