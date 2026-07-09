/**
 * Backfill `session_formateurs` depuis l'état legacy des sessions
 * (`formateur_principal_id` FK + `co_formateurs` Json) — P0 Cockpit Pilotage.
 *
 * Exécution (post-deploy de la migration `20260709120000_session_formateurs`,
 * une seule fois ; DATABASE_URL réel requis) :
 *   ```bash
 *   pnpm tsx prisma/scripts/backfill-session-formateurs-2026-07-09.ts
 *   ```
 *
 * Idempotent : upsert sur la contrainte unique (session_id, trainer_id). Peut
 * être ré-exécuté sans effet de bord (réaligne role/heures si divergents). Ne
 * mute JAMAIS `training_sessions` (lecture seule) → pagination offset sûre.
 * Batch 500 sessions.
 *
 * Vérification post-exécution (doit renvoyer 0) :
 *   SELECT COUNT(*) FROM training_sessions ts
 *   WHERE ts.formateur_principal_id IS NOT NULL
 *     AND NOT EXISTS (
 *       SELECT 1 FROM session_formateurs sf
 *       WHERE sf.session_id = ts.id
 *         AND sf.trainer_id = ts.formateur_principal_id
 *         AND sf.role = 'principal');
 */

import { PrismaClient } from "../generated/client";
import { buildSessionFormateurRows } from "../../src/server/qualiopi/trainers/session-formateurs";

const prisma = new PrismaClient();
const BATCH = 500;

async function main(): Promise<void> {
  let offset = 0;
  let sessionsSeen = 0;
  let rowsUpserted = 0;

  for (;;) {
    const batch = await prisma.trainingSession.findMany({
      select: { id: true, formateurPrincipalId: true, coFormateurs: true },
      orderBy: { createdAt: "asc" },
      take: BATCH,
      skip: offset,
    });
    if (batch.length === 0) break;

    for (const s of batch) {
      const rows = buildSessionFormateurRows({
        formateurPrincipalId: s.formateurPrincipalId,
        coFormateurs: s.coFormateurs,
      });
      for (const row of rows) {
        await prisma.sessionFormateur.upsert({
          where: { sessionId_trainerId: { sessionId: s.id, trainerId: row.trainerId } },
          create: {
            sessionId: s.id,
            trainerId: row.trainerId,
            role: row.role,
            heuresAnimees: row.heuresAnimees,
          },
          update: {
            role: row.role,
            heuresAnimees: row.heuresAnimees,
          },
        });
        rowsUpserted += 1;
      }
      sessionsSeen += 1;
    }

    offset += batch.length;
    console.log(`… ${sessionsSeen} sessions traitées, ${rowsUpserted} affectations upsert`);
  }

  console.log(
    `✅ Backfill terminé : ${sessionsSeen} sessions, ${rowsUpserted} lignes session_formateurs.`,
  );
}

main()
  .catch((e: unknown) => {
    console.error("❌ Backfill échoué :", e);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
