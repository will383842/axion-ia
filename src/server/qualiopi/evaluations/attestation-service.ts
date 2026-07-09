/**
 * Qualiopi — Service de génération des attestations (AGENT A — T9).
 *
 * genererAttestationPourEnrollment : génère (ou renvoie existante) l'attestation
 *   d'un stagiaire à partir de son taux de présence.
 *
 * Décision Will #7 :
 *   - >= seuil_presence_pct (défaut 80 %) → attestation complète
 *   - 60–79 %                             → attestation partielle
 *   - < 60 %                              → aucun document
 *
 * Idempotence : si attestationGenereeAt est déjà set et opts.force !== true,
 * retourne l'existant sans regénérer.
 *
 * Stub-aware : early-exit si DATABASE_URL contient "stub.invalid".
 *
 * Note : logQualiopiActivity dépend de next/headers (Server Action). On utilise
 * ici une écriture directe dans ActivityLog (best-effort, même pattern que
 * documents-service.ts) pour rester appelable depuis le worker cron.
 */

import React from "react";
import { prisma } from "@/lib/prisma";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { classifierPresence } from "@/server/qualiopi/presence/taux";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { makeQrToken, qrDataUrl } from "@/server/qualiopi/documents/qr";
import { readFormationForDocs } from "@/server/qualiopi/formations/formation-snapshot";
import { resolvePrincipalTrainerId } from "@/server/qualiopi/trainers/session-formateurs";
import { getFinaleReussite } from "./evaluations-service";
import { AttestationPdf } from "@/server/qualiopi/documents/templates/attestation";
import { AttestationPartiellePdf } from "@/server/qualiopi/documents/templates/attestation-partielle";
import { envoyerAttestationDisponible } from "@/server/qualiopi/notifications/notifications-service";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AttestationResult {
  resultat: "complete" | "partielle" | "aucune";
  documentId: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// genererAttestationPourEnrollment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère l'attestation de réalisation pour un stagiaire.
 *
 * Étapes :
 * 1. Lit enrollment + session + formation + trainee.
 * 2. Idempotence : si attestationGenereeAt set et pas force → retourne existant.
 * 3. Classifie la présence via classifierPresence (taux.ts).
 * 4. Si "aucune" → update Enrollment, log, retourne null.
 * 5. Construit AttestationData / AttestationPartielleData.
 * 6. generateDocument → DocumentGenere.
 * 7. update Enrollment (attestationResultat, documentId, genereeAt).
 * 8. log activity.
 */
export async function genererAttestationPourEnrollment(
  enrollmentId: string,
  opts?: { force?: boolean },
): Promise<AttestationResult> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { resultat: "aucune", documentId: null };
  }

  // 1. Lecture enrollment + relations
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      statut: true,
      tauxPresencePct: true,
      attestationResultat: true,
      attestationDocumentId: true,
      attestationGenereeAt: true,
      trainee: {
        select: {
          id: true,
          nom: true,
          prenom: true,
          entreprise: true,
          fonction: true,
        },
      },
      session: {
        select: {
          id: true,
          dateDebut: true,
          dateFin: true,
          modalite: true,
          coFormateurs: true,
          formateurPrincipalId: true,
          // Snapshot légal (WS5) prioritaire ; formation LIVE = repli legacy.
          formationSnapshot: true,
          formation: {
            select: {
              titre: true,
              objectifsPedagogiques: true,
              dureeHeures: true,
            },
          },
        },
      },
    },
  });

  if (!enrollment) {
    throw new Error(`Enrollment introuvable : ${enrollmentId}`);
  }

  // 2. Idempotence
  if (enrollment.attestationGenereeAt && !opts?.force) {
    return {
      resultat: (enrollment.attestationResultat ?? "aucune") as "complete" | "partielle" | "aucune",
      documentId: enrollment.attestationDocumentId ?? null,
    };
  }

  // 2b. Invariant métier S2 : un stagiaire exclu ou en abandon ne peut pas
  //     recevoir d'attestation, même via l'action manuelle admin.
  //     (Le cron filtre déjà ces statuts, mais l'action manuelle ne le faisait pas.)
  if (enrollment.statut === "exclu" || enrollment.statut === "abandon") {
    try {
      await prisma.activityLog.create({
        data: {
          adminUserId: null,
          action: "qualiopi.attestation.refusee_statut",
          targetType: "Enrollment",
          targetId: enrollmentId,
          changes: { statut: enrollment.statut } as never,
          ipAddress: null,
          userAgent: null,
        },
      });
    } catch {
      // best-effort
    }
    return { resultat: "aucune", documentId: null };
  }

  // 3. Classifie la présence
  const seuilPresencePct = await getQualiopiConfig("seuil_presence_pct");
  const tauxPct = enrollment.tauxPresencePct ?? 0;
  const resultat = classifierPresence(tauxPct, seuilPresencePct);

  // 4. Si aucune → pas de doc
  if (resultat === "aucune") {
    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: {
        attestationResultat: "aucune",
        attestationGenereeAt: new Date(),
      },
    });

    // Log activité best-effort (direct Prisma — pas de next/headers ici)
    try {
      await prisma.activityLog.create({
        data: {
          adminUserId: null,
          action: "qualiopi.attestation.aucune",
          targetType: "Enrollment",
          targetId: enrollmentId,
          changes: { resultat: "aucune", tauxPct } as never,
          ipAddress: null,
          userAgent: null,
        },
      });
    } catch {
      // best-effort
    }

    return { resultat: "aucune", documentId: null };
  }

  // 5. Construction du PDF — données formation depuis le snapshot légal (WS5),
  //    repli sur la lecture LIVE pour les sessions antérieures à WS5.
  const session = enrollment.session;
  const formation = readFormationForDocs(session.formationSnapshot, session.formation);
  const trainee = enrollment.trainee;

  const identite = await getOrganismeIdentite();
  const token = makeQrToken();
  const verifyUrl = `${identite.site}/fr/verifier-attestation/${token}`;
  const qrUrl = await qrDataUrl(verifyUrl);

  const dureeHeures = formation.dureeHeures ?? 0;
  const heuresSuivies = Math.round((tauxPct * dureeHeures) / 100);

  // Formateur principal : FK formateurPrincipalId prioritaire (fiable), repli sur
  // le Json coFormateurs (legacy), puis raison sociale. Corrige le nom du
  // formateur sur l'attestation (auparavant toujours la raison sociale car
  // coFormateurs est vide en pratique — jamais écrit par l'app).
  let formateurNom = identite.raisonSociale;
  const principalTrainerId = resolvePrincipalTrainerId({
    formateurPrincipalId: session.formateurPrincipalId,
    coFormateurs: session.coFormateurs,
  });
  if (principalTrainerId) {
    try {
      const trainer = await prisma.trainer.findUnique({
        where: { id: principalTrainerId },
        select: { nom: true, prenom: true },
      });
      if (trainer) {
        formateurNom = `${trainer.prenom} ${trainer.nom}`.trim();
      }
    } catch {
      // fallback identité raisonSociale
    }
  } else {
    // Repli legacy : nom inline éventuellement présent dans coFormateurs[0].
    const arr = Array.isArray(session.coFormateurs) ? session.coFormateurs : [];
    const premier = arr[0] as { nom?: string; prenom?: string } | undefined;
    if (premier?.nom) {
      formateurNom = [premier.prenom, premier.nom].filter(Boolean).join(" ");
    }
  }

  // Objectifs pédagogiques → string lisible
  let objectifsStr = "";
  try {
    const raw = formation.objectifsPedagogiques;
    if (Array.isArray(raw)) {
      objectifsStr = (raw as string[]).join(", ");
    } else if (typeof raw === "string") {
      objectifsStr = raw;
    } else {
      objectifsStr = String(raw ?? "");
    }
  } catch {
    objectifsStr = "";
  }

  // Évaluation finale (null si pas d'évaluation)
  const finaleReussite = await getFinaleReussite(enrollmentId);
  const evaluationObtenue =
    finaleReussite === null
      ? undefined
      : finaleReussite
        ? "Évaluation finale : Réussite"
        : "Évaluation finale : Non validée";

  const formatDate = (d: Date) =>
    d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

  const beneficiaire = {
    nom: trainee.nom,
    prenom: trainee.prenom,
    ...(trainee.entreprise !== null ? { entreprise: trainee.entreprise } : {}),
    ...(trainee.fonction !== null ? { fonction: trainee.fonction } : {}),
  };

  const formationData = {
    intitule: formation.titre ?? "",
    objectifs: objectifsStr,
    dureeHeures,
    dateDebut: session.dateDebut ? formatDate(new Date(session.dateDebut)) : "",
    dateFin: session.dateFin ? formatDate(new Date(session.dateFin)) : "",
    modalite: session.modalite,
    formateur: formateurNom,
  };

  const dateEmission = formatDate(new Date());

  // 6. Génère le document (numérotation + R2 + DB).
  //    buildElement reçoit le numéro alloué → l'en-tête PDF affiche le vrai N°.
  const docType = resultat === "complete" ? "attestation" : "attestation_partielle";
  const generated = await generateDocument({
    type: docType,
    buildElement: (numero) => {
      if (resultat === "complete") {
        return React.createElement(AttestationPdf, {
          data: {
            numero,
            dateEmission,
            identite,
            beneficiaire,
            formation: formationData,
            resultats: {
              heuresSuivies,
              heuresTotales: dureeHeures,
              ...(evaluationObtenue !== undefined ? { evaluationObtenue } : {}),
              competencesAcquises: objectifsStr,
            },
            qrToken: token,
            qrDataUrl: qrUrl,
          },
        });
      } else {
        return React.createElement(AttestationPartiellePdf, {
          data: {
            numero,
            dateEmission,
            identite,
            beneficiaire,
            formation: formationData,
            resultats: {
              heuresSuivies,
              heuresTotales: dureeHeures,
              ...(evaluationObtenue !== undefined ? { evaluationObtenue } : {}),
              competencesPartiellesValidees: objectifsStr,
            },
            qrToken: token,
            qrDataUrl: qrUrl,
          },
        });
      }
    },
    refs: { sessionId: session.id, traineeId: trainee.id },
    qrToken: token,
  });

  // 7. Update Enrollment
  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: {
      attestationResultat: resultat,
      attestationDocumentId: generated.id,
      attestationGenereeAt: new Date(),
    },
  });

  // 7b. Notification stagiaire — fail-soft (ne bloque pas la génération)
  try {
    await envoyerAttestationDisponible(enrollmentId);
  } catch (err) {
    console.error(
      `[attestation-service] envoyerAttestationDisponible: erreur enrollment ${enrollmentId}:`,
      err instanceof Error ? err.message : String(err),
    );
  }

  // 8. Log activité best-effort (direct Prisma — pas de next/headers ici)
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: null,
        action: `qualiopi.attestation.${resultat}`,
        targetType: "Enrollment",
        targetId: enrollmentId,
        changes: { resultat, documentId: generated.id, tauxPct } as never,
        ipAddress: null,
        userAgent: null,
      },
    });
  } catch {
    // best-effort
  }

  return { resultat, documentId: generated.id };
}
