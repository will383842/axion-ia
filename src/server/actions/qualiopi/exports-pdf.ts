/**
 * Qualiopi — Server Actions exports PDF à la volée (LOT 2).
 *
 * genererRegistrePdfAction    : export d'état d'un registre (A3/A7/A8/A17/A18).
 * genererCvFormateurAction    : fiche formateur CV + compétences (A15).
 * genererFicheAdaptationAction: fiche d'adaptation individuelle (A16/A9).
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
import {
  CvFormateurPdf,
  type DomaineCompetenceData,
} from "@/server/qualiopi/documents/templates/cv-formateur";
import { FicheAdaptationPdf } from "@/server/qualiopi/documents/templates/fiche-adaptation";

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

function formatDateFr(d: Date | null | undefined): string {
  return d ? d.toLocaleDateString("fr-FR") : "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

const registreSchema = z.object({ type: z.enum(REGISTRE_TYPES) });
const trainerIdSchema = z.object({ trainerId: z.string().uuid() });
const enrollmentIdSchema = z.object({ enrollmentId: z.string().uuid() });

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

/** Parse le Json Trainer.domainesCompetences en lignes affichables. */
function parseDomainesCompetences(raw: unknown): DomaineCompetenceData[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Record<string, unknown> => x !== null && typeof x === "object")
    .map((o) => ({
      domaine: typeof o["domaine"] === "string" ? o["domaine"] : "",
      niveauMaitrise: typeof o["niveauMaitrise"] === "string" ? o["niveauMaitrise"] : "",
      verifiedAt:
        typeof o["verifiedAt"] === "string" && o["verifiedAt"]
          ? formatDateFr(new Date(o["verifiedAt"]))
          : "",
    }))
    .filter((d) => d.domaine.trim().length > 0);
}

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
        data: {
          dateEdition: formatDateFr(now),
          nom: trainer.nom,
          prenom: trainer.prenom,
          email: trainer.email,
          telephone: trainer.telephone ?? "",
          statut: trainer.statut,
          dateEmbauche: formatDateFr(trainer.dateEmbauche),
          domainesCompetences: parseDomainesCompetences(trainer.domainesCompetences),
          formationsHabilitees: titresHabilitations,
          cvJoint: trainer.cvUrl != null,
          afestHabiliteAt: formatDateFr(trainer.afestHabiliteAt),
          sousTraitantNda: trainer.sousTraitantNda ?? "",
          sousTraitantVerifieAt: formatDateFr(trainer.sousTraitantVerifieAt),
        },
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
