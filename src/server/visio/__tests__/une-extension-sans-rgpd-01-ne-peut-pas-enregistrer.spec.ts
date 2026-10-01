/**
 * ⛔ UNE EXTENSION SANS RGPD-01 NE PEUT PAS ENREGISTRER (V2, N2).
 *
 * La fenêtre « personne entrée sans accord » ouverte dès l'arrivée (RGPD-01)
 * n'existe que dans l'extension 1.1.0. Les versions 1.0.x parlent le même
 * contrat v1 : sans contrôle, une vieille copie non empaquetée enregistre
 * encore, et la voix d'une personne passée moins de 120 s part chez OpenAI.
 *
 * Le serveur refuse donc toute session `visio` d'une extension plus ancienne
 * que `VERSION_EXTENSION_MINIMALE` (409 `extension_trop_ancienne`), répond au
 * battement d'appareil qu'elle est trop ancienne, et le balayage alerte.
 *
 * Mutation qui rougit : retirer le contrôle de `creerOuReprendreSession` →
 * 1er cas. Comparer les versions comme des chaînes (« 1.10.0 » < « 1.9.0 »)
 * → 3e cas. Contre-témoin : la 1.1.0 est acceptée.
 */

import { describe, expect, it, vi } from "vitest";

const base = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy({}, { get: (_c, nom: string) => (base.db as Record<string, unknown>)[nom] }),
}));
vi.mock("@/server/qualiopi/alertes/evaluateur", () => ({
  evaluerAlertesDetaille: vi.fn(),
}));

import { CODES_ALERTES_VISIO } from "../alertes";
import { balayerEnregistreur } from "../balayage-enregistreur";
import { enregistrerBattementAppareil } from "../battement-appareil";
import { deposerMorceau } from "../morceaux";
import {
  creerOuReprendreSession,
  declarerAccord,
  declarerRefus,
  terminerSession,
  terminerTranche,
  versionAccepteePourVisio,
} from "../sessions";
import {
  commePrisma,
  corpsSession,
  fausseBase,
  fauxStockage,
  MINUTE,
  entetesMorceau,
  semerAppareil,
  semerEnregistrement,
  semerRencontreTest,
  T0,
} from "../../../../tests/outils/fixtures-enregistreur";

describe("une extension sans RGPD-01 ne peut pas enregistrer", () => {
  it("1.0.0 : 409 « extension_trop_ancienne », rien n'est créé", async () => {
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    const { rencontreId } = semerRencontreTest(db);
    const r = await creerOuReprendreSession(commePrisma(db), {
      appareil: { id: appareilId, adminUserId },
      corps: { ...corpsSession(rencontreId), versionExtension: "1.0.0" },
      mode: "pilote",
      maintenant: T0,
    });
    expect(r.statut).toBe(409);
    expect(r.corps["erreur"]).toBe("extension_trop_ancienne");
    expect(String(r.corps["message"])).toMatch(/mettez à jour/i);
    expect(db.lignes("enregistrement")).toHaveLength(0);
  });

  it("contre-témoin : 1.1.0 est acceptée", async () => {
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    const { rencontreId } = semerRencontreTest(db);
    const r = await creerOuReprendreSession(commePrisma(db), {
      appareil: { id: appareilId, adminUserId },
      corps: { ...corpsSession(rencontreId), versionExtension: "1.1.0" },
      mode: "pilote",
      maintenant: T0,
    });
    expect(r.statut).toBe(200);
  });

  it("les versions se comparent comme des nombres", () => {
    expect(versionAccepteePourVisio("1.10.0")).toBe(true);
    expect(versionAccepteePourVisio("2.0")).toBe(true);
    expect(versionAccepteePourVisio("1.0.9")).toBe(false);
    expect(versionAccepteePourVisio("pas-une-version")).toBe(false);
  });

  it("le battement d'appareil le dit, et le balayage alerte", async () => {
    const db = fausseBase();
    base.db = db;
    const { appareilId, adminUserId } = semerAppareil(db, {
      dernierBattementLe: new Date(T0.getTime() - MINUTE),
    });
    const r = await enregistrerBattementAppareil(commePrisma(db), {
      appareil: { id: appareilId, adminUserId },
      corps: {
        versionExtension: "1.0.0",
        versionContrat: 1,
        fileEnAttente: 0,
        agePlusVieuxMs: null,
        sessionActive: false,
      },
      maintenant: T0,
    });
    expect(r.corps["extensionTropAncienne"]).toBe(true);

    const notifier = vi.fn().mockResolvedValue(true);
    await balayerEnregistreur(commePrisma(db), notifier, {
      maintenant: T0,
      version: "t",
      env: { ENREGISTREMENT_VISIO_PILOTE: "true" },
      stockage: fauxStockage(),
    });
    const alertes = db
      .lignes("alerteSysteme")
      .filter((a) => a["code"] === CODES_ALERTES_VISIO.extensionTropAncienne);
    expect(alertes).toHaveLength(1);
    expect(alertes[0]?.["cibleId"]).toBe(appareilId);
  });

  it("une session déjà ouverte par une 1.0.0 : morceau, tranche, accord et fin refusés ; le refus passe", async () => {
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    const appareil = { id: appareilId, adminUserId };
    const { rencontreId } = semerRencontreTest(db);
    const id = semerEnregistrement(db, { rencontreId, appareilId, statut: "en_cours" });
    db.lignes("enregistrement")[0]!["versionExtension"] = "1.0.0";
    const son = Buffer.from("son");
    const h = entetesMorceau(son);
    const attendu = {
      statut: 409,
      corps: expect.objectContaining({ erreur: "extension_trop_ancienne" }),
    };
    expect(
      await deposerMorceau(commePrisma(db), fauxStockage(), {
        appareil,
        enregistrementId: id,
        entetes: {
          piste: h["x-piste"] ?? null,
          tranche: h["x-tranche"] ?? null,
          seq: h["x-seq"] ?? null,
          debutCaptureMs: h["x-debut-capture-ms"] ?? null,
          empreinte: h["x-empreinte"] ?? null,
        },
        octets: son,
        maintenant: T0,
      }),
    ).toMatchObject(attendu);
    expect(
      await terminerTranche(commePrisma(db), {
        appareil,
        enregistrementId: id,
        maintenant: T0,
        corps: {
          piste: "client",
          numero: 0,
          motifDebut: "demarrage",
          debutCaptureEpochMs: T0.getTime(),
          nbMorceaux: 1,
          empreinte: "0".repeat(64),
          dureeMs: 1000,
          finMuette: true,
        },
      }),
    ).toMatchObject(attendu);
    expect(
      await declarerAccord(commePrisma(db), {
        appareil,
        enregistrementId: id,
        maintenant: T0,
        corps: {
          accordLe: T0.toISOString(),
          nbParticipants: 2,
          versionTexte: "annonce-v1",
          nouvellePersonne: false,
        },
      }),
    ).toMatchObject(attendu);
    expect(
      await terminerSession(commePrisma(db), {
        appareil,
        enregistrementId: id,
        maintenant: T0,
        corps: {
          finLe: T0.toISOString(),
          motif: "manuel",
          perdus: [],
          fenetresHorsAccord: [],
          evenements: [],
        },
      }),
    ).toMatchObject(attendu);
    // Le refus, lui, n'est jamais bloqué.
    const refus = await declarerRefus(commePrisma(db), fauxStockage(), {
      appareil,
      enregistrementId: id,
      refusLe: T0,
      maintenant: T0,
    });
    expect(refus.corps["erreur"]).not.toBe("extension_trop_ancienne");
  });

  it("contre-témoin : version inconnue de la session, rien n'est refusé pour elle", async () => {
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    const { rencontreId } = semerRencontreTest(db);
    const id = semerEnregistrement(db, { rencontreId, appareilId, statut: "en_cours" });
    db.lignes("enregistrement")[0]!["versionExtension"] = null;
    const r = await terminerSession(commePrisma(db), {
      appareil: { id: appareilId, adminUserId },
      enregistrementId: id,
      maintenant: T0,
      corps: {
        finLe: T0.toISOString(),
        motif: "manuel",
        perdus: [],
        fenetresHorsAccord: [],
        evenements: [],
      },
    });
    expect(r.statut).toBe(200);
  });
});
