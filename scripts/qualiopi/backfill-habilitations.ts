/**
 * Qualiopi — Backfill des habilitations formateur (audit certification 2026-07-25, F11).
 *
 * Contexte. Le schéma déclare `TrainerHabilitation` comme remplaçant de la colonne
 * legacy `Trainer.formationsHabilitees` (`String[]`), avec la mention « le tableau
 * reste écrit en dual-write le temps du backfill ». Ce backfill n'avait jamais été
 * exécuté :
 *
 *   - `trainers.formations_habilitees` : 33 entrées en production ;
 *   - `trainer_habilitations`          : 0 ligne ;
 *   - la liste des formateurs comptait la colonne legacy → « 33 » ;
 *   - la garde d'assignation lit la table relationnelle → « non habilité » ;
 *   - résultat : aucune session ne pouvait recevoir de formateur.
 *
 * Complication : la colonne legacy contient des SLUGS (`ia-pour-bien-commencer`),
 * alors que les lecteurs restants attendent des UUID. Ces valeurs ne se résolvaient
 * donc plus nulle part. Ce script résout par slug PUIS par id, pour ne rien perdre
 * quel que soit le format historique.
 *
 * Propriétés :
 *   - idempotent (skipDuplicates sur la contrainte trainer+formation) ;
 *   - non destructif — la colonne legacy n'est pas touchée ;
 *   - `--dry-run` par défaut : n'écrit rien sans `--apply`.
 *
 * Usage :
 *   pnpm tsx scripts/qualiopi/backfill-habilitations.ts            # simulation
 *   pnpm tsx scripts/qualiopi/backfill-habilitations.ts --apply    # écriture
 */

import { prisma } from "../../src/lib/prisma";

const APPLY = process.argv.includes("--apply");

interface Rapport {
  trainer: string;
  resolues: number;
  inconnues: string[];
  archivees: number;
}

async function main(): Promise<void> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    console.error("DATABASE_URL est un stub de build — rien à faire.");
    return;
  }

  const trainers = await prisma.trainer.findMany({
    select: { id: true, nom: true, prenom: true, formationsHabilitees: true },
  });

  const rapports: Rapport[] = [];
  let totalInseres = 0;

  for (const t of trainers) {
    const refs = t.formationsHabilitees.filter((r) => r.trim().length > 0);
    if (refs.length === 0) continue;

    // Résolution tolérante : la colonne a porté des slugs puis des UUID.
    const formations = await prisma.formation.findMany({
      where: { OR: [{ slug: { in: refs } }, { id: { in: refs } }] },
      select: { id: true, slug: true, statut: true },
    });

    const trouves = new Set<string>();
    for (const f of formations) {
      trouves.add(f.slug);
      trouves.add(f.id);
    }
    const inconnues = refs.filter((r) => !trouves.has(r));
    const archivees = formations.filter((f) => f.statut === "archive").length;

    if (APPLY && formations.length > 0) {
      const res = await prisma.trainerHabilitation.createMany({
        data: formations.map((f) => ({
          trainerId: t.id,
          formationId: f.id,
          // Reprise d'historique : on ne connaît ni la date ni l'auteur d'origine.
          // La note le dit explicitement plutôt que d'inventer une traçabilité.
          note: "Reprise d'historique — backfill 2026-07-25 depuis Trainer.formationsHabilitees (auteur et date d'origine inconnus).",
        })),
        skipDuplicates: true,
      });
      totalInseres += res.count;
    }

    rapports.push({
      trainer: `${t.prenom} ${t.nom}`,
      resolues: formations.length,
      inconnues,
      archivees,
    });
  }

  console.log(APPLY ? "=== BACKFILL APPLIQUÉ ===" : "=== SIMULATION (--apply pour écrire) ===");
  for (const r of rapports) {
    console.log(
      `${r.trainer} : ${r.resolues} résolue(s) dont ${r.archivees} sur formation ARCHIVÉE` +
        (r.inconnues.length > 0
          ? ` — ${r.inconnues.length} introuvable(s) : ${r.inconnues.join(", ")}`
          : ""),
    );
  }
  if (APPLY) console.log(`\n${totalInseres} habilitation(s) insérée(s).`);

  const surArchive = rapports.reduce((n, r) => n + r.archivees, 0);
  if (surArchive > 0) {
    console.log(
      `\n⚠️  ${surArchive} habilitation(s) portent sur des formations ARCHIVÉES : elles sont` +
        ` reprises pour ne rien perdre, mais ne rendent personne assignable sur le catalogue` +
        ` actuel. Les habilitations sur les formations ACTIVES restent à saisir — c'est une` +
        ` décision de compétence (indicateur 21), pas une reprise technique.`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
