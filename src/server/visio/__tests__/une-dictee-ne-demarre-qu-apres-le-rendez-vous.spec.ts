/**
 * ⛔ UNE DICTÉE NE DÉMARRE QU'APRÈS LE RENDEZ-VOUS (PR 7, B14, art. 6.1.f).
 *
 * La dictée démarre `en_cours` SANS accord : elle n'est licite que parce que
 * Williams parle seul, APRÈS l'appel. Lancée pendant la visio, haut-parleur
 * ouvert, elle capterait la voix du client sans accord ni preuve. Le serveur
 * la refuse donc (409, l'extension détruit le son local) :
 *   · tant que la fin prévue du rendez-vous n'est pas passée ;
 *   · si un enregistrement VISIO de la rencontre est actif (sans ce refus, le
 *     409 `enregistrement_actif` rattacherait la dictée à la visio).
 *
 * Mutation qui rougit : retirer l'appel à `refusDictee` de
 * `creerOuReprendreSession`, ou comparer au début prévu au lieu de la fin.
 * Contre-témoin : après la fin prévue, sans visio active, la dictée démarre.
 * Angle mort : un appel qui déborde de sa fin prévue n'est pas vu (le serveur ne
 * sait pas quand l'appel est réellement raccroché).
 */

import { describe, expect, it } from "vitest";

import {
  CODE_DICTEE_AVANT_LA_FIN,
  CODE_DICTEE_PENDANT_LA_VISIO,
  creerOuReprendreSession,
} from "../sessions";
import {
  commePrisma,
  corpsSession,
  fausseBase,
  MINUTE,
  semerAppareil,
  semerRencontreTest,
  T0,
} from "../../../../tests/outils/fixtures-enregistreur";

// Rendez-vous de test : début T0 + 5 min, fin prévue T0 + 50 min.
function preparer() {
  const db = fausseBase();
  const { appareilId, adminUserId } = semerAppareil(db);
  const { rencontreId } = semerRencontreTest(db);
  return { db, appareil: { id: appareilId, adminUserId }, rencontreId };
}

async function dicter(p: ReturnType<typeof preparer>, maintenant: Date) {
  return creerOuReprendreSession(commePrisma(p.db), {
    appareil: p.appareil,
    corps: corpsSession(p.rencontreId, { nature: "dictee", debutLe: maintenant }),
    mode: "pilote",
    maintenant,
    dicteeAnnoncee: true,
  });
}

describe("⛔ une dictée ne démarre qu'après le rendez-vous", () => {
  it("pendant le rendez-vous (avant la fin prévue) : 409, rien de créé", async () => {
    const p = preparer();
    const r = await dicter(p, new Date(T0.getTime() + 20 * MINUTE));
    expect(r.statut).toBe(409);
    expect(r.corps["erreur"]).toBe(CODE_DICTEE_AVANT_LA_FIN);
    expect(p.db.lignes("enregistrement")).toHaveLength(0);
  });

  it("une visio de la rencontre en cours d'enregistrement : 409, pas de rattachement", async () => {
    const p = preparer();
    const visio = await creerOuReprendreSession(commePrisma(p.db), {
      appareil: p.appareil,
      corps: corpsSession(p.rencontreId, { accordLocalLe: T0 }),
      mode: "pilote",
      maintenant: T0,
    });
    expect(visio.statut).toBe(200);
    const r = await dicter(p, new Date(T0.getTime() + 60 * MINUTE));
    expect(r.statut).toBe(409);
    expect(r.corps["erreur"]).toBe(CODE_DICTEE_PENDANT_LA_VISIO);
    expect(r.corps).not.toHaveProperty("enregistrementId");
    expect(p.db.lignes("enregistrement")).toHaveLength(1);
  });

  it("contre-témoin : après la fin prévue, la dictée démarre en cours", async () => {
    const p = preparer();
    const r = await dicter(p, new Date(T0.getTime() + 60 * MINUTE));
    expect(r.statut).toBe(200);
    expect(r.corps["statut"]).toBe("en_cours");
  });
});
