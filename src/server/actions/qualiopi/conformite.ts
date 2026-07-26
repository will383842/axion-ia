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

import {
  requireAdminWrite,
  requireAdminPublish,
  logQualiopiActivity,
} from "@/server/actions/qualiopi/_guards";
import { z } from "zod";
import {
  genererManifesteAudit,
  genererDossierAuditZip,
} from "@/server/qualiopi/conformite/audit-dossier";
import { genererDossierSessionZip } from "@/server/qualiopi/conformite/dossier-session";

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
 *
 * L'appelant reçoit un statut d'incomplétude explicite ({ incomplet,
 * nbPreuvesAttendues, nbPreuvesJointes, avertissements }) afin d'AVERTIR
 * clairement l'utilisateur lorsque des preuves manquent — un dossier remis à
 * l'auditeur peut sinon ne contenir aucune preuve stagiaire à son insu.
 */
export async function exporterDossierZipAction(): Promise<
  ActionResult<{
    base64: string;
    filename: string;
    incomplet: boolean;
    nbPreuvesAttendues: number;
    nbPreuvesJointes: number;
    avertissements: string[];
  }>
> {
  // 🔴 Audit certification 2026-07-26 (F45). C'était `requireAdminWrite`, donc
  // accessible au rôle `editor`. Exporter un dossier de stagiaires est un
  // traitement de données personnelles à haut risque : il sort du système
  // l'identité, les évaluations et les signatures de personnes physiques.
  // `requireAdminPublish` le réserve à `admin` et `super_admin`.
  const session = await requireAdminPublish();

  const dossier = await genererDossierAuditZip();

  await logQualiopiActivity({
    action: "qualiopi.dossier_audit.export_zip",
    targetType: "DossierAuditZip",
    targetId: null,
    changes: {
      filename: dossier.filename,
      incomplet: dossier.incomplet,
      nbPreuvesAttendues: dossier.nbPreuvesAttendues,
      nbPreuvesJointes: dossier.nbPreuvesJointes,
    },
    session,
  });

  return {
    data: {
      base64: dossier.base64,
      filename: dossier.filename,
      incomplet: dossier.incomplet,
      nbPreuvesAttendues: dossier.nbPreuvesAttendues,
      nbPreuvesJointes: dossier.nbPreuvesJointes,
      avertissements: dossier.avertissements,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// exporterDossierSessionAction
// ─────────────────────────────────────────────────────────────────────────────

const dossierSessionSchema = z.object({ sessionId: z.string().uuid() });

/**
 * Dossier d'audit d'UNE session — l'oubli M2 du plan.
 *
 * ## Pourquoi cette action existe
 *
 * `genererDossierAuditZip` range les preuves par TYPE, jamais par session.
 * Devant un auditeur qui demande « montrez-moi le dossier de la session de
 * juin », reconstituer l'ensemble revenait à ouvrir les PDF un par un pour lire
 * de quelle session ils relèvent. Une preuve qu'on ne peut pas retrouver n'est
 * pas une preuve.
 *
 * ⚠️ Elle est aussi le SEUL chemin par lequel la vérification d'intégrité des
 * chaînes de signatures est atteignable depuis l'application. Sans elle,
 * `verifierChaine` — tout le chaînage cryptographique, ses vecteurs d'or et ses
 * matrices de falsification — n'était exécutable que par un test. Un contrôle
 * d'intégrité qu'aucun humain ne peut déclencher ne contrôle rien.
 */
export async function exporterDossierSessionAction(input: { sessionId: string }): Promise<
  ActionResult<{
    base64: string;
    filename: string;
    incomplet: boolean;
    nbDocuments: number;
    nbDocumentsJoints: number;
    nbChainesAnormales: number;
    nbChainesContresignAnormales: number;
    avertissements: string[];
  }>
> {
  // 🔴 Audit certification 2026-07-26 (F45). C'était `requireAdminWrite`, donc
  // accessible au rôle `editor`. Exporter un dossier de stagiaires est un
  // traitement de données personnelles à haut risque : il sort du système
  // l'identité, les évaluations et les signatures de personnes physiques.
  // `requireAdminPublish` le réserve à `admin` et `super_admin`.
  const session = await requireAdminPublish();

  const parsed = dossierSessionSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };

  const dossier = await genererDossierSessionZip(parsed.data.sessionId);
  if (dossier === null) return { error: "Session introuvable" };

  await logQualiopiActivity({
    action: "qualiopi.dossier_session.export_zip",
    targetType: "TrainingSession",
    targetId: parsed.data.sessionId,
    changes: {
      filename: dossier.filename,
      incomplet: dossier.incomplet,
      nbDocuments: dossier.nbDocuments,
      nbDocumentsJoints: dossier.nbDocumentsJoints,
      // Tracé volontairement : une anomalie d'intégrité constatée doit laisser
      // une trace datée, indépendamment de ce que l'admin fera du ZIP.
      nbChainesAnormales: dossier.nbChainesAnormales,
      nbChainesContresignAnormales: dossier.nbChainesContresignAnormales,
    },
    session,
  });

  return { data: dossier };
}
