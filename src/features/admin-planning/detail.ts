// Planning unifié — fiche 360° d'une prestation.
//
// Rassemble en UNE lecture ce qu'un pilote doit voir au clic depuis le
// calendrier : entreprise et contact (nom, e-mail, téléphone), lieu, formateur
// assigné, financement (OPCO / CPF / France Travail) avec ses justificatifs, et
// les factures. Chargée à la demande — le calendrier reste léger.
//
// Build-safety (ADR 0026) : `prisma` est un Proxy stub au build → `null`.

import { prisma } from "@/lib/prisma";
import { formatLieu } from "@/server/qualiopi/lieu/format-lieu";
import type { PlanningEventType, PlanningStatut } from "./types";

/** Types de `DocumentGenere` valant justificatif de financement. */
export const JUSTIFICATIF_TYPES = [
  "kit_opco",
  "kit_cpf",
  "kit_france_travail",
  "convention_tripartite",
] as const;

export interface DetailFormateur {
  id: string;
  nomComplet: string;
  email: string;
  telephone: string | null;
  /** `salarie` | `sous_traitant`. */
  statut: string;
}

export interface DetailClient {
  raisonSociale: string;
  siret: string | null;
  adresse: string | null;
  contactNom: string | null;
  contactFonction: string | null;
  contactEmail: string | null;
  contactTelephone: string | null;
  opcoIdentifie: string | null;
}

export interface DetailFinancement {
  financementType: string | null;
  /** Statut de l'accord OPCO (formation collective uniquement). */
  opcoStatut: string | null;
  numeroDossierOpco: string | null;
  subrogation: boolean;
  priseEnChargeMontantCents: number | null;
  priseEnChargeSourceUrl: string | null;
  conventionTripartiteSigneeAt: Date | null;
}

export interface DetailDocument {
  id: string;
  type: string;
  numero: string;
  pdfUrl: string | null;
  createdAt: Date;
}

export interface DetailFacture {
  id: string;
  numero: string;
  statut: string;
  destinataire: string;
  montantHtCents: number;
  emiseAt: Date | null;
}

export interface PlanningEventDetail {
  type: PlanningEventType;
  id: string;
  titre: string;
  debut: Date;
  fin: Date | null;
  statut: PlanningStatut;
  lieu: string | null;
  montantHtCents: number | null;
  /** Formation collective uniquement. */
  participants: { inscrits: number; prevus: number; reels: number | null } | null;
  formateur: DetailFormateur | null;
  client: DetailClient | null;
  /** Bénéficiaire nommé (coaching 1-to-1). */
  beneficiaire: { nom: string | null; email: string | null } | null;
  financement: DetailFinancement | null;
  justificatifs: DetailDocument[];
  factures: DetailFacture[];
}

const CLIENT_SELECT = {
  raisonSociale: true,
  siret: true,
  adresse: true,
  contactNom: true,
  contactFonction: true,
  contactEmail: true,
  contactTelephone: true,
  opcoIdentifie: true,
} as const;

const TRAINER_SELECT = {
  id: true,
  nom: true,
  prenom: true,
  email: true,
  telephone: true,
  statut: true,
} as const;

const LIEU_SELECT = {
  lieuType: true,
  lieuIntitule: true,
  lieuAdresse: true,
  lieuCodePostal: true,
  lieuVille: true,
  lieuSalle: true,
  lieuVisioUrl: true,
} as const;

type TrainerRow = {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  statut: string;
};

function toFormateur(t: TrainerRow | null): DetailFormateur | null {
  if (t === null) return null;
  return {
    id: t.id,
    nomComplet: `${t.prenom} ${t.nom}`.trim(),
    email: t.email,
    telephone: t.telephone,
    statut: t.statut,
  };
}

async function formationDetail(id: string): Promise<PlanningEventDetail | null> {
  const s = await prisma.trainingSession.findUnique({
    where: { id },
    select: {
      id: true,
      titreSession: true,
      dateDebut: true,
      dateFin: true,
      statut: true,
      montantHtCents: true,
      nbParticipantsPrevus: true,
      nbParticipantsReels: true,
      financementType: true,
      opcoStatut: true,
      numeroDossierOpco: true,
      opcoSubrogation: true,
      priseEnChargeMontantCents: true,
      priseEnChargeSourceUrl: true,
      conventionTripartiteSigneeAt: true,
      ...LIEU_SELECT,
      formateurPrincipal: { select: TRAINER_SELECT },
      client: { select: CLIENT_SELECT },
      _count: { select: { enrollments: true } },
      documents: {
        where: { type: { in: [...JUSTIFICATIF_TYPES] } },
        select: { id: true, type: true, numero: true, pdfUrl: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
      facturesFormation: {
        select: {
          id: true,
          numero: true,
          statut: true,
          destinataire: true,
          montantHtCents: true,
          emiseAt: true,
        },
        orderBy: { numero: "desc" },
      },
    },
  });
  if (s === null) return null;

  return {
    type: "formation",
    id: s.id,
    titre: s.titreSession,
    debut: s.dateDebut,
    fin: s.dateFin,
    statut: s.statut as PlanningStatut,
    lieu: formatLieu(s),
    montantHtCents: s.montantHtCents,
    participants: {
      inscrits: s._count.enrollments,
      prevus: s.nbParticipantsPrevus,
      reels: s.nbParticipantsReels,
    },
    formateur: toFormateur(s.formateurPrincipal),
    client: s.client,
    beneficiaire: null,
    financement: {
      financementType: s.financementType,
      opcoStatut: s.opcoStatut,
      numeroDossierOpco: s.numeroDossierOpco,
      subrogation: s.opcoSubrogation,
      priseEnChargeMontantCents: s.priseEnChargeMontantCents,
      priseEnChargeSourceUrl: s.priseEnChargeSourceUrl,
      conventionTripartiteSigneeAt: s.conventionTripartiteSigneeAt,
    },
    justificatifs: s.documents,
    factures: s.facturesFormation,
  };
}

async function coachingDetail(id: string): Promise<PlanningEventDetail | null> {
  const c = await prisma.coachingSession.findUnique({
    where: { id },
    select: {
      id: true,
      interventionSlug: true,
      dateSeance: true,
      dateSeanceFin: true,
      statut: true,
      beneficiaireNom: true,
      beneficiaireEmail: true,
      ...LIEU_SELECT,
      trainer: { select: TRAINER_SELECT },
      coachingContract: {
        select: {
          montantHtCents: true,
          financementType: true,
          numeroDossierOpco: true,
          subrogation: true,
          priseEnChargeMontantCents: true,
          priseEnChargeSourceUrl: true,
          conventionTripartiteSigneeAt: true,
          client: { select: CLIENT_SELECT },
        },
      },
    },
  });
  if (c === null) return null;

  const contrat = c.coachingContract;

  return {
    type: "coaching",
    id: c.id,
    titre: c.interventionSlug,
    debut: c.dateSeance,
    fin: c.dateSeanceFin,
    statut: c.statut as PlanningStatut,
    lieu: formatLieu(c),
    montantHtCents: contrat?.montantHtCents ?? null,
    participants: null,
    formateur: toFormateur(c.trainer),
    client: contrat?.client ?? null,
    beneficiaire: { nom: c.beneficiaireNom, email: c.beneficiaireEmail },
    financement:
      contrat !== null && contrat !== undefined
        ? {
            financementType: contrat.financementType,
            // L'accord OPCO n'est suivi qu'au niveau session collective.
            opcoStatut: null,
            numeroDossierOpco: contrat.numeroDossierOpco,
            subrogation: contrat.subrogation,
            priseEnChargeMontantCents: contrat.priseEnChargeMontantCents,
            priseEnChargeSourceUrl: contrat.priseEnChargeSourceUrl,
            conventionTripartiteSigneeAt: contrat.conventionTripartiteSigneeAt,
          }
        : null,
    justificatifs: [],
    factures: [],
  };
}

/** Fiche 360° d'une prestation. `null` si introuvable (ou au build, stub Prisma). */
export async function getPlanningEventDetail(
  type: PlanningEventType,
  id: string,
): Promise<PlanningEventDetail | null> {
  try {
    return type === "formation" ? await formationDetail(id) : await coachingDetail(id);
  } catch {
    return null;
  }
}
