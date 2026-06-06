/**
 * Qualiopi — Server Actions Conformité (T12).
 *
 * exporterManifesteAuditAction() : génère et retourne le manifeste d'audit
 *   Qualiopi (JSON + Markdown) avec nom de fichier horodaté.
 *
 * Mode auditeur : accessible aux admins write (pas de rôle spécifique auditeur
 * au niveau NextAuth — le token auditeur est géré en couche applicative, T11).
 */

"use server";

import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { genererManifesteAudit } from "@/server/qualiopi/conformite/audit-dossier";

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ManifesteExportResult {
  /** Payload JSON structuré du manifeste. */
  readonly json: object;
  /** Rendu Markdown lisible par l'auditeur. */
  readonly markdown: string;
  /** Nom de fichier suggéré pour le téléchargement (sans extension). */
  readonly filename: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// exporterManifesteAuditAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère le manifeste d'audit Qualiopi et le retourne (JSON + Markdown + filename).
 *
 * Le manifeste couvre les 32 indicateurs RNQ V9 :
 *   - statut de couverture (couvert / a_completer / non_applicable)
 *   - preuves textuelles déduites de la présence de données
 *   - documents Prisma associés (type + count)
 * Score = nbCouverts / nbApplicables (JAMAIS /22).
 */
export async function exporterManifesteAuditAction(): Promise<ActionResult<ManifesteExportResult>> {
  const session = await requireAdminWrite();

  const manifeste = await genererManifesteAudit();

  const now = new Date();
  const horodatage = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const filename = `manifeste-audit-qualiopi-${horodatage}`;

  await logQualiopiActivity({
    action: "qualiopi.manifeste_audit.export",
    targetType: "ManifesteAudit",
    targetId: null,
    changes: {
      scorePct: (manifeste.json as { meta?: { scorePct?: number } }).meta?.scorePct,
      genereAt: horodatage,
    },
    session,
  });

  return {
    data: {
      json: manifeste.json,
      markdown: manifeste.markdown,
      filename,
    },
  };
}
