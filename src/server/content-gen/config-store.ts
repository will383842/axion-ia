/**
 * Content Generator — écriture ContentGenConfig utilisable hors requête HTTP.
 *
 * `writeContentGenConfig` (src/server/actions/content-gen/_settings.ts) est une
 * Server Action gardée par `requireAdminWriteRateLimited` → `auth()` → `headers()`.
 * Appelée depuis un worker BullMQ (aucune requête HTTP en cours), elle throw
 * « `headers` was called outside a request scope » et fait échouer le job.
 *
 * Ce module porte l'écriture nue (upsert + audit trail), sans guard admin :
 *  - les workers BullMQ l'appellent directement (acteur « system », pas de session) ;
 *  - la Server Action délègue ici APRÈS son check admin + rate-limit, qui restent
 *    donc intacts pour la surface admin.
 *
 * Le pendant lecture (`readContentGenConfig`) est déjà volontairement non-guardé
 * pour cette même raison (cf. l'en-tête de `_settings.ts`).
 *
 * ⚠️ NE PAS ajouter la directive "use server" en tête de ce fichier : chaque export
 * deviendrait un endpoint Server Action appelable par n'importe quel client — donc
 * une écriture de config sans authentification.
 */
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/server/content-gen/audit-log";

/** Acteur humain à l'origine de l'écriture. Absent = écriture système (worker). */
export interface ContentGenConfigActor {
  readonly userId?: string;
  readonly email?: string;
}

/**
 * Upsert d'une clé ContentGenConfig + entrée d'audit best-effort.
 *
 * @param updatedBy Identifiant libre tracé en base (userId admin, ou nom du worker).
 * @param actor     Session admin si l'écriture vient de l'UI ; omis côté worker.
 */
export async function persistContentGenConfig(
  key: string,
  value: unknown,
  updatedBy: string,
  description?: string,
  actor?: ContentGenConfigActor,
): Promise<void> {
  // Lu AVANT l'upsert pour capturer le delta (audit trail SOC2). Non atomique vs.
  // écriture concurrente, tolérable : l'audit n'est pas une source de vérité.
  const existing = await prisma.contentGenConfig.findUnique({
    where: { key },
    select: { value: true },
  });
  const oldValue = existing?.value ?? null;

  await prisma.contentGenConfig.upsert({
    where: { key },
    create: {
      key,
      value: value as never,
      description: description ?? null,
      updatedBy,
    },
    update: {
      value: value as never,
      ...(description !== undefined ? { description } : {}),
      updatedBy,
    },
  });

  // Append audit log best-effort (un échec n'invalide pas l'upsert ci-dessus).
  // `writeAuditLog` est déjà worker-safe : il encapsule `headers()` dans un
  // try/catch et log sans IP/UA hors contexte HTTP.
  await writeAuditLog({
    action: "writeContentGenConfig",
    settingKey: key,
    oldValue,
    newValue: value,
    ...(actor?.userId !== undefined ? { actorUserId: actor.userId } : {}),
    ...(actor?.email !== undefined ? { actorEmail: actor.email } : {}),
    ...(description !== undefined ? { description } : {}),
  });
}
