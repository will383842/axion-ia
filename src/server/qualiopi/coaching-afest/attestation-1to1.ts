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
import { ensureCoachingSnapshot, COACHING_SNAPSHOT_SELECT } from "./coaching-snapshot";
import { getHeuresReelles1to1, computeTaux1to1 } from "./heures";
import {
  getFinaleResultats1to1,
  evaluationSansAucuneNote,
} from "@/server/qualiopi/evaluations/evaluations-service";

export interface AttestationResult {
  resultat: "complete" | "partielle" | "aucune";
  documentId: string | null;
  /**
   * Raison d'un refus d'émission, à afficher à l'admin (F65).
   *
   * Un « aucune » silencieux est indiscernable d'un bug : l'admin clique, rien
   * ne se passe, et il recommence. Le motif dit ce qui manque et comment le
   * corriger.
   */
  motif?: string;
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
      dateSeance: true,
      // Champs source du snapshot légal (WS9) + le snapshot lui-même.
      coachingSnapshot: true,
      ...COACHING_SNAPSHOT_SELECT,
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

  // Snapshot légal (WS9) : fige le contenu engageant à la 1re émission ; les
  // documents suivants du parcours lisent la même base (repli LIVE si legacy).
  const snap = await ensureCoachingSnapshot(cs);

  // Heures réelles = Σ durées de séance ; taux vs heures prévues convention (figées).
  const heuresReelles = await getHeuresReelles1to1(coachingSessionId);
  const heuresPrevues = snap.heuresPrevuesConvention;
  const taux = computeTaux1to1(heuresReelles, heuresPrevues);

  const seuilPresencePct = await getQualiopiConfig("seuil_presence_pct");
  const seuilHeuresMin = await getQualiopiConfig("afest_seuil_heures_min");

  // 🔴 F65 — un taux `null` signifie « aucune durée conventionnelle renseignée »,
  // donc assiduité INCALCULABLE. On refuse d'attester plutôt que de retenir un
  // taux par défaut : attester une assiduité qu'on ne sait pas mesurer est
  // exactement ce qu'un contrôle de service fait sanctionne.
  if (taux === null) {
    return {
      resultat: "aucune",
      documentId: null,
      motif:
        "Durée conventionnelle du parcours non renseignée : l'assiduité n'est pas calculable, l'attestation ne peut pas être émise. Renseignez les heures prévues à la convention.",
    };
  }

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

  // Objectifs pédagogiques (figés) → string lisible.
  const objectifsRaw = snap.objectifsPedagogiques;
  let objectifsStr = "";
  if (Array.isArray(objectifsRaw)) {
    objectifsStr = (objectifsRaw as Array<{ libelle?: string } | string>)
      .map((o) => (typeof o === "string" ? o : (o.libelle ?? "")))
      .filter(Boolean)
      .join(", ");
  }

  // 🔴 Audit certification 2026-07-26 (F21, SECOND passage). Ce fichier est le
  // miroir de `attestation-service.ts` et reproduisait le même défaut : la liste
  // COMPLÈTE des objectifs du parcours s'imprimait sous « Compétences acquises »,
  // sans que rien ne consulte l'évaluation. Mon premier correctif n'avait touché
  // que la voie collective — la famille AFEST passait encore.
  //
  // Le défaut était même plus visible ici : le code lisait bien l'évaluation,
  // mais SEULEMENT le booléen de réussite. Une attestation AFEST pouvait donc
  // afficher « Évaluation finale : Non validée » et, juste en dessous,
  // l'intégralité des objectifs comme acquis.
  //
  // C'est d'autant plus grave que l'AFEST est précisément le dispositif où
  // l'évaluation individuelle est le cœur du sujet au regard de L6353-1.
  const resultatsFinale = await getFinaleResultats1to1(coachingSessionId);
  // 🔴 Vérification E2E 2026-07-26. Une évaluation existante mais dont AUCUNE
  // compétence n'est notée doit être traitée comme « non réalisée », pas comme
  // un échec : `scorePct = 0` et `reussite = false` y sont des artefacts de
  // saisie vide, pas un résultat. Sans ce test, l'attestation portait
  // « Non validée — score 0 % » — le faux échec que F22 ferme au niveau du
  // calcul, réintroduit au niveau du document.
  const sansAucuneNote = resultatsFinale !== null && evaluationSansAucuneNote(resultatsFinale);
  const evaluationObtenue =
    resultatsFinale === null || sansAucuneNote
      ? undefined
      : `${resultatsFinale.reussite ? "Réussite" : "Non validée"} — score ${resultatsFinale.scorePct} %`;

  // Ce qui s'imprime sous « Compétences acquises » : les objectifs RÉELLEMENT
  // notés acquis, jamais le programme.
  const competencesAcquisesStr =
    resultatsFinale === null || sansAucuneNote
      ? "Évaluation des acquis non réalisée"
      : resultatsFinale.acquis.length > 0
        ? resultatsFinale.acquis.join(", ")
        : "Aucun objectif évalué comme acquis";

  const reservesStr = [
    resultatsFinale && resultatsFinale.partiels.length > 0
      ? `Partiellement acquis : ${resultatsFinale.partiels.join(", ")}`
      : null,
    resultatsFinale && resultatsFinale.nonAcquis.length > 0
      ? `Non acquis : ${resultatsFinale.nonAcquis.join(", ")}`
      : null,
    resultatsFinale && resultatsFinale.nonEvalues.length > 0
      ? `Non évalués : ${resultatsFinale.nonEvalues.join(", ")}`
      : null,
  ]
    .filter((l): l is string => l !== null)
    .join(" · ");

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

  // heuresPrevues=0 (saisie explicite) traité comme « non défini » → on retient
  // les heures réellement réalisées comme total affiché (évite « X h / 0 h »).
  const heuresTotales = heuresPrevues != null && heuresPrevues > 0 ? heuresPrevues : heuresReelles;
  const formationData = {
    intitule: snap.intitule,
    objectifs: objectifsStr,
    dureeHeures: heuresTotales,
    dateDebut,
    dateFin,
    modalite: snap.modalite,
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
                competencesAcquises: competencesAcquisesStr,
                ...(reservesStr !== "" ? { competencesReserves: reservesStr } : {}),
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
                competencesPartiellesValidees: competencesAcquisesStr,
                ...(reservesStr !== "" ? { competencesReserves: reservesStr } : {}),
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
