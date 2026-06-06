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
import {
  genererManifesteAudit,
  genererDossierAuditZip,
} from "@/server/qualiopi/conformite/audit-dossier";

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

// ─────────────────────────────────────────────────────────────────────────────
// exporterDossierZipAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère le dossier d'audit complet (manifeste JSON + Markdown + PDFs R2)
 * et le retourne encodé en base64 pour téléchargement côté navigateur.
 *
 * Le dossier ZIP contient :
 *   - `manifeste.json` / `manifeste.md`
 *   - `preuves/<type>/<numero>.pdf` pour chaque document disponible dans R2
 *   - `index.txt` récapitulant les inclusions / omissions
 *
 * Fail-soft : les PDFs R2 manquants sont omis sans faire échouer l'action.
 */
export async function exporterDossierZipAction(): Promise<
  ActionResult<{ base64: string; filename: string }>
> {
  const session = await requireAdminWrite();

  const dossier = await genererDossierAuditZip();

  await logQualiopiActivity({
    action: "qualiopi.dossier_audit.export_zip",
    targetType: "DossierAuditZip",
    targetId: null,
    changes: { filename: dossier.filename },
    session,
  });

  return {
    data: {
      base64: dossier.base64,
      filename: dossier.filename,
    },
  };
}
