/**
 * CHANTIER QNC, LOT L10 — VEILLE ET REVUE contre un vrai Postgres migré à neuf
 * (Gate D).
 *
 * ⚠️ Rangé dans `verrou-dossier/` pour la même raison que le socle L00 : Gate D
 * ne lance que des dossiers nommés, et ce lot n'a pas le droit de toucher
 * `.github/workflows/**`.
 *
 * Prouve, interrupteurs ALLUMÉS (`actif`) et triggers du socle en place, chaque
 * cas dans SA transaction ANNULÉE :
 *   - décider, corriger, archiver une veille ne font QUE des INSERT : le
 *     trigger `veilles_ajout_seul`, qui refuse toute réécriture, ne les gêne
 *     pas ; la réécriture directe, elle, est refusée ;
 *   - la ligne et sa trace `activity_logs` partent ensemble, et la règle
 *     partagée des indicateurs 23-25 ne retient que la version décidée par une
 *     personne ;
 *   - le registre AXI-AMC numérote dans la série de l'année et s'écrit en
 *     ajout seul ; une étape refusée n'écrit rien ;
 *   - le plan d'actions d'une revue ne se réécrit plus.
 *
 * Sans `DATABASE_URL`, ce fichier ÉCHOUE — il ne se saute pas.
 */

import { describe, expect, it } from "vitest";

import { PrismaClient } from "../../../prisma/generated/client";
import { basculerInterrupteurQualiopi } from "../../../src/server/qualiopi/socle/interrupteurs";
import {
  archiverVeille,
  corrigerVeille,
  creerVeilleTracee,
  deciderVeille,
} from "../../../src/server/qualiopi/veille/veille-tracee";
import { lireJournalVeilles } from "../../../src/server/qualiopi/veille/regle-veille";
import { idsVeillesDecidees } from "../../../src/server/qualiopi/veille/trace-veille";
import {
  ajouterEtapeAmelioration,
  listerActionsAmelioration,
  ouvrirActionAmelioration,
} from "../../../src/server/qualiopi/amelioration/registre-amc";
import { whereVeilleExploitee } from "../../../src/server/qualiopi/conformite/veille-exploitee";

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

const ANNULE = new Error("ANNULE — la transaction de test ne laisse aucune ligne");
const ADMIN_ID = "00000000-0000-4000-8000-000000000a10";

async function dansTransactionAnnulee(fn: (tx: Tx) => Promise<void>): Promise<void> {
  const db = new PrismaClient();
  try {
    await expect(
      db.$transaction(
        async (tx) => {
          await fn(tx);
          throw ANNULE;
        },
        { timeout: 30_000 },
      ),
    ).rejects.toBe(ANNULE);
  } finally {
    await db.$disconnect();
  }
}

/** Un faux client dont `$transaction` exécute dans la transaction de test. */
function dans(tx: Tx): { $transaction: <T>(fn: (x: Tx) => Promise<T>) => Promise<T> } {
  return { $transaction: (fn) => fn(tx) };
}

async function allumer(tx: Tx): Promise<void> {
  await tx.adminUser.create({
    data: {
      id: ADMIN_ID,
      name: "Test QNC L10",
      email: "qnc-l10@test.invalid",
      passwordHash: "x",
      role: "super_admin",
    },
  });
  for (const lot of ["veille", "amelioration"]) {
    await basculerInterrupteurQualiopi(
      { lot, etat: "actif", adminUserId: ADMIN_ID },
      dans(tx) as never,
    );
  }
}

async function refuse(tx: Tx, sql: string, motif: RegExp): Promise<void> {
  await tx.$executeRawUnsafe("SAVEPOINT attente");
  await expect(tx.$executeRawUnsafe(sql)).rejects.toThrow(motif);
  await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT attente");
}

describe("veille et revue (L10) contre un vrai Postgres (Gate D)", () => {
  it("veille allumée : décider, corriger, archiver n'écrivent qu'en ajout ; réécrire est refusé", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await allumer(tx);
      const db = dans(tx) as never;
      const v1 = await creerVeilleTracee(db, {
        type: "legale",
        source: "Légifrance",
        titre: "Décret 2026-728",
        contenu: "Le référentiel passe à 33 indicateurs.",
        auteurId: ADMIN_ID,
      });
      const v2 = await deciderVeille(db, {
        veilleId: v1.id,
        decision: "Mettre à jour la procédure qualité P04",
        pieceModifiee: "Procédure P04 v3",
        auteurId: ADMIN_ID,
      });
      const v3 = await corrigerVeille(db, {
        veilleId: v2.id,
        titre: "Décret n° 2026-728",
        motif: "Référence exacte du décret",
        auteurId: ADMIN_ID,
      });
      await expect(
        archiverVeille(db, {
          veilleId: v2.id,
          motif: "Tentative sur une version remplacée",
          auteurId: ADMIN_ID,
        }),
      ).rejects.toThrow(/archivée/);

      // Rien n'a été réécrit : trois lignes, la première sans décision.
      const lignes = await tx.veille.findMany({ orderBy: { createdAt: "asc" } });
      expect(lignes.map((l) => l.actionDecidee)).toEqual([
        null,
        "Mettre à jour la procédure qualité P04",
        "Mettre à jour la procédure qualité P04",
      ]);
      // La réécriture directe reste refusée par la base.
      await refuse(tx, `UPDATE "veilles" SET "titre" = 'Réécrit'`, /veilles est en ajout seul/);
      await refuse(tx, `DELETE FROM "veilles"`, /veilles est en ajout seul/);

      // Le journal dit qui a décidé ; seule la dernière version couvre l'indicateur.
      const trace = await lireJournalVeilles(tx as never);
      expect(idsVeillesDecidees(trace)).toEqual([v3.id]);
      const couvre = await tx.veille.count({
        where: whereVeilleExploitee("legale", new Date(), {
          idsDecidees: idsVeillesDecidees(trace),
        }),
      });
      expect(couvre).toBe(1);
      const journaux = await tx.activityLog.count({
        where: { targetType: "Veille", adminUserId: ADMIN_ID },
      });
      // création + décision + archivage v1 + correction + archivage v2
      expect(journaux).toBe(5);
    });
  });

  it("registre AXI-AMC : numéro de la série, étapes en ajout seul, refus sans écriture", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await allumer(tx);
      const db = dans(tx) as never;
      const maintenant = new Date("2026-06-15T10:00:00Z");
      const a = await ouvrirActionAmelioration(
        db,
        {
          origine: "veille",
          constat: "Décret 2026-728",
          action: "Mettre à jour P04",
          auteurId: ADMIN_ID,
          auteurNom: "Will",
        },
        { maintenant },
      );
      const b = await ouvrirActionAmelioration(
        db,
        {
          origine: "reclamation",
          constat: "Retard",
          action: "Relance J-7",
          auteurId: ADMIN_ID,
          auteurNom: "Will",
        },
        { maintenant },
      );
      expect([a.numero, b.numero]).toEqual(["AXI-AMC-2026-001", "AXI-AMC-2026-002"]);

      await expect(
        ajouterEtapeAmelioration(db, {
          actionId: a.id,
          etape: "realisee",
          commentaire: "Procédure publiée",
          auteurId: ADMIN_ID,
          auteurNom: "Will",
        }),
      ).rejects.toThrow(/mise en œuvre/);
      await ajouterEtapeAmelioration(db, {
        actionId: a.id,
        etape: "mise_en_oeuvre",
        commentaire: "",
        responsable: "Will",
        echeance: "2026-12-01",
        auteurId: ADMIN_ID,
        auteurNom: "Will",
      });
      const lues = await listerActionsAmelioration(tx as never, { annee: 2026 });
      const lue = lues.find((x) => x.id === a.id);
      expect(lue?.etapes.map((e) => e.etape)).toEqual(["mise_en_oeuvre"]);

      await refuse(tx, `UPDATE "actions_amelioration" SET "action" = 'Réécrite'`, /ajout seul/);
      await refuse(tx, `DELETE FROM "actions_amelioration_etapes"`, /ajout seul/);
    });
  });

  it("revue de direction : registre allumé, le plan d'actions ne se réécrit plus", async () => {
    await dansTransactionAnnulee(async (tx) => {
      await allumer(tx);
      await tx.$executeRawUnsafe(
        `INSERT INTO "revues_direction" ("id", "annee", "date_revue", "plan_actions", "updated_at")
         VALUES (gen_random_uuid(), 1998, now(), '["Historique"]', now())`,
      );
      await refuse(
        tx,
        `UPDATE "revues_direction" SET "plan_actions" = '[]' WHERE "annee" = 1998`,
        /plan_actions est en lecture seule/,
      );
    });
  });
});
