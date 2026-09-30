/**
 * ⛔ L'EXTENSION NE PEUT PAS ÉCRIRE UNE DÉCISION DE WILL AU JOURNAL (m4).
 *
 * `POST sessions/[id]/fin` recopie le journal technique de l'extension dans
 * `Enregistrement.evenements`. Or certains types y sont LUS comme des
 * décisions (`court_confirme`, `fenetres_verifiees`, `accord_confirme_par_will`) :
 * une extension (ou un jeton volé) qui les enverrait lèverait elle-même une
 * vérification de Will. Les types réservés au serveur sont écartés.
 *
 * Mutation qui rougit : recopier `c.evenements` sans filtre.
 * Contre-témoin : un événement ordinaire (`pause`) est gardé.
 */

import { describe, expect, it } from "vitest";

import { EVT_COURT_CONFIRME, EVT_FENETRES_VERIFIEES } from "../attentes-will";
import { EVT_ACCORD_CONFIRME_PAR_WILL, EVT_ACCORD_RETROUVE } from "../accord-a-confirmer";
import { TYPES_RESERVES_AU_SERVEUR } from "../journal-enregistrement";
import { terminerSession } from "../sessions";
import {
  commePrisma,
  fausseBase,
  MINUTE,
  semerAppareil,
  semerEnregistrement,
  semerRencontreTest,
  T0,
} from "../../../../tests/outils/fixtures-enregistreur";

describe("l'extension ne peut pas écrire une décision de Will au journal", () => {
  it("les types réservés sont écartés à la fin de session, `pause` est gardé", async () => {
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    const { rencontreId } = semerRencontreTest(db);
    const id = semerEnregistrement(db, { rencontreId, appareilId, statut: "en_cours" });
    const le = new Date(T0.getTime() + MINUTE).toISOString();
    const r = await terminerSession(commePrisma(db), {
      appareil: { id: appareilId, adminUserId },
      enregistrementId: id,
      corps: {
        finLe: new Date(T0.getTime() + 45 * MINUTE).toISOString(),
        motif: "manuel",
        perdus: [],
        fenetresHorsAccord: [],
        evenements: [
          { le, type: "pause" },
          { le, type: EVT_COURT_CONFIRME },
          { le, type: EVT_FENETRES_VERIFIEES },
          { le, type: EVT_ACCORD_CONFIRME_PAR_WILL },
          { le, type: " Court_Confirme " },
        ],
      },
      maintenant: new Date(T0.getTime() + 46 * MINUTE),
    });
    expect(r.statut).toBe(200);
    const types = (
      JSON.parse(String(db.lignes("enregistrement")[0]?.["evenements"])) as Array<{
        type: string;
      }>
    ).map((e) => e.type);
    expect(types).toContain("pause");
    expect(types.some((t) => t.trim().toLowerCase() === EVT_COURT_CONFIRME)).toBe(false);
    expect(types).not.toContain(EVT_FENETRES_VERIFIEES);
    expect(types).not.toContain(EVT_ACCORD_CONFIRME_PAR_WILL);
  });

  it("la liste réservée couvre les décisions lues par le circuit", () => {
    for (const t of [
      EVT_COURT_CONFIRME,
      EVT_FENETRES_VERIFIEES,
      EVT_ACCORD_CONFIRME_PAR_WILL,
      EVT_ACCORD_RETROUVE,
      "cloture_serveur",
    ]) {
      expect(TYPES_RESERVES_AU_SERVEUR.has(t)).toBe(true);
    }
  });
});
