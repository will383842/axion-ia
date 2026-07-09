/**
 * Backfill `trainer_habilitations` depuis `trainers.formations_habilitees` (text[]).
 *
 * Exécution (post-deploy de la migration
 * `20260710090000_trainer_habilitations_availabilities`, UNE fois ; DATABASE_URL réel) :
 *   ```bash
 *   pnpm tsx prisma/scripts/backfill-trainer-habilitations-2026-07-10.ts
 *   ```
 *
 * Idempotent : `createMany({ skipDuplicates: true })` sur la contrainte unique
 * `(trainer_id, formation_id)`. Peut être rejoué sans effet de bord. Ne mute
 * JAMAIS `trainers` (lecture seule) → la pagination par offset est sûre.
 *
 * ── Le piège que ce script révèle ────────────────────────────────────────────
 * Le `text[]` n'avait aucune clé étrangère : il a pu accumuler des identifiants
 * de formations SUPPRIMÉES depuis. La table, elle, en a une. Ces identifiants
 * fantômes ne peuvent donc pas être insérés — le script les DÉTECTE, les IGNORE,
 * et les liste en fin d'exécution. Les taire créerait une divergence silencieuse
 * entre le tableau (qui les garde) et la table (qui ne les a pas) ; les insérer
 * est impossible. C'est exactement la corruption que la normalisation corrige.
 *
 * Vérification post-exécution (doit renvoyer 0, hors formations supprimées) :
 *   SELECT COUNT(*) FROM trainers t, unnest(t.formations_habilitees) AS fid
 *   WHERE EXISTS (SELECT 1 FROM formations f WHERE f.id = fid::uuid)
 *     AND NOT EXISTS (
 *       SELECT 1 FROM trainer_habilitations th
 *       WHERE th.trainer_id = t.id AND th.formation_id = fid::uuid);
 */

import { PrismaClient } from "../generated/client";

const prisma = new PrismaClient();
const BATCH = 500;

async function main(): Promise<void> {
  const formations = await prisma.formation.findMany({ select: { id: true } });
  const formationsConnues = new Set(formations.map((f) => f.id));

  let offset = 0;
  let lus = 0;
  let inseres = 0;
  const fantomes: { trainerId: string; formationId: string }[] = [];

  for (;;) {
    const trainers = await prisma.trainer.findMany({
      select: { id: true, formationsHabilitees: true },
      orderBy: { id: "asc" },
      skip: offset,
      take: BATCH,
    });
    if (trainers.length === 0) break;

    for (const t of trainers) {
      lus += 1;
      const valides: string[] = [];
      for (const formationId of t.formationsHabilitees) {
        if (formationsConnues.has(formationId)) valides.push(formationId);
        else fantomes.push({ trainerId: t.id, formationId });
      }
      if (valides.length === 0) continue;

      const res = await prisma.trainerHabilitation.createMany({
        data: valides.map((formationId) => ({ trainerId: t.id, formationId })),
        skipDuplicates: true,
      });
      inseres += res.count;
    }

    offset += trainers.length;
  }

  console.log(
    `[backfill-habilitations] ${lus} formateur(s) lus, ${inseres} habilitation(s) créée(s).`,
  );

  if (fantomes.length > 0) {
    console.warn(
      `[backfill-habilitations] ⚠️ ${fantomes.length} référence(s) vers une formation SUPPRIMÉE, ignorée(s) :`,
    );
    for (const f of fantomes) {
      console.warn(`  trainer=${f.trainerId} formation=${f.formationId} (introuvable)`);
    }
    console.warn(
      "[backfill-habilitations] Ces identifiants restent dans `formations_habilitees`. " +
        "Les retirer via l'écran « Formateurs » réalignera le tableau et la table.",
    );
  }
}

main()
  .catch((e: unknown) => {
    console.error("[backfill-habilitations] ÉCHEC", e);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
