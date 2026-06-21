/**
 * Qualiopi 1-to-1 / AFEST — kits financeurs + certificat d'un parcours coaching.
 *
 * Parité avec les générateurs formation (documents.ts) MAIS pour un parcours
 * 1-to-1 (CoachingSession + son CoachingContract de rattachement) :
 *   - kit OPCO (ventilation horaire 1 bénéficiaire) ;
 *   - kit CPF / EDOF (reste à charge) ;
 *   - kit France Travail (AIF / POEI / CSP) ;
 *   - convention tripartite OF + entreprise + OPCO (subrogation) ;
 *   - certificat de réalisation (R.6313-3, heures en centièmes) — idempotent.
 *
 * Réutilise les templates existants (KitOpcoPdf, KitCpfPdf, KitFranceTravailPdf,
 * ConventionTripartitePdf, CertificatRealisationPdf), computeCoachingFacturation
 * (ventilation/forfait), getHeuresReelles1to1. Stub-aware. AUCUNE duplication.
 *
 * Le financement vit sur le CoachingContract : les kits OPCO/CPF/FT et la
 * convention exigent un contrat rattaché (foyer administratif du parcours).
 */

import React from "react";
import { prisma } from "@/lib/prisma";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { makeQrToken, qrDataUrl } from "@/server/qualiopi/documents/qr";
import { KitOpcoPdf } from "@/server/qualiopi/documents/templates/kit-opco";
import { KitCpfPdf } from "@/server/qualiopi/documents/templates/kit-cpf";
import { KitFranceTravailPdf } from "@/server/qualiopi/documents/templates/kit-france-travail";
import { ConventionTripartitePdf } from "@/server/qualiopi/documents/templates/convention-tripartite";
import { CertificatRealisationPdf } from "@/server/qualiopi/documents/templates/certificat-realisation";
import { coachingInterventionLabel } from "@/server/formateur/coaching-options";
import { getHeuresReelles1to1 } from "./heures";
import { computeCoachingFacturation } from "./financement-1to1";

export interface KitResult {
  documentId: string;
  numero: string;
}

const STUB_RESULT: KitResult = { documentId: "stub", numero: "AXI-0000-000" };

function isStub(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") ?? false;
}

const formatDate = (d: Date) =>
  d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
const formatDateFr = (d: Date) => d.toLocaleDateString("fr-FR");

/** Sélection commune d'un parcours coaching + son contrat de financement. */
const PARCOURS_SELECT = {
  id: true,
  statut: true,
  interventionSlug: true,
  dateSeance: true,
  beneficiaireNom: true,
  beneficiaireEntreprise: true,
  certificationType: true,
  codeRncp: true,
  codeRs: true,
  numeroEnregistrementFc: true,
  certificatDocumentId: true,
  certificatGenereeAt: true,
  trainee: {
    select: { id: true, nom: true, prenom: true, entreprise: true, fonction: true },
  },
  comptesRendus: { select: { dateSeance: true } },
  coachingContract: {
    select: {
      id: true,
      montantHtCents: true,
      financementType: true,
      subrogation: true,
      numeroDossierOpco: true,
      conventionTripartiteSigneeAt: true,
      priseEnChargeMontantCents: true,
      priseEnChargeUnite: true,
      priseEnChargePlafondFormationCents: true,
      priseEnChargePlafondAnnuelCents: true,
      edofVerifieAt: true,
      resteAChargeCents: true,
      cpfPayeurResteCharge: true,
      ftDispositif: true,
      ftAifPrescriptionDate: true,
      ftPoeiOffreEmploiNumero: true,
      ftPoeiAccordFinancementAt: true,
      ftPoeiEngagementSigneAt: true,
      client: {
        select: {
          raisonSociale: true,
          siret: true,
          adresse: true,
          contactNom: true,
          contactEmail: true,
          opcoIdentifie: true,
          opcoNumeroAdherent: true,
        },
      },
    },
  },
} as const;

type Parcours = NonNullable<Awaited<ReturnType<typeof loadParcours>>>;

async function loadParcours(coachingSessionId: string) {
  return prisma.coachingSession.findUnique({
    where: { id: coachingSessionId },
    select: PARCOURS_SELECT,
  });
}

/** Bénéficiaire : Trainee lié, sinon champs libres (nom dans `nom`, prénom vide). */
function resolveBeneficiaire(cs: Parcours): {
  nom: string;
  prenom: string;
  entreprise?: string;
  fonction?: string;
} {
  if (cs.trainee) {
    return {
      nom: cs.trainee.nom,
      prenom: cs.trainee.prenom,
      ...(cs.trainee.entreprise ? { entreprise: cs.trainee.entreprise } : {}),
      ...(cs.trainee.fonction ? { fonction: cs.trainee.fonction } : {}),
    };
  }
  return {
    nom: cs.beneficiaireNom ?? "Bénéficiaire",
    prenom: "",
    ...(cs.beneficiaireEntreprise ? { entreprise: cs.beneficiaireEntreprise } : {}),
  };
}

/** Bornes du parcours = 1re/dernière séance avec compte-rendu, sinon dateSeance. */
function bornesParcours(cs: Parcours): { dateDebut: string; dateFin: string } {
  const dates = cs.comptesRendus
    .map((cr) => new Date(cr.dateSeance).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  if (dates.length === 0) {
    const d = formatDate(new Date(cs.dateSeance));
    return { dateDebut: d, dateFin: d };
  }
  return {
    dateDebut: formatDate(new Date(dates[0]!)),
    dateFin: formatDate(new Date(dates[dates.length - 1]!)),
  };
}

function requireContrat(cs: Parcours): NonNullable<Parcours["coachingContract"]> {
  if (!cs.coachingContract) {
    throw new Error(
      "Ce parcours n'a pas de contrat de coaching rattaché : impossible de générer un kit financeur. Rattachez un contrat (montant, financement) au préalable.",
    );
  }
  return cs.coachingContract;
}

// ─────────────────────────────────────────────────────────────────────────────
// Kit OPCO (ventilation horaire 1 bénéficiaire)
// ─────────────────────────────────────────────────────────────────────────────

export async function genererKitOpcoCoaching(coachingSessionId: string): Promise<KitResult> {
  if (isStub()) return STUB_RESULT;

  const cs = await loadParcours(coachingSessionId);
  if (!cs) throw new Error(`CoachingSession introuvable : ${coachingSessionId}`);
  const contrat = requireContrat(cs);

  const identite = await getOrganismeIdentite();
  const heures = await getHeuresReelles1to1(coachingSessionId);
  const calc = computeCoachingFacturation(contrat, heures);
  const benef = resolveBeneficiaire(cs);
  const { dateDebut, dateFin } = bornesParcours(cs);

  const prise = calc.totalHtCents;
  const rac = calc.resteAChargeCents ?? Math.max(0, contrat.montantHtCents - prise);
  const baremeHeure =
    contrat.priseEnChargeUnite === "euro_heure" && contrat.priseEnChargeMontantCents != null
      ? contrat.priseEnChargeMontantCents
      : heures > 0
        ? Math.round(prise / heures)
        : prise;

  const ventilation = [
    {
      nomParticipant: `${benef.prenom} ${benef.nom}`.trim(),
      heuresRealisees: heures,
      baremePrisEnChargeHeureCents: baremeHeure,
      montantPrisEnChargeCents: prise,
      resteAChargeCents: rac,
    },
  ];

  const doc = await generateDocument({
    type: "kit_opco",
    buildElement: (numero) =>
      React.createElement(KitOpcoPdf, {
        data: {
          numero,
          dateEmission: formatDateFr(new Date()),
          identite,
          nomOpco: contrat.client?.opcoIdentifie ?? "OPCO (à préciser)",
          numeroDossier: contrat.numeroDossierOpco ?? "—",
          intituleFormation: coachingInterventionLabel(cs.interventionSlug),
          dateDebut,
          dateFin,
          ventilation,
          totalPrisEnChargeCents: prise,
          totalResteAChargeCents: rac,
        },
      }),
    refs: { coachingSessionId },
  });

  return { documentId: doc.id, numero: doc.numero };
}

// ─────────────────────────────────────────────────────────────────────────────
// Kit CPF / EDOF
// ─────────────────────────────────────────────────────────────────────────────

export async function genererKitCpfCoaching(coachingSessionId: string): Promise<KitResult> {
  if (isStub()) return STUB_RESULT;

  const cs = await loadParcours(coachingSessionId);
  if (!cs) throw new Error(`CoachingSession introuvable : ${coachingSessionId}`);
  const contrat = requireContrat(cs);

  const identite = await getOrganismeIdentite();
  const heures = await getHeuresReelles1to1(coachingSessionId);
  const calc = computeCoachingFacturation(contrat, heures);
  const benef = resolveBeneficiaire(cs);
  const { dateDebut, dateFin } = bornesParcours(cs);

  const coutTotal = contrat.montantHtCents;
  const montantCpf = calc.totalHtCents;
  // Participation forfaitaire CPF (réforme 2024) : reste à charge = résiduel s'il
  // existe, sinon plancher SiteSetting `cpf_reste_a_charge` (évite un RAC 0 illégal).
  const racFloorEuros = await getQualiopiConfig("cpf_reste_a_charge");
  const racFloorCents = Math.round((typeof racFloorEuros === "number" ? racFloorEuros : 0) * 100);
  const residuel = Math.max(0, coutTotal - montantCpf);
  const resteACharge = contrat.resteAChargeCents ?? (residuel > 0 ? residuel : racFloorCents);
  // Code RS du parcours certifiant (le coaching n'a pas de codeCpf propre).
  const codeCpf = cs.codeRs ?? cs.numeroEnregistrementFc ?? "—";

  const doc = await generateDocument({
    type: "kit_cpf",
    buildElement: (numero) =>
      React.createElement(KitCpfPdf, {
        data: {
          numero,
          dateEmission: formatDateFr(new Date()),
          identite,
          beneficiaire: { nom: benef.nom, prenom: benef.prenom },
          codeCpf,
          intituleFormation: coachingInterventionLabel(cs.interventionSlug),
          dateDebut,
          dateFin,
          montantCpfCents: montantCpf,
          resteAChargeCents: resteACharge,
          coutTotalCents: coutTotal,
        },
      }),
    refs: { coachingSessionId },
  });

  return { documentId: doc.id, numero: doc.numero };
}

// ─────────────────────────────────────────────────────────────────────────────
// Kit France Travail (AIF / POEI / CSP)
// ─────────────────────────────────────────────────────────────────────────────

export async function genererKitFranceTravailCoaching(
  coachingSessionId: string,
): Promise<KitResult> {
  if (isStub()) return STUB_RESULT;

  const cs = await loadParcours(coachingSessionId);
  if (!cs) throw new Error(`CoachingSession introuvable : ${coachingSessionId}`);
  const contrat = requireContrat(cs);

  const identite = await getOrganismeIdentite();
  const heures = await getHeuresReelles1to1(coachingSessionId);
  const calc = computeCoachingFacturation(contrat, heures);
  const benef = resolveBeneficiaire(cs);
  const { dateDebut, dateFin } = bornesParcours(cs);

  type Dispositif = "AIF" | "POEI" | "CSP";
  const FT_MAP: Record<string, Dispositif> = { aif: "AIF", poei: "POEI", csp: "CSP" };
  const dispositif: Dispositif = contrat.ftDispositif
    ? (FT_MAP[contrat.ftDispositif] ?? "AIF")
    : "AIF";

  const coutTotal = contrat.montantHtCents;
  const montantAide = calc.montantAideFranceTravailCents ?? calc.totalHtCents;
  const resteACharge = contrat.resteAChargeCents ?? Math.max(0, coutTotal - montantAide);

  const doc = await generateDocument({
    type: "kit_france_travail",
    buildElement: (numero) =>
      React.createElement(KitFranceTravailPdf, {
        data: {
          numero,
          dateEmission: formatDateFr(new Date()),
          identite,
          dispositif,
          beneficiaire: { nom: benef.nom, prenom: benef.prenom },
          intituleFormation: coachingInterventionLabel(cs.interventionSlug),
          dateDebut,
          dateFin,
          ...(contrat.numeroDossierOpco
            ? { numeroDossierFranceTravail: contrat.numeroDossierOpco }
            : {}),
          ...(dispositif === "POEI" && contrat.client
            ? {
                entreprisePoei: {
                  raisonSociale: contrat.client.raisonSociale,
                  ...(contrat.client.siret ? { siret: contrat.client.siret } : {}),
                  ...(contrat.ftPoeiOffreEmploiNumero
                    ? { offreEmploiReference: contrat.ftPoeiOffreEmploiNumero }
                    : {}),
                },
              }
            : {}),
          montants: {
            montantAideFranceTravailCents: montantAide,
            resteAChargeCents: resteACharge,
            coutTotalCents: coutTotal,
          },
        },
      }),
    refs: { coachingSessionId },
  });

  return { documentId: doc.id, numero: doc.numero };
}

// ─────────────────────────────────────────────────────────────────────────────
// Convention tripartite (OF + entreprise + OPCO, subrogation)
// ─────────────────────────────────────────────────────────────────────────────

export async function genererConventionTripartiteCoaching(
  coachingSessionId: string,
): Promise<KitResult> {
  if (isStub()) return STUB_RESULT;

  const cs = await loadParcours(coachingSessionId);
  if (!cs) throw new Error(`CoachingSession introuvable : ${coachingSessionId}`);
  const contrat = requireContrat(cs);
  if (!contrat.client) {
    throw new Error(
      "Convention tripartite : un client (entreprise) doit être rattaché au contrat de coaching.",
    );
  }

  const identite = await getOrganismeIdentite();
  const heures = await getHeuresReelles1to1(coachingSessionId);
  const calc = computeCoachingFacturation(contrat, heures);
  const { dateDebut, dateFin } = bornesParcours(cs);
  const benef = resolveBeneficiaire(cs);

  const prixHt = contrat.montantHtCents / 100;
  const montantPrisEnCharge = calc.totalHtCents / 100;
  const nomOpco = contrat.client.opcoIdentifie ?? "OPCO (à préciser)";
  const numeroPriseEnCharge = contrat.numeroDossierOpco ?? contrat.client.opcoNumeroAdherent ?? "—";

  const doc = await generateDocument({
    type: "convention_tripartite",
    identite,
    buildElement: (numero) =>
      React.createElement(ConventionTripartitePdf, {
        data: {
          numero,
          client: {
            raisonSociale: contrat.client!.raisonSociale,
            siret: contrat.client!.siret ?? "—",
            adresse: contrat.client!.adresse ?? "—",
            contact: contrat.client!.contactNom ?? contrat.client!.contactEmail ?? "—",
          },
          opco: { nom: nomOpco, numeroPriseEnCharge },
          intitule: coachingInterventionLabel(cs.interventionSlug),
          objectifs: [coachingInterventionLabel(cs.interventionSlug)],
          publicVise: benef.entreprise
            ? `Bénéficiaire en situation de travail — ${benef.entreprise}`
            : "Bénéficiaire en situation de travail (AFEST)",
          dureeHeures: heures,
          dateDebut,
          dateFin,
          modalite: "Mixte",
          lieu: identite.adresseExercice || identite.adresseSiege || "—",
          effectif: 1,
          prixHt,
          montantPrisEnCharge,
          resteAChargeClient: Math.max(0, prixHt - montantPrisEnCharge),
          dateConvention: formatDateFr(new Date()),
        },
        identite,
      }),
    refs: { coachingSessionId },
  });

  return { documentId: doc.id, numero: doc.numero };
}

// ─────────────────────────────────────────────────────────────────────────────
// Certificat de réalisation 1-to-1 (R.6313-3, heures en centièmes) — idempotent
// ─────────────────────────────────────────────────────────────────────────────

export async function genererCertificat1to1(
  coachingSessionId: string,
  opts?: { force?: boolean },
): Promise<KitResult> {
  if (isStub()) return STUB_RESULT;

  const cs = await loadParcours(coachingSessionId);
  if (!cs) throw new Error(`CoachingSession introuvable : ${coachingSessionId}`);

  // Idempotence.
  if (cs.certificatGenereeAt && cs.certificatDocumentId && !opts?.force) {
    const existing = await prisma.documentGenere.findUnique({
      where: { id: cs.certificatDocumentId },
      select: { id: true, numero: true },
    });
    if (existing) return { documentId: existing.id, numero: existing.numero };
  }

  // R.6313-3 : un certificat atteste d'heures réellement suivies. Pas de certificat
  // pour un parcours annulé.
  if (cs.statut === "annulee") {
    throw new Error(
      "Certificat refusé : le parcours est annulé. Aucun certificat de réalisation ne peut être émis (R.6313-3).",
    );
  }

  const identite = await getOrganismeIdentite();
  const heures = await getHeuresReelles1to1(coachingSessionId);
  const benef = resolveBeneficiaire(cs);
  const { dateDebut, dateFin } = bornesParcours(cs);
  const dirigeant = await getQualiopiConfig("dirigeant_nom");
  const token = makeQrToken();
  const verifyUrl = `${identite.site}/fr/verifier-attestation/${token}`;
  const qrUrl = await qrDataUrl(verifyUrl);

  const contrat = cs.coachingContract;

  const doc = await generateDocument({
    type: "certificat_realisation",
    buildElement: (numero) =>
      React.createElement(CertificatRealisationPdf, {
        data: {
          numero,
          dateEmission: formatDateFr(new Date()),
          identite,
          ...(dirigeant ? { dirigeant } : {}),
          entreprise: {
            raisonSociale:
              contrat?.client?.raisonSociale ?? benef.entreprise ?? identite.raisonSociale,
            ...(contrat?.client?.siret ? { siret: contrat.client.siret } : {}),
            ...(contrat?.client?.adresse ? { adresse: contrat.client.adresse } : {}),
          },
          stagiaire: {
            nom: benef.nom,
            prenom: benef.prenom,
            ...(benef.fonction ? { fonction: benef.fonction } : {}),
          },
          intituleAction: coachingInterventionLabel(cs.interventionSlug),
          dateDebut,
          dateFin,
          // ⚠️ heures en décimal — formatHeuresCentiemes appelé dans le template.
          dureeHeures: heures,
          qrToken: token,
          qrDataUrl: qrUrl,
        },
      }),
    refs: { coachingSessionId },
    qrToken: token,
  });

  await prisma.coachingSession.update({
    where: { id: coachingSessionId },
    data: { certificatDocumentId: doc.id, certificatGenereeAt: new Date() },
  });

  return { documentId: doc.id, numero: doc.numero };
}
