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

/**
 * Lecture nue d'une clé ContentGenConfig, sans passer par la Server Action.
 *
 * Même sémantique de fusion que `readContentGenConfig` (les défauts d'un objet
 * simple sont fusionnés en surface), à une différence près : les erreurs ne sont
 * PAS avalées, elles remontent. L'appelant décide de sa politique — ce qui
 * permet notamment de traiter une panne DB en fail-SAFE là où c'est nécessaire
 * (cf. `readKillSwitchFailSafe`), au lieu de retomber silencieusement sur un
 * défaut permissif.
 */
export async function readContentGenConfigDirect<T>(key: string, defaultValue: T): Promise<T> {
  const row = await prisma.contentGenConfig.findUnique({ where: { key } });
  if (!row) return defaultValue;
  const stored = row.value as unknown;
  const isPlainObject = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);
  if (isPlainObject(defaultValue) && isPlainObject(stored)) {
    return { ...defaultValue, ...stored } as T;
  }
  return stored as T;
}

export interface KillSwitchState {
  readonly active: boolean;
  readonly reason?: string;
  readonly activatedAt?: string;
  /** true = posé automatiquement (garde-fou quota), false/absent = décision humaine. */
  readonly auto?: boolean;
}

/**
 * Lecture du kill switch en fail-SAFE.
 *
 * Fix 2026-08-15 (audit e2e) — `readContentGenConfig` avale toute erreur et
 * retombe sur le défaut. Pour le kill switch, ce défaut est `{active:false}` :
 * une simple erreur DB transitoire « dé-gelait » donc silencieusement un arrêt
 * d'urgence. Un interrupteur de sécurité doit tomber du côté sûr : si l'état ne
 * peut pas être lu, on considère la production comme arrêtée.
 */
export async function readKillSwitchFailSafe(): Promise<KillSwitchState> {
  try {
    return await readContentGenConfigDirect<KillSwitchState>("kill_switch", { active: false });
  } catch (err) {
    console.error(
      "[kill-switch] lecture impossible — arrêt par précaution (fail-safe):",
      err instanceof Error ? err.message : err,
    );
    return { active: true, reason: "État du kill switch illisible (erreur base de données)" };
  }
}

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
