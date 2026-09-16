/**
 * Content Generator — ActivityLog audit trail helper (P1-F fix audit
 * opérationnel 2026-05-15).
 *
 * Master prompt § 12.3bis + § 0.5 RGPD Article 30 — chaque action admin
 * sensible doit laisser une trace audit (qui, quand, sur quoi, quel diff).
 * GenerationLog couvre uniquement les étapes worker BG ; ActivityLog couvre
 * les actions humaines admin.
 *
 * Pattern : appeler `logActivity({...})` après chaque Server Action mutante
 * réussie. Best-effort (un log raté n'invalide jamais l'action).
 *
 * Page admin de consultation : `/[adminPrefix]/activity-logs` (filtrable par
 * `target_type=content-gen`).
 *
 * ⚠️ CE FICHIER EST UNE ENVELOPPE, ET SEULEMENT ÇA (2026-09-16).
 *
 * Il est `"use server"` et lit `next/headers` : ses exports sont des Server
 * Actions, et `headers()` LÈVE hors d'une requête. Un worker BullMQ qui
 * l'appelait n'écrivait donc rien — l'appel à `headers()` et le `create`
 * partageaient le même `try`, et le `catch` best-effort cachait tout. Le
 * chemin d'écriture vit désormais dans `activity-log-writer.ts`, qui n'a ni
 * directive ni requête ; hors requête, on appelle CELUI-LÀ.
 *
 * 🔑 `headers()` a sa propre paire `try`/`catch`, et ce détail est le
 * correctif : une requête absente coûte l'IP et le navigateur, plus jamais la
 * ligne d'audit.
 */

"use server";

import { headers } from "next/headers";
import type { AdminSession } from "@/server/actions/content-gen/_auth";
import { ecrireJournalActivite } from "@/server/content-gen/shared/activity-log-writer";

export interface ActivityLogInput {
  /** Identifiant canonique de l'action ex. "content-gen.review.approve". */
  readonly action: string;
  /** Type de cible ex. "ReviewQueue", "Article", "CoverageCampaign". */
  readonly targetType?: string;
  /** ID de la cible (uuid). */
  readonly targetId?: string | null;
  /** Diff/payload sérialisable (anonymisé si PII). */
  readonly changes?: unknown;
  /** Session admin obtenue via `requireAdmin()`. */
  readonly session: AdminSession;
}

/**
 * Persiste une entrée ActivityLog au nom de l'administrateur connecté.
 *
 * Récupère IP + User-Agent depuis `headers()` Next 16, puis délègue l'écriture
 * à `ecrireJournalActivite`. Champs, troncatures et forme de `changes` sont
 * ceux d'avant le 2026-09-16, à l'identique.
 */
export async function logActivity(input: ActivityLogInput): Promise<void> {
  let ipAddress: string | null = null;
  let userAgent: string | null = null;
  try {
    const h = await headers();
    ipAddress =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      h.get("cf-connecting-ip") ||
      null;
    userAgent = h.get("user-agent") || null;
  } catch {
    // Hors requête (script, test, réentrée worker) : on perd l'IP et le
    // navigateur. On n'a JAMAIS de raison d'y perdre la ligne d'audit.
  }

  await ecrireJournalActivite(
    { adminUserId: input.session.userId, ipAddress, userAgent },
    {
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      changes: input.changes,
    },
  );
}
