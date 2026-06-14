/**
 * Qualiopi 1-to-1 / AFEST — génération du Protocole individuel AFEST (C1).
 *
 * Document de cadrage ex-ante (D.6313-3-1 §3) : parties, analyse de l'activité
 * (cartographie), objectifs, alternance mises en situation ↔ phases réflexives,
 * modalités d'évaluation, durée prévue. Généré via generateDocument (numéro AXI,
 * QR, R2, rétention 5 ans) et rattaché à la CoachingSession.
 *
 * Stub-aware. La mention « financement » n'apparaît que si le périmètre AFEST
 * est certifié (flag `afest_perimetre_certifie`).
 */

import React from "react";
import { prisma } from "@/lib/prisma";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { makeQrToken, qrDataUrl } from "@/server/qualiopi/documents/qr";
import { ProtocoleAfestPdf } from "@/server/qualiopi/documents/templates/protocole-afest";
import { coachingInterventionLabel } from "@/server/formateur/coaching-options";

export interface ProtocoleAfestGenerated {
  documentId: string;
  numero: string;
}

const formatDate = (d: Date) =>
  d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

const MODALITES_EVAL_DEFAULT =
  "Positionnement amont, évaluation des acquis en fin de parcours et questionnaire de satisfaction.";
const PHASES_REFLEXIVES_DEFAULT =
  "Après chaque mise en situation de travail, un temps d'analyse réflexive guidé par le formateur permet au bénéficiaire d'expliciter sa pratique, d'identifier les acquis et les axes de progression.";

/** Construit la synthèse de l'analyse d'activité depuis la cartographie. */
function buildAnalyseActivite(
  carto: {
    taches: unknown;
    chronophages: string | null;
    irritants: string | null;
  } | null,
): string {
  if (!carto) {
    return "Analyse de l'activité réalisée en séance (cartographie des tâches, tâches chronophages et irritants identifiés).";
  }
  const parts: string[] = [];
  if (Array.isArray(carto.taches) && carto.taches.length > 0) {
    parts.push(`${carto.taches.length} tâche(s) cartographiée(s)`);
  }
  if (carto.chronophages) parts.push(`Chronophages : ${carto.chronophages}`);
  if (carto.irritants) parts.push(`Irritants : ${carto.irritants}`);
  return parts.length > 0
    ? parts.join(". ") + "."
    : "Analyse de l'activité réalisée (cartographie du poste).";
}

/** Liste des mises en situation prévues, dérivée des tâches cartographiées. */
function buildMisesEnSituation(taches: unknown): string[] {
  if (Array.isArray(taches)) {
    const libelles = taches
      .map((t) =>
        typeof t === "object" && t != null && "tache" in t
          ? String((t as { tache?: unknown }).tache ?? "")
          : "",
      )
      .filter(Boolean);
    if (libelles.length > 0) {
      return libelles.map((l) => `Mise en situation sur l'activité : ${l}`);
    }
  }
  return [
    "Mises en situation de travail sur les activités réelles du poste, avec usage assisté de l'IA.",
  ];
}

/**
 * Génère le Protocole AFEST d'un parcours coaching et le rattache à la session.
 */
export async function genererProtocoleAfest(
  coachingSessionId: string,
  opts?: { force?: boolean },
): Promise<ProtocoleAfestGenerated | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return null;
  }

  const cs = await prisma.coachingSession.findUnique({
    where: { id: coachingSessionId },
    select: {
      id: true,
      interventionSlug: true,
      dateSeance: true,
      heuresPrevuesConvention: true,
      objectifsPedagogiques: true,
      beneficiaireNom: true,
      beneficiaireEntreprise: true,
      tuteurEntrepriseNom: true,
      protocoleDocumentId: true,
      protocoleGenereeAt: true,
      trainer: { select: { nom: true, prenom: true } },
      trainee: { select: { nom: true, prenom: true, entreprise: true, fonction: true } },
      cartographie: {
        select: { taches: true, chronophages: true, irritants: true },
      },
    },
  });

  if (!cs) throw new Error(`CoachingSession introuvable : ${coachingSessionId}`);

  // Idempotence : un protocole déjà émis n'est pas régénéré (évite les doublons
  // DocumentGenere). `force` permet une réémission explicite (admin).
  if (cs.protocoleGenereeAt && cs.protocoleDocumentId && !opts?.force) {
    const existing = await prisma.documentGenere.findUnique({
      where: { id: cs.protocoleDocumentId },
      select: { id: true, numero: true },
    });
    if (existing) return { documentId: existing.id, numero: existing.numero };
  }

  const identite = await getOrganismeIdentite();
  const perimetreCertifie = await getQualiopiConfig("afest_perimetre_certifie");
  const token = makeQrToken();
  const qrUrl = await qrDataUrl(`${identite.site}/fr/verifier-attestation/${token}`);

  const beneficiaire = cs.trainee
    ? {
        nom: cs.trainee.nom,
        prenom: cs.trainee.prenom,
        ...(cs.trainee.entreprise ? { entreprise: cs.trainee.entreprise } : {}),
        ...(cs.trainee.fonction ? { fonction: cs.trainee.fonction } : {}),
      }
    : {
        nom: cs.beneficiaireNom ?? "Bénéficiaire",
        prenom: "",
        ...(cs.beneficiaireEntreprise ? { entreprise: cs.beneficiaireEntreprise } : {}),
      };

  const objectifsRaw = cs.objectifsPedagogiques;
  const objectifs = Array.isArray(objectifsRaw)
    ? (objectifsRaw as Array<{ libelle?: string } | string>)
        .map((o) => (typeof o === "string" ? o : (o.libelle ?? "")))
        .filter(Boolean)
    : [];

  const dureePrevueHeures =
    cs.heuresPrevuesConvention != null ? Number(cs.heuresPrevuesConvention) : 0;
  const dateRef = formatDate(new Date(cs.dateSeance));

  const generated = await generateDocument({
    type: "protocole_afest",
    buildElement: (numero) =>
      React.createElement(ProtocoleAfestPdf, {
        data: {
          numero,
          dateEmission: formatDate(new Date()),
          identite,
          intitule: coachingInterventionLabel(cs.interventionSlug),
          beneficiaire,
          formateurAfest: {
            nom: `${cs.trainer.prenom} ${cs.trainer.nom}`.trim() || identite.raisonSociale,
            role: "Formateur / accompagnateur AFEST",
          },
          ...(cs.tuteurEntrepriseNom
            ? { tuteurEntreprise: { nom: cs.tuteurEntrepriseNom, role: "Tuteur entreprise" } }
            : {}),
          analyseActivite: buildAnalyseActivite(cs.cartographie),
          objectifs:
            objectifs.length > 0
              ? objectifs
              : ["Optimiser le poste de travail du bénéficiaire par l'usage de l'IA."],
          misesEnSituation: buildMisesEnSituation(cs.cartographie?.taches),
          phasesReflexives: PHASES_REFLEXIVES_DEFAULT,
          modalitesEvaluation: MODALITES_EVAL_DEFAULT,
          dureePrevueHeures,
          dateDebut: dateRef,
          dateFin: dateRef,
          perimetreCertifie,
          qrToken: token,
          qrDataUrl: qrUrl,
        },
      }),
    refs: { coachingSessionId },
    qrToken: token,
  });

  // Trace l'émission (idempotence + lien parcours → document).
  await prisma.coachingSession.update({
    where: { id: coachingSessionId },
    data: { protocoleDocumentId: generated.id, protocoleGenereeAt: new Date() },
  });

  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: null,
        action: "qualiopi.coaching.protocole_afest.generate",
        targetType: "CoachingSession",
        targetId: coachingSessionId,
        changes: { documentId: generated.id, numero: generated.numero } as never,
        ipAddress: null,
        userAgent: null,
      },
    });
  } catch {
    // best-effort
  }

  return { documentId: generated.id, numero: generated.numero };
}
