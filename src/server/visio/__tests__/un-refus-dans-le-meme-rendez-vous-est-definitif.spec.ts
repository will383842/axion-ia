/**
 * ⛔ UN REFUS DANS LE MÊME RENDEZ-VOUS EST DÉFINITIF (PR 5 ; plan §3.6 C2 :
 * « JAMAIS après un refus » ; V5-C6).
 *
 * Scénario : le client refuse, Will clique « Refus » ; plus tard dans le même
 * appel, un nouveau « Démarrer ». Le serveur répond 409
 * `refus_anterieur_definitif` (rien n'est créé) et la liste du jour allume le
 * bandeau `refusAnterieur` sur CETTE rencontre. Idem après un retrait.
 *
 * Mutation qui rougit : retirer le bloc « 1 bis » de `motifDeRefus` → les deux
 * premiers cas rendent 200 ; remettre `id: { not: rencontreId }` dans
 * `aUnRefusAnterieur` → le bandeau s'éteint.
 * Contre-témoin : un enregistrement clos sans refus (`accord_non_confirme`)
 * n'empêche pas de redémarrer.
 */

import { describe, expect, it } from "vitest";

import { listerRencontresDuJour } from "../liste-enregistreur";
import { creerOuReprendreSession } from "../sessions";
import {
  commePrisma,
  corpsSession,
  fausseBase,
  semerAppareil,
  semerEnregistrement,
  semerRencontreCalendly,
  T0,
} from "../../../../tests/outils/fixtures-enregistreur";

type Base = ReturnType<typeof fausseBase>;

function rendezVous() {
  const db = fausseBase();
  const { appareilId, adminUserId } = semerAppareil(db);
  const { rencontreId } = semerRencontreCalendly(db);
  return { db, appareil: { id: appareilId, adminUserId }, rencontreId: String(rencontreId) };
}

async function redemarrer(db: Base, appareil: { id: string; adminUserId: string }, id: string) {
  return creerOuReprendreSession(commePrisma(db), {
    appareil,
    corps: corpsSession(id),
    mode: "ouvert",
    maintenant: T0,
    preavis: null,
  });
}

async function bandeauRefus(db: Base) {
  const liste = await listerRencontresDuJour(commePrisma(db), {
    maintenant: T0,
    mode: "ouvert",
    preavis: null,
  });
  return liste[0]?.refusAnterieur;
}

describe("⛔ un refus dans le même rendez-vous est définitif", () => {
  it("après « Refus » : nouveau démarrage refusé (409), bandeau allumé", async () => {
    const { db, appareil, rencontreId } = rendezVous();
    semerEnregistrement(db, { rencontreId, appareilId: appareil.id, statut: "refuse" });
    expect(await bandeauRefus(db)).toBe(true);
    const r = await redemarrer(db, appareil, rencontreId);
    expect(r.statut).toBe(409);
    expect(r.corps["erreur"]).toBe("refus_anterieur_definitif");
    expect(db.lignes("enregistrement")).toHaveLength(1);
  });

  it("après un retrait sur cette rencontre : refusé aussi", async () => {
    const { db, appareil, rencontreId } = rendezVous();
    db.semer("enregistrementConsentement", {
      rencontreId,
      type: "retrait",
      versionTexte: "retrait-v1",
      survenuLe: T0,
    });
    expect(await bandeauRefus(db)).toBe(true);
    const r = await redemarrer(db, appareil, rencontreId);
    expect(r.statut).toBe(409);
    expect(r.corps["erreur"]).toBe("refus_anterieur_definitif");
  });

  it("contre-témoin : un enregistrement clos sans refus n'empêche pas de redémarrer", async () => {
    const { db, appareil, rencontreId } = rendezVous();
    semerEnregistrement(db, {
      rencontreId,
      appareilId: appareil.id,
      statut: "accord_non_confirme",
    });
    expect(await bandeauRefus(db)).toBe(false);
    const r = await redemarrer(db, appareil, rencontreId);
    expect(r.statut).toBe(200);
  });
});
