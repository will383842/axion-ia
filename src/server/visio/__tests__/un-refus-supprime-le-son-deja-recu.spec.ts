/**
 * ⛔ UN REFUS SUPPRIME LE SON DÉJÀ REÇU (PR 5, ADR 0056).
 *
 * « Refus » pendant l'appel : l'enregistrement passe `refuse`, une preuve
 * `retrait` est ajoutée, et CHAQUE morceau déjà déposé est supprimé de R2 puis
 * de la base. Si R2 résiste, 503 : l'extension rejoue le refus, qui reprend la
 * suppression là où elle s'est arrêtée (idempotent, une seule preuve).
 *
 * Mutation qui rougit : retirer la boucle de suppression de `declarerRefus` →
 * le stockage garde le morceau (1er cas). Contre-témoin : après un refus, un
 * nouveau morceau est refusé (409).
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

async function preparer() {
  const db = fausseBase();
  const { appareilId, adminUserId } = semerAppareil(db);
  const { rencontreId } = semerRencontreTest(db);
  const id = semerEnregistrement(db, { rencontreId, appareilId, statut: "en_cours" });
  const stockage = fauxStockage();
  const appareil = { id: appareilId, adminUserId };
  for (const seq of [0, 1]) {
    const son = Buffer.from(`morceau ${seq}`);
    await deposerMorceau(commePrisma(db), stockage, {
      appareil,
      enregistrementId: id,
      entetes: lire(entetesMorceau(son, { seq })),
      octets: son,
      maintenant: T0,
    });
  }
  return { db, stockage, appareil, id };
}

describe("⛔ un refus supprime le son déjà reçu", () => {
  beforeEach(() => {
    process.env["PII_ENCRYPTION_KEY"] = CLE_DE_TEST;
  });

  it("refus : statut refuse, preuve retrait, R2 et base vidés", async () => {
    const { db, stockage, appareil, id } = await preparer();
    expect(stockage.objets.size).toBe(2);
    const r = await declarerRefus(commePrisma(db), stockage, {
      appareil,
      enregistrementId: id,
      refusLe: T0,
      maintenant: T0,
    });
    expect(r.statut).toBe(200);
    expect(r.corps["detruire"]).toBe(true);
    expect(stockage.objets.size).toBe(0);
    expect(db.lignes("enregistrementMorceau")).toHaveLength(0);
    expect(db.lignes("enregistrement")[0]?.["statut"]).toBe("refuse");
    expect(db.lignes("enregistrementConsentement").map((c) => c["type"])).toEqual(["retrait"]);
  });

  it("R2 qui résiste : 503, puis le refus rejoué termine, sans seconde preuve", async () => {
    const { db, appareil, id, stockage } = await preparer();
    const panne = {
      ...stockage,
      supprimer: async () => {
        throw new Error("R2");
      },
    };
    const r1 = await declarerRefus(commePrisma(db), panne, {
      appareil,
      enregistrementId: id,
      refusLe: T0,
      maintenant: T0,
    });
    expect(r1.statut).toBe(503);
    const r2 = await declarerRefus(commePrisma(db), stockage, {
      appareil,
      enregistrementId: id,
      refusLe: T0,
      maintenant: T0,
    });
    expect(r2.statut).toBe(200);
    expect(stockage.objets.size).toBe(0);
    expect(db.lignes("enregistrementConsentement")).toHaveLength(1);
  });

  it("contre-témoin : après un refus, un nouveau morceau est refusé", async () => {
    const { db, stockage, appareil, id } = await preparer();
    await declarerRefus(commePrisma(db), stockage, {
      appareil,
      enregistrementId: id,
      refusLe: T0,
      maintenant: T0,
    });
    const son = Buffer.from("morceau 2");
    const r = await deposerMorceau(commePrisma(db), stockage, {
      appareil,
      enregistrementId: id,
      entetes: lire(entetesMorceau(son, { seq: 2 })),
      octets: son,
      maintenant: T0,
    });
    expect(r.statut).toBe(409);
    expect(stockage.objets.size).toBe(0);
  });
});
