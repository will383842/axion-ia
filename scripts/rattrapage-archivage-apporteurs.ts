#!/usr/bin/env tsx
/**
 * Rattrapage de l'archivage automatique des apporteurs (2026-10-07).
 *
 * POURQUOI
 * --------
 * Depuis le 2026-10-07, une personne dont le contrat est contresigné, ou dont
 * l'issue de l'échange est « Non retenu », sort d'elle-même de la liste
 * « En cours » des apporteurs. Le passage automatique (worker, toutes les
 * 5 minutes) ne regarde que les 7 derniers jours ; ce script range les fiches
 * d'AVANT.
 *
 * CE QU'IL FAIT — ET NE FAIT PAS
 * ------------------------------
 * Il pose le statut « archivé » qui existe déjà, sur les lignes apporteur de ces
 * personnes. Il n'efface rien, ne purge rien, n'envoie aucun e-mail. Les fiches
 * restent visibles dans l'onglet « Archivés » (ou « Tous ») et « Désarchiver »
 * les rouvre.
 *
 * IDEMPOTENT : une ligne déjà archivée est sautée ; une ligne archivée
 * automatiquement puis désarchivée par Will porte une marque et n'est JAMAIS
 * ré-archivée. Le relancer ne fait rien de plus.
 *
 * USAGE (dans le conteneur worker, qui porte les sources)
 * -------------------------------------------------------
 *   pnpm rattrapage:archivage-apporteurs              # essai à blanc, n'écrit RIEN
 *   pnpm rattrapage:archivage-apporteurs --appliquer
 */

import { prisma } from "@/lib/prisma";
import { archiverApporteursTermines } from "@/features/commercial-application/archivage-auto-apporteurs";

async function main(): Promise<void> {
  const appliquer = process.argv.includes("--appliquer");
  const r = await archiverApporteursTermines({ appliquer, depuis: null });

  console.log("");
  console.log(`contrats contresignés          : ${r.personnesContresignees}`);
  console.log(`personnes « Non retenu »       : ${r.personnesNonRetenues}`);
  console.log(
    `${appliquer ? "fiches archivées              " : "fiches à archiver             "}: ${r.archivees}`,
  );
  console.log(`laissées ouvertes (désarchivées par Will) : ${r.laisseesOuvertes}`);
  console.log(
    `${appliquer ? "rouvertes (Non retenu → Retenu)" : "à rouvrir (Non retenu → Retenu)"}: ${r.desarchivees}`,
  );
  if (!appliquer) {
    console.log("");
    console.log("Essai à blanc. Relancer avec --appliquer pour écrire.");
  }
}

main()
  .catch((err) => {
    console.error("[rattrapage-archivage-apporteurs] échec :", err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
