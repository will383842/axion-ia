/**
 * Qualiopi 1-to-1 / AFEST — attestation de réalisation en heures (C1).
 *
 * Miroir de `genererAttestationPourEnrollment` MAIS pour un parcours coaching :
 *   - heures réelles = Σ CompteRenduSeance.dureeMinutes / 60 (PAS dureeHeures × taux) ;
 *   - taux d'assiduité = heures réelles / heures prévues à la convention ;
 *   - classification 80/60/0 réutilisée (classifierPresence) + plancher absolu
 *     optionnel (`afest_seuil_heures_min`).
 *
 * Réutilise les templates AttestationPdf / AttestationPartiellePdf (même shape),
 * generateDocument, getOrganismeIdentite, QR. Stub-aware + idempotent.
 */

import React from "react";
import { prisma } from "@/lib/prisma";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { classifierPresence } from "@/server/qualiopi/presence/taux";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { makeQrToken, qrDataUrl } from "@/server/qualiopi/documents/qr";
import { AttestationPdf } from "@/server/qualiopi/documents/templates/attestation";
import { AttestationPartiellePdf } from "@/server/qualiopi/documents/templates/attestation-partielle";
import { coachingInterventionLabel } from "@/server/formateur/coaching-options";
import { getHeuresReelles1to1, computeTaux1to1 } from "./heures";

export interface AttestationResult {
  resultat: "complete" | "partielle" | "aucune";
  documentId: string | null;
}

const formatDate = (d: Date) =>
  d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

/** Bénéficiaire d'un parcours : Trainee lié, sinon champs libres ad-hoc. */
function resolveBeneficiaire(cs: {
  trainee: {
    nom: string;
    prenom: string;
    entreprise: string | null;
    fonction: string | null;
  } | null;
  beneficiaireNom: string | null;
  beneficiaireEntreprise: string | null;
}): { nom: string; prenom: string; entreprise?: string; fonction?: string } {
  if (cs.trainee) {
    return {
      nom: cs.trainee.nom,
      prenom: cs.trainee.prenom,
      ...(cs.trainee.entreprise ? { entreprise: cs.trainee.entreprise } : {}),
      ...(cs.trainee.fonction ? { fonction: cs.trainee.fonction } : {}),
    };
  }
  // Ad-hoc : "Prénom Nom" libre → on met tout dans nom, prénom vide.
  return {
    nom: cs.beneficiaireNom ?? "Bénéficiaire",
    prenom: "",
    ...(cs.beneficiaireEntreprise ? { entreprise: cs.beneficiaireEntreprise } : {}),
  };
}

/**
 * Génère (ou renvoie existante) l'attestation de réalisation d'un parcours 1-to-1.
 */
export async function genererAttestation1to1(
  coachingSessionId: string,
  opts?: { force?: boolean },
): Promise<AttestationResult> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { resultat: "aucune", documentId: null };
  }

  const cs = await prisma.coachingSession.findUnique({
    where: { id: coachingSessionId },
    select: {
      id: true,
      statut: true,
      interventionSlug: true,
      dateSeance: true,
      heuresPrevuesConvention: true,
      objectifsPedagogiques: true,
      attestationResultat: true,
      attestationDocumentId: true,
      attestationGenereeAt: true,
      beneficiaireNom: true,
      beneficiaireEntreprise: true,
      trainer: { select: { nom: true, prenom: true } },
      trainee: { select: { id: true, nom: true, prenom: true, entreprise: true, fonction: true } },
      comptesRendus: { select: { dureeMinutes: true, dateSeance: true } },
    },
  });

  if (!cs) {
    throw new Error(`CoachingSession introuvable : ${coachingSessionId}`);
  }

  // Idempotence
  if (cs.attestationGenereeAt && !opts?.force) {
    return {
      resultat: (cs.attestationResultat ?? "aucune") as "complete" | "partielle" | "aucune",
      documentId: cs.attestationDocumentId ?? null,
    };
  }

  // Une séance annulée ne donne pas d'attestation.
  if (cs.statut === "annulee") {
    return { resultat: "aucune", documentId: null };
  }

  // Heures réelles = Σ durées de séance ; taux vs heures prévues convention.
  const heuresReelles = await getHeuresReelles1to1(coachingSessionId);
  const heuresPrevues =
    cs.heuresPrevuesConvention != null ? Number(cs.heuresPrevuesConvention) : null;
  const taux = computeTaux1to1(heuresReelles, heuresPrevues);

  const seuilPresencePct = await getQualiopiConfig("seuil_presence_pct");
  const seuilHeuresMin = await getQualiopiConfig("afest_seuil_heures_min");
  let resultat = classifierPresence(taux, seuilPresencePct);
  // Plancher absolu d'heures (optionnel, gated). En dessous → aucune.
  if (seuilHeuresMin > 0 && heuresReelles < seuilHeuresMin) {
    resultat = "aucune";
  }

  if (resultat === "aucune") {
    await prisma.coachingSession.update({
      where: { id: coachingSessionId },
      data: { attestationResultat: "aucune", attestationGenereeAt: new Date() },
    });
    return { resultat: "aucune", documentId: null };
  }

  // Construction du PDF (réutilise le template attestation collective).
  const identite = await getOrganismeIdentite();
  const token = makeQrToken();
  const verifyUrl = `${identite.site}/fr/verifier-attestation/${token}`;
  const qrUrl = await qrDataUrl(verifyUrl);

  const beneficiaire = resolveBeneficiaire(cs);
  const formateurNom = `${cs.trainer.prenom} ${cs.trainer.nom}`.trim() || identite.raisonSociale;

  // Objectifs pédagogiques → string lisible.
  const objectifsRaw = cs.objectifsPedagogiques;
  let objectifsStr = "";
  if (Array.isArray(objectifsRaw)) {
    objectifsStr = (objectifsRaw as Array<{ libelle?: string } | string>)
      .map((o) => (typeof o === "string" ? o : (o.libelle ?? "")))
      .filter(Boolean)
      .join(", ");
  }

  // Évaluation finale 1-to-1 (si présente).
  const finale = await prisma.evaluationAcquis.findFirst({
    where: { coachingSessionId, type: "finale" },
    orderBy: { dateEvaluation: "desc" },
    select: { reussite: true },
  });
  const evaluationObtenue =
    finale == null
      ? undefined
      : finale.reussite
        ? "Évaluation finale : Réussite"
        : "Évaluation finale : Non validée";

  // Dates : 1re et dernière séance avec compte-rendu (sinon dateSeance du parcours).
  const dates = cs.comptesRendus
    .map((cr) => new Date(cr.dateSeance).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  const dateDebut =
    dates.length > 0 ? formatDate(new Date(dates[0]!)) : formatDate(new Date(cs.dateSeance));
  const dateFin =
    dates.length > 0
      ? formatDate(new Date(dates[dates.length - 1]!))
      : formatDate(new Date(cs.dateSeance));

  const heuresTotales = heuresPrevues ?? heuresReelles;
  const formationData = {
    intitule: coachingInterventionLabel(cs.interventionSlug),
    objectifs: objectifsStr,
    dureeHeures: heuresTotales,
    dateDebut,
    dateFin,
    modalite: "Action de formation en situation de travail (AFEST)",
    formateur: formateurNom,
  };

  const dateEmission = formatDate(new Date());
  const docType = resultat === "complete" ? "attestation" : "attestation_partielle";

  const generated = await generateDocument({
    type: docType,
    buildElement: (numero) =>
      resultat === "complete"
        ? React.createElement(AttestationPdf, {
            data: {
              numero,
              dateEmission,
              identite,
              beneficiaire,
              formation: formationData,
              resultats: {
                heuresSuivies: heuresReelles,
                heuresTotales,
                ...(evaluationObtenue !== undefined ? { evaluationObtenue } : {}),
                competencesAcquises: objectifsStr,
              },
              qrToken: token,
              qrDataUrl: qrUrl,
            },
          })
        : React.createElement(AttestationPartiellePdf, {
            data: {
              numero,
              dateEmission,
              identite,
              beneficiaire,
              formation: formationData,
              resultats: {
                heuresSuivies: heuresReelles,
                heuresTotales,
                ...(evaluationObtenue !== undefined ? { evaluationObtenue } : {}),
                competencesPartiellesValidees: objectifsStr,
              },
              qrToken: token,
              qrDataUrl: qrUrl,
            },
          }),
    refs: {
      coachingSessionId,
      ...(cs.trainee?.id ? { traineeId: cs.trainee.id } : {}),
    },
    qrToken: token,
  });

  await prisma.coachingSession.update({
    where: { id: coachingSessionId },
    data: {
      attestationResultat: resultat,
      attestationDocumentId: generated.id,
      attestationGenereeAt: new Date(),
      dureeReelleHeures: heuresReelles,
    },
  });

  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: null,
        action: `qualiopi.coaching.attestation.${resultat}`,
        targetType: "CoachingSession",
        targetId: coachingSessionId,
        changes: { resultat, documentId: generated.id, heuresReelles, taux } as never,
        ipAddress: null,
        userAgent: null,
      },
    });
  } catch {
    // best-effort
  }

  return { resultat, documentId: generated.id };
}
