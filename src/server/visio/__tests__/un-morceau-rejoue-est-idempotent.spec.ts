/**
 * Un morceau rejoué est idempotent (PR 5) : l'extension réessaie après une
 * coupure sans savoir si le premier envoi a abouti.
 *
 *   · même (tranche, seq) et même empreinte → 200 sans rien réécrire ;
 *   · même place, autre empreinte → 409 (jamais d'écrasement silencieux).
 */

import { beforeEach, describe, expect, it } from "vitest";

import { deposerMorceau } from "../morceaux";
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

describe("un morceau rejoué est idempotent", () => {
  beforeEach(() => {
    process.env["PII_ENCRYPTION_KEY"] = CLE_DE_TEST;
  });

  it("le même morceau deux fois : 200 puis 200 « déjà », un seul dépôt, une seule ligne", async () => {
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    const { rencontreId } = semerRencontreTest(db);
    const id = semerEnregistrement(db, { rencontreId, appareilId, statut: "en_cours" });
    const stockage = fauxStockage();
    const son = Buffer.from("morceau A");
    const appel = () =>
      deposerMorceau(commePrisma(db), stockage, {
        appareil: { id: appareilId, adminUserId },
        enregistrementId: id,
        entetes: lire(entetesMorceau(son)),
        octets: son,
        maintenant: T0,
      });
    const premier = await appel();
    const avant = [...stockage.objets.values()][0];
    const second = await appel();
    expect(premier.statut).toBe(200);
    expect(second.statut).toBe(200);
    expect(second.corps["deja"]).toBe(true);
    expect(db.lignes("enregistrementMorceau")).toHaveLength(1);
    // Le dépôt n'a pas été réécrit (un nouveau chiffrement changerait l'IV).
    expect([...stockage.objets.values()][0]?.equals(avant as Buffer)).toBe(true);
    expect(db.lignes("enregistrementTranche")[0]?.["tailleOctets"]).toBe(son.byteLength);
  });

  it("un autre son à la même place : 409, rien n'est écrasé", async () => {
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    const { rencontreId } = semerRencontreTest(db);
    const id = semerEnregistrement(db, { rencontreId, appareilId, statut: "en_cours" });
    const stockage = fauxStockage();
    const a = Buffer.from("morceau A");
    const b = Buffer.from("morceau B");
    const deposer = (son: Buffer) =>
      deposerMorceau(commePrisma(db), stockage, {
        appareil: { id: appareilId, adminUserId },
        enregistrementId: id,
        entetes: lire(entetesMorceau(son)),
        octets: son,
        maintenant: T0,
      });
    await deposer(a);
    const r = await deposer(b);
    expect(r.statut).toBe(409);
    expect(r.corps["erreur"]).toBe("morceau_divergent");
    expect(db.lignes("enregistrementMorceau")).toHaveLength(1);
  });

  it("une empreinte annoncée fausse est refusée (400)", async () => {
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    const { rencontreId } = semerRencontreTest(db);
    const id = semerEnregistrement(db, { rencontreId, appareilId, statut: "en_cours" });
    const h = lire(entetesMorceau(Buffer.from("autre chose")));
    const r = await deposerMorceau(commePrisma(db), fauxStockage(), {
      appareil: { id: appareilId, adminUserId },
      enregistrementId: id,
      entetes: h,
      octets: Buffer.from("le vrai son"),
      maintenant: T0,
    });
    expect(r.statut).toBe(400);
    expect(r.corps["erreur"]).toBe("empreinte_fausse");
  });
});
