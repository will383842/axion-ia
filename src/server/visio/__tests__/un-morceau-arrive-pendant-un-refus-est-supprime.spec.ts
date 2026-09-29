/**
 * ⛔ UN MORCEAU ARRIVÉ PENDANT UN REFUS EST SUPPRIMÉ (PR 5).
 *
 * Le dépôt lit le statut (`en_cours`), puis écrit R2 et la ligne. Si le refus
 * passe ENTRE les deux, il liste les morceaux une seule fois, les purge et pose
 * `audioSupprimeLe` : le morceau écrit juste après lui échappait, gardé sans
 * échéance. Le dépôt relit donc le statut APRÈS l'écriture et défait tout
 * (objet R2 et ligne), puis répond 409. Et il n'écrase plus jamais `refuse`
 * par `en_cours` (l'ancien `update` nu le faisait sur un `interrompu`).
 *
 * La course est simulée par un stockage dont `deposer` déclenche le refus :
 * le refus s'exécute exactement entre la lecture du statut et l'écriture.
 *
 * Mutation qui rougit : retirer la relecture du statut → 1er cas (le morceau
 * reste dans R2 et en base). Remettre l'`update` nu → 2e cas (`en_cours`).
 * Contre-témoin : sans refus, le morceau est gardé (200).
 */

import { beforeEach, describe, expect, it } from "vitest";

import { deposerMorceau } from "../morceaux";
import { declarerRefus } from "../sessions";
import {
  CLE_DE_TEST,
  commePrisma,
  entetesMorceau,
  fausseBase,
  fauxStockage,
  semerAppareil,
  semerEnregistrement,
  semerRencontreTest,
  T0,
} from "../../../../tests/outils/fixtures-enregistreur";

function lire(h: Record<string, string>) {
  return {
    piste: h["x-piste"] ?? null,
    tranche: h["x-tranche"] ?? null,
    seq: h["x-seq"] ?? null,
    debutCaptureMs: h["x-debut-capture-ms"] ?? null,
    empreinte: h["x-empreinte"] ?? null,
  };
}

function preparer(statut: string) {
  const db = fausseBase();
  const { appareilId, adminUserId } = semerAppareil(db);
  const { rencontreId } = semerRencontreTest(db);
  const id = semerEnregistrement(db, { rencontreId, appareilId, statut });
  const reel = fauxStockage();
  const appareil = { id: appareilId, adminUserId };
  /** R2 dont l'écriture laisse passer un refus « en même temps ». */
  const avecRefusEnVol = {
    ...reel,
    deposer: async (cle: string, octets: Buffer) => {
      await reel.deposer(cle, octets);
      await declarerRefus(commePrisma(db), reel, {
        appareil,
        enregistrementId: id,
        refusLe: T0,
        maintenant: T0,
      });
    },
  };
  return { db, reel, avecRefusEnVol, appareil, id };
}

async function deposer(p: ReturnType<typeof preparer>, stockage: typeof p.reel) {
  const son = Buffer.from("morceau en vol");
  return deposerMorceau(commePrisma(p.db), stockage, {
    appareil: p.appareil,
    enregistrementId: p.id,
    entetes: lire(entetesMorceau(son, { seq: 0 })),
    octets: son,
    maintenant: T0,
  });
}

describe("⛔ un morceau arrivé pendant un refus est supprimé", () => {
  beforeEach(() => {
    process.env["PII_ENCRYPTION_KEY"] = CLE_DE_TEST;
  });

  it("refus pendant l'écriture : 409, R2 et base vides", async () => {
    const p = preparer("en_cours");
    const r = await deposer(p, p.avecRefusEnVol);
    expect(r.statut).toBe(409);
    expect(p.reel.objets.size).toBe(0);
    expect(p.db.lignes("enregistrementMorceau")).toHaveLength(0);
  });

  it("un « interrompu » refusé pendant l'écriture reste « refuse »", async () => {
    const p = preparer("interrompu");
    await deposer(p, p.avecRefusEnVol);
    expect(p.db.lignes("enregistrement")[0]?.["statut"]).toBe("refuse");
  });

  it("contre-témoin : sans refus, le morceau est gardé", async () => {
    const p = preparer("en_cours");
    const r = await deposer(p, p.reel);
    expect(r.statut).toBe(200);
    expect(p.reel.objets.size).toBe(1);
    expect(p.db.lignes("enregistrementMorceau")).toHaveLength(1);
  });
});
