#!/usr/bin/env tsx
/**
 * Le CLIENT FICTIF du pilote (chantier visio, PR 4 ; plan V-05b, jalon O-1).
 *
 *   --creer   crée la fiche « Atelier Test Fictif » PAR LA PORTE UNIQUE
 *             (`creerOuRetrouverClient`) et l'inscrit dans
 *             `clients_test_interne` — c'est ce qui rend le mode pilote
 *             disponible et la case « test interne » visible sur SA fiche ;
 *   --purger  supprime TOUTES les données du pilote (`purgerPilote()` de
 *             `src/lib/rgpd-erase.ts`, seul module qui pose le drapeau
 *             d'effacement), journal `EffacementJournal(pilote)` ; la fiche
 *             fictive reste, elle resservira.
 * Sans `--appliquer`, essai à blanc : rien n'est écrit, le script dit ce qu'il
 * ferait. Sortie en nombres seulement.
 *
 * Fenêtre de vie en production : de l'essai réel de la PR 6 à la fin du
 * jalon O-1 ; chaque création et chaque purge sont consignées hors dépôt
 * (`07-execution/PREUVE-PILOTE.md`).
 *
 * Usage :
 *   pnpm exec tsx scripts/visio/pilote.ts --creer [--appliquer]
 *   pnpm exec tsx scripts/visio/pilote.ts --purger [--appliquer]
 */

import type { BaseTransactionnelle, Tx } from "@/features/dossier-client/base";
import { creerOuRetrouverClient } from "@/server/qualiopi/crm/porte-client";

/** Le nom de la fiche fictive — jamais une vraie entreprise. */
export const NOM_CLIENT_FICTIF = "Atelier Test Fictif";

export interface BilanPilote {
  readonly action: "creer" | "purger";
  readonly appliquer: boolean;
  readonly fichesFictives: number;
  readonly fichesCreees: number;
  readonly rencontresDeTest: number;
}

export async function creerClientFictif(
  db: Tx & BaseTransactionnelle,
  appliquer: boolean,
): Promise<BilanPilote> {
  const existantes = await db.clientTestInterne.count();
  const rencontresDeTest = await db.rencontre.count({ where: { estTestInterne: true } });
  if (existantes > 0 || !appliquer) {
    return {
      action: "creer",
      appliquer,
      fichesFictives: existantes,
      fichesCreees: 0,
      rencontresDeTest,
    };
  }
  const r = await creerOuRetrouverClient(
    db,
    { type: "entreprise", raisonSociale: NOM_CLIENT_FICTIF, source: "pilote" },
    null,
    { parAdminId: null },
  );
  if (r.statut !== "cree") {
    throw new Error(`la porte a refusé la fiche fictive : ${r.message}`);
  }
  await db.clientTestInterne.create({ data: { clientId: r.id } });
  return { action: "creer", appliquer, fichesFictives: 1, fichesCreees: 1, rencontresDeTest };
}

async function main(): Promise<void> {
  const appliquer = process.argv.includes("--appliquer");
  const creer = process.argv.includes("--creer");
  const purger = process.argv.includes("--purger");
  if (creer === purger) {
    console.error("Usage : pilote.ts --creer|--purger [--appliquer]");
    process.exit(2);
  }
  const { prisma } = await import("@/lib/prisma");
  const db = prisma as unknown as Tx & BaseTransactionnelle;
  if (creer) {
    const b = await creerClientFictif(db, appliquer);
    console.log(`fiches fictives : ${b.fichesFictives} · créées maintenant : ${b.fichesCreees}`);
    if (!appliquer) console.log("(essai à blanc : --appliquer pour créer)");
  } else {
    const rencontres = await db.rencontre.count({ where: { estTestInterne: true } });
    console.log(
      `rencontres de test à supprimer : ${rencontres} (et tout le dossier de la fiche fictive)`,
    );
    if (appliquer) {
      const { purgerPilote } = await import("@/lib/rgpd-erase");
      const r = await purgerPilote();
      console.log(
        `supprimés : ${r.rencontres} rencontre(s), ${r.faits} fait(s), ${r.projets} projet(s), ` +
          `${r.personnes} personne(s), ${r.preuvesAccord} preuve(s) d'accord`,
      );
    } else {
      console.log("(essai à blanc : --appliquer pour purger)");
    }
  }
  await prisma.$disconnect();
}

const lanceDirectement = /pilote\.[cm]?[jt]s$/.test(process.argv[1] ?? "");
if (lanceDirectement) {
  main().catch((err: unknown) => {
    console.error("[pilote] échec :", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
