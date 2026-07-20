/**
 * Qualiopi — Server Actions exports PDF à la volée (LOT 2 + LOT 4).
 *
 * genererRegistrePdfAction    : export d'état d'un registre (A3/A7/A8/A17/A18 + incidents).
 * genererCvFormateurAction    : fiche formateur CV + compétences (A15).
 * genererFicheAdaptationAction: fiche d'adaptation individuelle (A16/A9).
 * genererPilotagePdfAction    : export PDF des 14 métriques de pilotage (LOT 4).
 * exportPilotageCsvAction     : export CSV des 14 métriques de pilotage (LOT 4).
 *
 * Ces exports sont des ÉTATS (pas des documents officiels immuables) : pas de
 * DocumentGenere, pas de numérotation, pas de rétention. Le PDF est retourné
 * en base64 (pattern export dossier d'audit) et téléchargé côté navigateur.
 *
 * Stub-aware : erreur explicite en mode build (stub.invalid).
 */

"use server";

import React from "react";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { renderPdfToBuffer } from "@/server/qualiopi/documents/render";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { renderRegistrePdfBuffer, REGISTRE_TYPES } from "@/server/qualiopi/registres/registres-pdf";
import { CvFormateurPdf } from "@/server/qualiopi/documents/templates/cv-formateur";
import { buildCvFormateurData, formatDateFr } from "@/server/qualiopi/documents/cv-formateur-data";
import { FicheAdaptationPdf } from "@/server/qualiopi/documents/templates/fiche-adaptation";
import { RegistrePdf, type RegistreData } from "@/server/qualiopi/documents/templates/registre";
import {
  getPilotage,
  pilotageToLignes,
  pilotageToCsv,
  periodeKey,
  periodeLabel,
  type PilotageOptions,
  type PilotagePeriode,
} from "@/server/qualiopi/conformite/pilotage-service";

type ActionResult<T> = { data: T } | { error: string };

export interface PdfExportPayload {
  /** PDF encodé en base64 (téléchargement navigateur via Blob). */
  base64: string;
  /** Nom de fichier suggéré (avec extension .pdf). */
  filename: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const STUB = "stub.invalid";

function isStub(): boolean {
  return process.env.DATABASE_URL?.includes(STUB) ?? false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

const registreSchema = z.object({ type: z.enum(REGISTRE_TYPES) });
const trainerIdSchema = z.object({ trainerId: z.string().uuid() });
const enrollmentIdSchema = z.object({ enrollmentId: z.string().uuid() });

const TYPE_ACTION_QUALIOPI = [
  "classique",
  "certifiante",
  "foad",
  "alternance_afest",
  "sous_traitance",
  "cpf",
  "opco",
  "france_travail",
  "handicap",
] as const;

const pilotageExportSchema = z.object({
  annee: z.number().int().min(2020).max(2100),
  trimestre: z.number().int().min(1).max(4).optional(),
  mois: z.number().int().min(1).max(12).optional(),
  typeAction: z.enum(TYPE_ACTION_QUALIOPI).optional(),
});

export interface PilotageExportInput {
  annee: number;
  trimestre?: number | undefined;
  mois?: number | undefined;
  typeAction?: (typeof TYPE_ACTION_QUALIOPI)[number] | undefined;
}

/** Reconstruit les options du service pilotage depuis l'entrée plate validée. */
function buildPilotageOptions(v: z.infer<typeof pilotageExportSchema>): PilotageOptions {
  const periode: PilotagePeriode | undefined =
    v.trimestre !== undefined
      ? { type: "trimestre", trimestre: v.trimestre }
      : v.mois !== undefined
        ? { type: "mois", mois: v.mois }
        : undefined;
  return {
    annee: v.annee,
    ...(periode !== undefined ? { periode } : {}),
    ...(v.typeAction !== undefined ? { typeAction: v.typeAction } : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Export PDF d'un registre (réclamations / veille / revue / partenariats / sous-traitants)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère l'export PDF d'état d'un registre Qualiopi et le retourne en base64.
 */
export async function genererRegistrePdfAction(input: {
  type: (typeof REGISTRE_TYPES)[number];
}): Promise<ActionResult<PdfExportPayload>> {
  const session = await requireAdminWrite();
  if (isStub()) return { error: "Export désactivé en mode build (stub)" };

  const parsed = registreSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { type } = parsed.data;

  let result: { buffer: Buffer; filename: string };
  try {
    result = await renderRegistrePdfBuffer(type);
  } catch {
    return { error: "Erreur lors de la génération du PDF du registre" };
  }

  await logQualiopiActivity({
    action: `qualiopi.registre.${type}.export_pdf`,
    targetType: "Registre",
    targetId: null,
    changes: { type, filename: result.filename },
    session,
  });

  return { data: { base64: result.buffer.toString("base64"), filename: result.filename } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Fiche formateur — CV + plan de compétences (A15)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère la fiche formateur (CV + compétences + habilitations) en PDF base64.
 */
export async function genererCvFormateurAction(input: {
  trainerId: string;
}): Promise<ActionResult<PdfExportPayload>> {
  const session = await requireAdminWrite();
  if (isStub()) return { error: "Export désactivé en mode build (stub)" };

  const parsed = trainerIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { trainerId } = parsed.data;

  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      id: true,
      nom: true,
      prenom: true,
      email: true,
      telephone: true,
      statut: true,
      cvUrl: true,
      domainesCompetences: true,
      formationsHabilitees: true,
      dateEmbauche: true,
      afestHabiliteAt: true,
      sousTraitantNda: true,
      sousTraitantVerifieAt: true,
    },
  });
  if (!trainer) return { error: "Formateur introuvable" };

  // Résolution des titres des formations habilitées (ids → titres).
  let titresHabilitations: string[] = [];
  if (trainer.formationsHabilitees.length > 0) {
    const formations = await prisma.formation.findMany({
      where: { id: { in: trainer.formationsHabilitees } },
      select: { titre: true },
      orderBy: { titre: "asc" },
    });
    titresHabilitations = formations.map((f) => f.titre);
  }

  const identite = await getOrganismeIdentite();
  const now = new Date();

  let buffer: Buffer;
  try {
    const rendered = await renderPdfToBuffer(
      React.createElement(CvFormateurPdf, {
        data: buildCvFormateurData(trainer, titresHabilitations, now),
        identite,
      }),
    );
    buffer = rendered.buffer;
  } catch {
    return { error: "Erreur lors de la génération de la fiche formateur" };
  }

  const horodatage = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const filename = `fiche-formateur-${trainer.prenom}-${trainer.nom}-${horodatage}.pdf`
    .toLowerCase()
    .replace(/\s+/g, "-");

  await logQualiopiActivity({
    action: "qualiopi.formateur.cv.export_pdf",
    targetType: "Trainer",
    targetId: trainerId,
    changes: { filename },
    session,
  });

  return { data: { base64: buffer.toString("base64"), filename } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Fiche d'adaptation individuelle (A16/A9)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère la fiche d'adaptation individuelle d'une inscription en PDF base64.
 */
export async function genererFicheAdaptationAction(input: {
  enrollmentId: string;
}): Promise<ActionResult<PdfExportPayload>> {
  const session = await requireAdminWrite();
  if (isStub()) return { error: "Export désactivé en mode build (stub)" };

  const parsed = enrollmentIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { enrollmentId } = parsed.data;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      adaptationsRealisees: true,
      trainee: { select: { nom: true, prenom: true } },
      session: { select: { titreSession: true, dateDebut: true, dateFin: true } },
    },
  });
  if (!enrollment) return { error: "Inscription introuvable" };

  const [identite, referentNom, referentEmail, referentTelephone, referentDelaiH] =
    await Promise.all([
      getOrganismeIdentite(),
      getQualiopiConfig("referent_handicap_nom").catch(() => ""),
      getQualiopiConfig("referent_handicap_email").catch(() => ""),
      getQualiopiConfig("referent_handicap_telephone").catch(() => ""),
      getQualiopiConfig("referent_handicap_delai_reponse_h").catch(() => 48),
    ]);

  const now = new Date();
  const datesSession = [
    formatDateFr(enrollment.session.dateDebut),
    formatDateFr(enrollment.session.dateFin),
  ]
    .filter(Boolean)
    .join(" – ");

  let buffer: Buffer;
  try {
    const rendered = await renderPdfToBuffer(
      React.createElement(FicheAdaptationPdf, {
        data: {
          dateEdition: formatDateFr(now),
          nomStagiaire: enrollment.trainee.nom,
          prenomStagiaire: enrollment.trainee.prenom,
          intituleSession: enrollment.session.titreSession,
          datesSession,
          adaptationsRealisees: enrollment.adaptationsRealisees ?? "",
          referentHandicapNom: referentNom,
          referentHandicapEmail: referentEmail,
          referentHandicapTelephone: referentTelephone,
          referentHandicapDelaiReponseH: referentDelaiH,
        },
        identite,
      }),
    );
    buffer = rendered.buffer;
  } catch {
    return { error: "Erreur lors de la génération de la fiche d'adaptation" };
  }

  const horodatage = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const filename =
    `fiche-adaptation-${enrollment.trainee.prenom}-${enrollment.trainee.nom}-${horodatage}.pdf`
      .toLowerCase()
      .replace(/\s+/g, "-");

  await logQualiopiActivity({
    action: "qualiopi.enrollment.fiche_adaptation.export_pdf",
    targetType: "Enrollment",
    targetId: enrollmentId,
    changes: { filename },
    session,
  });

  return { data: { base64: buffer.toString("base64"), filename } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Exports du pilotage (LOT 4) — PDF (template registre) + CSV
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_ACTION_LABELS: Record<string, string> = {
  classique: "Actions classiques",
  certifiante: "Actions certifiantes",
  foad: "FOAD",
  alternance_afest: "Alternance / AFEST",
  sous_traitance: "Sous-traitance",
  cpf: "CPF",
  opco: "OPCO",
  france_travail: "France Travail",
  handicap: "Handicap",
};

function pilotageFilenameBase(v: PilotageExportInput): string {
  const suffixPeriode =
    v.trimestre !== undefined
      ? periodeKey({ type: "trimestre", trimestre: v.trimestre })
      : v.mois !== undefined
        ? periodeKey({ type: "mois", mois: v.mois })
        : "annee";
  const suffixType = v.typeAction !== undefined ? `-${v.typeAction}` : "";
  return `pilotage-qualiopi-${v.annee}-${suffixPeriode}${suffixType}`;
}

/**
 * Génère l'export PDF des 14 métriques de pilotage (réutilise le template
 * registre générique — colonnes Métrique / Valeur / Détail) et le retourne
 * en base64.
 */
export async function genererPilotagePdfAction(
  input: PilotageExportInput,
): Promise<ActionResult<PdfExportPayload>> {
  const session = await requireAdminWrite();
  if (isStub()) return { error: "Export désactivé en mode build (stub)" };

  const parsed = pilotageExportSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  let buffer: Buffer;
  const now = new Date();
  try {
    const pilotage = await getPilotage(buildPilotageOptions(v));
    const identite = await getOrganismeIdentite();
    const sousTitreType =
      v.typeAction !== undefined
        ? ` · Type d'action : ${TYPE_ACTION_LABELS[v.typeAction] ?? v.typeAction}`
        : "";
    const data: RegistreData = {
      titre: "Pilotage Qualiopi — 14 métriques",
      sousTitre: `Tableau de bord de pilotage (RNQ V9) — ${periodeLabel(pilotage.annee, pilotage.periode)}${sousTitreType}.`,
      colonnes: ["Métrique", "Valeur", "Détail"],
      lignes: pilotageToLignes(pilotage),
      mentionBasDePage:
        "Export d'état généré depuis la console Axion-IA — reflète les métriques calculées à la date d'édition ; ne remplace pas les registres sources.",
      dateEdition: now.toLocaleDateString("fr-FR"),
    };
    const rendered = await renderPdfToBuffer(React.createElement(RegistrePdf, { data, identite }));
    buffer = rendered.buffer;
  } catch {
    return { error: "Erreur lors de la génération du PDF de pilotage" };
  }

  const horodatage = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const filename = `${pilotageFilenameBase(v)}-${horodatage}.pdf`;

  await logQualiopiActivity({
    action: "qualiopi.pilotage.export_pdf",
    targetType: "Pilotage",
    targetId: String(v.annee),
    changes: { ...v, filename },
    session,
  });

  return { data: { base64: buffer.toString("base64"), filename } };
}

/**
 * Exporte les 14 métriques de pilotage en CSV (séparateur « ; »).
 */
export async function exportPilotageCsvAction(
  input: PilotageExportInput,
): Promise<ActionResult<{ csv: string; filename: string }>> {
  const session = await requireAdminWrite();
  if (isStub()) return { error: "Export désactivé en mode build (stub)" };

  const parsed = pilotageExportSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  let csv: string;
  try {
    const pilotage = await getPilotage(buildPilotageOptions(v));
    csv = pilotageToCsv(pilotage);
  } catch {
    return { error: "Erreur lors de l'export CSV du pilotage" };
  }

  const filename = `${pilotageFilenameBase(v)}.csv`;

  await logQualiopiActivity({
    action: "qualiopi.pilotage.export_csv",
    targetType: "Pilotage",
    targetId: String(v.annee),
    changes: { ...v, filename },
    session,
  });

  return { data: { csv, filename } };
}
