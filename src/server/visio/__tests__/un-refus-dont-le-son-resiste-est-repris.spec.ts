/**
 * ⛔ UN REFUS DONT LE SON RÉSISTE EST REPRIS, SANS L'EXTENSION (PR 5).
 *
 * R2 en panne au moment du refus : `declarerRefus` répond 503 « nouvel essai
 * automatique ». Ce nouvel essai EXISTE : `reprendrePurgesDesRefus` (appelé à
 * chaque requête de l'extension et par le balayage) reprend tout
 * enregistrement `refuse` qui a encore un morceau ou dont `audioSupprimeLe`
 * est nul. Sans lui, le son d'une personne qui a refusé restait dans R2 sans
 * date de purge.
 *
 * Mutation qui rougit : retirer l'appel de `reprendrePurgesDesRefus` dans
 * `balayerEnregistreur` → 2e cas ; filtrer la reprise sur `audioSupprimeLe`
 * seul → le 3e cas (morceau arrivé APRÈS la purge) n'est pas repris.
 * Contre-témoin : un enregistrement `depose` n'est jamais touché.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { balayerEnregistreur } from "../balayage-enregistreur";
import { deposerMorceau } from "../morceaux";
import { declarerRefus, reprendrePurgesDesRefus } from "../sessions";
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

async function avecDeuxMorceaux(statut = "en_cours") {
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
  (db.lignes("enregistrement")[0] as Record<string, unknown>)["statut"] = statut;
  return { db, stockage, appareil, id };
}

const panne = (s: ReturnType<typeof fauxStockage>) => ({
  ...s,
  supprimer: async () => {
    throw new Error("R2 injoignable");
  },
});

describe("⛔ un refus dont le son résiste est repris, sans l'extension", () => {
  beforeEach(() => {
    process.env["PII_ENCRYPTION_KEY"] = CLE_DE_TEST;
  });

  it("refus en panne : 503, statut refuse, échéance de purge posée tout de suite", async () => {
    const { db, stockage, appareil, id } = await avecDeuxMorceaux();
    const r = await declarerRefus(commePrisma(db), panne(stockage), {
      appareil,
      enregistrementId: id,
      refusLe: T0,
      maintenant: T0,
    });
    expect(r.statut).toBe(503);
    const e = db.lignes("enregistrement")[0];
    expect(e?.["statut"]).toBe("refuse");
    expect(e?.["audioAPurgerAvant"]).toEqual(T0);
    expect(stockage.objets.size).toBe(2);
  });

  it("le balayage reprend la purge : R2 et base vidés, audioSupprimeLe posé", async () => {
    const { db, stockage, appareil, id } = await avecDeuxMorceaux();
    await declarerRefus(commePrisma(db), panne(stockage), {
      appareil,
      enregistrementId: id,
      refusLe: T0,
      maintenant: T0,
    });
    const bilan = await balayerEnregistreur(commePrisma(db), vi.fn().mockResolvedValue(true), {
      maintenant: T0,
      version: "t",
      env: {},
      stockage,
      creer: async () => null,
    });
    expect(bilan.purges).toEqual({ purges: 1, enAttente: 0 });
    expect(stockage.objets.size).toBe(0);
    expect(db.lignes("enregistrementMorceau")).toHaveLength(0);
    expect(db.lignes("enregistrement")[0]?.["audioSupprimeLe"]).toEqual(T0);
  });

  it("un morceau resté APRÈS la purge (audioSupprimeLe déjà posé) est repris aussi", async () => {
    const { db, stockage, appareil, id } = await avecDeuxMorceaux();
    await declarerRefus(commePrisma(db), stockage, {
      appareil,
      enregistrementId: id,
      refusLe: T0,
      maintenant: T0,
    });
    // Un morceau écrit par une requête déjà en vol, dont la suppression a échoué.
    const tranche = db.lignes("enregistrementTranche")[0] as Record<string, unknown>;
    stockage.objets.set("visio-audio/tardif.bin", Buffer.from("x"));
    db.semer("enregistrementMorceau", {
      trancheId: tranche["id"],
      seq: 9,
      cleR2: "visio-audio/tardif.bin",
      tailleOctets: 1,
      empreinte: "0".repeat(64),
    });
    const bilan = await reprendrePurgesDesRefus(commePrisma(db), stockage, T0);
    expect(bilan.purges).toBe(1);
    expect(stockage.objets.size).toBe(0);
    expect(db.lignes("enregistrementMorceau")).toHaveLength(0);
  });

  it("contre-témoin : un enregistrement déposé garde son son", async () => {
    const { db, stockage } = await avecDeuxMorceaux("depose");
    const bilan = await reprendrePurgesDesRefus(commePrisma(db), stockage, T0);
    expect(bilan).toEqual({ purges: 0, enAttente: 0 });
    expect(stockage.objets.size).toBe(2);
  });
});
