/**
 * ContentGenAuditLog — SOC2 append-only audit trail.
 *
 * City Domination 2026-05-18 P1-9 (audit A10).
 *
 * Couvre l'exigence SOC2 "forensic trail" : qui a modifié quel setting, quand,
 * avec quelle valeur avant/après. Append-only — pas d'UPDATE/DELETE exposés
 * par le helper.
 *
 * Câblage actuel : `writeContentGenConfig()` (cf _settings.ts) écrit une ligne
 * par modification de ContentGenConfig avec diff oldValue → newValue.
 *
 * Extension future :
 *   - autres actions admin (kill-switch toggle, providers update, etc.)
 *     peuvent appeler `writeAuditLog()` directement avec leur propre action
 *     canonique
 *   - retention-purge-worker pourra purger > 24 mois si volume devient
 *     critique (legal hold SOC2 = 24 mois minimum côté autorité de
 *     certification)
 */

"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export interface AuditLogInput {
  /** Action canonique (writeContentGenConfig | updateBatchSettings | ...). */
  readonly action: string;
  /** Setting modifié (nullable si action transverse). */
  readonly settingKey?: string;
  /** Valeur avant. NULL si création. */
  readonly oldValue?: unknown;
  /** Valeur après. NULL si suppression. */
  readonly newValue?: unknown;
  /** Admin actor (userId + email). */
  readonly actorUserId?: string;
  readonly actorEmail?: string;
  /** Description libre éditoriale (optional). */
  readonly description?: string;
}

/**
 * Append une ligne audit log. Best-effort : échec ne bloque pas l'action
 * principale (log côté Sentry à venir M11 si besoin). SOC2 tolère un audit
 * trail partiel si la perte est tracée, mais on évite de casser writes admin
 * pour un problème observability.
 */
export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  // Capture User-Agent + IP forwarded depuis la request headers Next 16.
  // Nullable si appelé hors contexte HTTP (workers BullMQ).
  let actorIp: string | null = null;
  let actorUa: string | null = null;
  try {
    const h = await headers();
    actorUa = (h.get("user-agent") ?? "").slice(0, 500) || null;
    // Priorité X-Forwarded-For (Caddy + Cloudflare). On garde uniquement le
    // premier hop (client réel — les hops Caddy/Cloudflare sont après).
    const xff = h.get("x-forwarded-for");
    if (xff) {
      actorIp = xff.split(",")[0]?.trim().slice(0, 64) ?? null;
    } else {
      actorIp = (h.get("x-real-ip") ?? "").slice(0, 64) || null;
    }
  } catch {
    // headers() throw si hors request context — c'est OK, on log sans IP/UA.
  }

  try {
    await prisma.contentGenAuditLog.create({
      data: {
        action: input.action.slice(0, 64),
        ...(input.settingKey !== undefined ? { settingKey: input.settingKey.slice(0, 128) } : {}),
        ...(input.oldValue !== undefined ? { oldValue: input.oldValue as never } : {}),
        ...(input.newValue !== undefined ? { newValue: input.newValue as never } : {}),
        ...(input.actorUserId !== undefined ? { actorUserId: input.actorUserId } : {}),
        ...(input.actorEmail !== undefined ? { actorEmail: input.actorEmail.slice(0, 255) } : {}),
        ...(actorIp !== null ? { actorIp } : {}),
        ...(actorUa !== null ? { actorUa } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
    });
  } catch (err) {
    // Best-effort. SOC2 prévoit perte partielle si tracée. On console-log
    // en dev pour visibilité (en prod, Sentry capture via instrumentation).
    if (process.env["NODE_ENV"] !== "production") {
      console.warn("[audit-log] failed to write SOC2 trail", err);
    }
  }
}
