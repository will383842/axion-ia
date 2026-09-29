#!/usr/bin/env tsx
/**
 * Reprise de l'historique Calendly dans le dossier client (chantier visio,
 * PR 4 ; plan V-07b). La logique vit dans
 * `src/features/dossier-client/reprise-historique.ts` (testée) ; ce script
 * ne fait que l'appeler et compter.
 *
 * Règles :
 *   · essai à blanc PAR DÉFAUT : rien n'est écrit sans `--appliquer` ;
 *   · IDEMPOTENT : un second lancement ne crée rien ;
 *   · s'arrête si `PII_ENCRYPTION_KEY` manque (aucune réponse en clair) ;
 *   · sortie en NOMBRES seulement : ni nom, ni adresse, ni réponse.
 *
 * À lancer AVANT d'allumer `DOSSIER_BALAYAGE_ENABLED` sur le worker.
 *
 * N'importe que `src/**` : il peut être copié dans le conteneur du worker
 * (`/app/scripts/visio/`), qui a la clé de chiffrement.
 *
 * Usage :
 *   pnpm exec tsx scripts/visio/reprendre-historique-calendly.ts              # à blanc
 *   pnpm exec tsx scripts/visio/reprendre-historique-calendly.ts --appliquer  # réel
 */

import { reprendreHistoriqueCalendly } from "@/features/dossier-client/reprise-historique";
import type { BaseTransactionnelle, Tx } from "@/features/dossier-client/base";

async function main(): Promise<void> {
  const appliquer = process.argv.includes("--appliquer");
  const { prisma } = await import("@/lib/prisma");
  console.log(
    appliquer
      ? "== REPRISE DE L'HISTORIQUE CALENDLY — écriture RÉELLE =="
      : "== REPRISE DE L'HISTORIQUE CALENDLY — essai à blanc (--appliquer pour écrire) ==",
  );
  const b = await reprendreHistoriqueCalendly(prisma as unknown as Tx & BaseTransactionnelle, {
    appliquer,
  });
  console.log(`rendez-vous éligibles (liste blanche, avant la borne) : ${b.eligibles}`);
  console.log(`  déjà repris                                         : ${b.dejaReprises}`);
  console.log(`rencontres créées                                     : ${b.rencontresCreees}`);
  console.log(`faits « formulaire Calendly » créés (proposés)        : ${b.faitsCrees}`);
  console.log(`suivis repris                                         : ${b.suivisRepris}`);
  console.log(`suivis anciens incomplets (non repris)                : ${b.suivisIncomplets}`);
  await prisma.$disconnect();
}

const lanceDirectement = /reprendre-historique-calendly\.[cm]?[jt]s$/.test(process.argv[1] ?? "");
if (lanceDirectement) {
  main().catch((err: unknown) => {
    console.error(
      "[reprendre-historique-calendly] échec :",
      err instanceof Error ? err.message : err,
    );
    process.exit(1);
  });
}
