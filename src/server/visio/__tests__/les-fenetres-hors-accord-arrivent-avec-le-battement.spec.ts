/**
 * ⛔ LES FENÊTRES HORS ACCORD ARRIVENT AVEC LE BATTEMENT (V2, N4 et N3).
 *
 * Les arrivées sans accord ne partaient qu'avec la `fin`. Une session close
 * par le serveur (coupure réseau en fin d'appel) n'avait donc rien : Will
 * devait dire de mémoire, une semaine plus tard, si quelqu'un était entré.
 * Et une `fin` arrivée après le début du traitement perdait ses fenêtres en
 * silence (N3).
 *
 * Désormais (ajout facultatif au contrat v1) :
 *   · le battement de session porte les fenêtres, ouvertes et fermées ; le
 *     site les garde au fil de l'appel. Une fenêtre encore OUVERTE court
 *     jusqu'à la fin (la personne était là quand le contact a été perdu) ;
 *   · la question « interrompue » ne se pose plus si un battement les a
 *     apportées ;
 *   · une `fin` tardive d'une session close par le serveur, arrivée après le
 *     début du traitement, enregistre ses fenêtres, vide la parole des
 *     segments qui les chevauchent et alerte.
 *
 * Mutations qui rougissent : ignorer `fenetresHorsAccord` dans
 * `battementSession` (1er cas) ; ne pas lire `fenetresRecues` dans
 * `questionsAWill` (2e cas) ; répondre `deja` sans rien écrire (4e cas).
 * Contre-témoin : sans battement porteur, la question reste posée.
 */

import { describe, expect, it, vi } from "vitest";

const base = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy({}, { get: (_c, nom: string) => (base.db as Record<string, unknown>)[nom] }),
}));
vi.mock("@/server/qualiopi/alertes/evaluateur", () => ({
  evaluerAlertesDetaille: vi.fn(),
}));

import { fenetresAuBattement } from "../../../../extensions/enregistreur-meet/lib/etats-capture.js";
import { CODES_ALERTES_VISIO } from "../alertes";
import { questionsAWill } from "../attentes-will";
import { battementSession, FIN_FENETRE_OUVERTE_MS, terminerSession } from "../sessions";
import {
  commePrisma,
  fausseBase,
  fauxStockage,
  MINUTE,
  semerAppareil,
  semerEnregistrement,
  semerRencontreTest,
  T0,
} from "../../../../tests/outils/fixtures-enregistreur";

describe("les fenêtres hors accord arrivent avec le battement", () => {
  it("le battement garde les fenêtres ; une fenêtre ouverte court jusqu'à la fin", async () => {
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    const { rencontreId } = semerRencontreTest(db);
    const id = semerEnregistrement(db, { rencontreId, appareilId, statut: "en_cours" });
    const r = await battementSession(commePrisma(db), {
      appareil: { id: appareilId, adminUserId },
      enregistrementId: id,
      maintenant: new Date(T0.getTime() + 5 * MINUTE),
      fenetresHorsAccord: [
        { debutMs: 60_000, finMs: 90_000 },
        { debutMs: 250_000, finMs: 300_000, ouverte: true },
      ],
    });
    expect(r.statut).toBe(200);
    expect(JSON.parse(String(db.lignes("enregistrement")[0]?.["fenetresHorsAccord"]))).toEqual([
      { debutMs: 60_000, finMs: 90_000 },
      { debutMs: 250_000, finMs: FIN_FENETRE_OUVERTE_MS },
    ]);
  });

  it("session close par le serveur : plus de question si un battement a apporté les fenêtres", () => {
    const e = {
      debut: T0,
      fin: new Date(T0.getTime() + 20 * MINUTE),
      motifArret: "cloture_serveur",
      courtConfirme: false,
      fenetresVerifiees: false,
    };
    expect(questionsAWill({ ...e, fenetresRecues: true }, T0)).toEqual([]);
    // Contre-témoin : sans battement porteur, la question reste.
    expect(questionsAWill({ ...e, fenetresRecues: false }, T0)).toEqual(["interrompue"]);
    expect(questionsAWill(e, T0)).toEqual(["interrompue"]);
  });

  it("extension : le battement porte les fenêtres, l'ouverte marquée", () => {
    const etat = {
      debutMs: 1_000_000,
      fenetresHorsAccord: [
        { debutMs: 10_000, finMs: 20_000 },
        { debutMs: 50_000, finMs: null },
      ],
    };
    expect(fenetresAuBattement(etat, 1_000_000 + 70_000)).toEqual([
      { debutMs: 10_000, finMs: 20_000 },
      { debutMs: 50_000, finMs: 70_000, ouverte: true },
    ]);
  });

  it("une fin tardive après la transcription exclut sa fenêtre, purge le son, fait réécrire et alerte", async () => {
    const db = fausseBase();
    base.db = db;
    const { appareilId, adminUserId } = semerAppareil(db);
    const { rencontreId } = semerRencontreTest(db);
    const id = semerEnregistrement(db, {
      rencontreId,
      appareilId,
      statut: "transcrit",
      motifArret: "cloture_serveur",
    });
    const tr = db.semer("transcription", {
      id: "00000000-0000-4000-8000-0000000000a1",
      enregistrementId: id,
      version: 1,
      statut: "retenue",
      modele: "m",
      langue: "fr",
      empreinteEntree: "x",
    });
    // Sans début réel, l'origine est le début du premier enregistrement (T0) :
    // un segment à 125 s tombe dans la fenêtre 120-140 s, celui à 30 s non.
    const decalage = 0;
    for (const [ordre, debutMs] of [
      [1, 30_000],
      [2, 125_000],
    ] as const) {
      db.semer("transcriptionSegment", {
        transcriptionId: tr["id"],
        ordre,
        trancheId: "00000000-0000-4000-8000-000000000001",
        debutMs: debutMs + decalage,
        finMs: debutMs + decalage + 5_000,
        piste: "client",
        texte: "chiffré",
        horsAccord: false,
        apresRefus: false,
      });
    }
    db.semer("compteRendu", {
      id: "00000000-0000-4000-8000-0000000000c1",
      rencontreId,
      version: 1,
      statut: "a_valider",
      contenu: "texte",
      verification: "etat",
    });
    const stockage = fauxStockage();
    for (const numero of [0, 1]) {
      const tranche = db.semer("enregistrementTranche", {
        enregistrementId: id,
        piste: "client",
        numero,
        statut: "transcrite",
        debutCaptureEpochMs: BigInt(T0.getTime() + numero * 180_000),
        dureeMs: 180_000,
        motifDebut: "nouvelle_tranche",
      });
      const cle = `audio/${id}/client/${numero}/0`;
      stockage.objets.set(cle, Buffer.from("x"));
      db.semer("enregistrementMorceau", { trancheId: tranche["id"], seq: 0, cleR2: cle });
    }
    const r = await terminerSession(commePrisma(db), {
      appareil: { id: appareilId, adminUserId },
      enregistrementId: id,
      stockage,
      maintenant: new Date(T0.getTime() + 3 * 3_600_000),
      corps: {
        finLe: new Date(T0.getTime() + 20 * MINUTE).toISOString(),
        motif: "manuel",
        perdus: [],
        fenetresHorsAccord: [{ debutMs: 120_000, finMs: 140_000 }],
        evenements: [],
      },
    });
    expect(r.statut).toBe(200);
    const segs = db.lignes("transcriptionSegment");
    expect(segs.find((s) => s["ordre"] === 2)).toMatchObject({ horsAccord: true, texte: "" });
    expect(segs.find((s) => s["ordre"] === 1)).toMatchObject({ horsAccord: false });
    expect(String(db.lignes("enregistrement")[0]?.["fenetresHorsAccord"])).toContain("120000");
    // Le compte rendu est vidé et sa réécriture programmée.
    expect(db.lignes("compteRendu")[0]).toMatchObject({ statut: "a_regenerer", contenu: "" });
    expect(db.bruts.some((b) => b.valeurs.includes("rediger"))).toBe(true);
    // Le son de la tranche qui chevauche la fenêtre quitte R2 ; l'autre reste.
    expect([...stockage.objets.keys()]).toEqual([`audio/${id}/client/1/0`]);
    expect(
      db.lignes("alerteSysteme").filter((a) => a["code"] === CODES_ALERTES_VISIO.fenetreTardive),
    ).toHaveLength(1);
  });
});
