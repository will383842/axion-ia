/**
 * Qualiopi — Service BPF (Bilan Pédagogique et Financier) (AGENT A — T10).
 *
 * computeBpf  : agrégats annuels via Prisma (sessions réalisées).
 * bpfToCsv    : export CSV `;`-séparé (pur).
 */

import { prisma } from "@/lib/prisma";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";

export interface BpfFinanceurDetail {
  opco: number;
  cpf: number;
  france_travail: number;
  direct: number;
  mixte: number;
}

export interface BpfResult {
  annee: number;
  organisme: {
    raisonSociale: string;
    nda: string;
    siret: string;
  };
  nbSessions: number;
  nbStagiairesDistincts: number;
  nbHeuresStagiaires: number;
  caTotalHtCents: number;
  caParFinanceur: BpfFinanceurDetail;
  nbFormateursInternes: number;
  nbFormateursExternes: number;
  calculeAt: Date;
}

export async function computeBpf(annee: number): Promise<BpfResult> {
  const identite = await getOrganismeIdentite();

  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return buildEmptyBpf(annee, identite);
  }

  const plage = {
    gte: new Date(`${annee}-01-01T00:00:00.000Z`),
    lt: new Date(`${annee + 1}-01-01T00:00:00.000Z`),
  };

  const sessions = await prisma.trainingSession.findMany({
    where: {
      statut: "realisee",
      dateDebut: plage,
    },
    select: {
      id: true,
      dureeReelleHeures: true,
      nbParticipantsReels: true,
      montantHtCents: true,
      financementType: true,
      enrollments: {
        select: { traineeId: true },
      },
    },
  });

  const nbSessions = sessions.length;

  const traineeIds = new Set<string>();
  for (const session of sessions) {
    for (const enrollment of session.enrollments) {
      traineeIds.add(enrollment.traineeId);
    }
  }
  const nbStagiairesDistincts = traineeIds.size;

  let nbHeuresStagiaires = 0;
  for (const session of sessions) {
    if (session.dureeReelleHeures !== null && session.nbParticipantsReels !== null) {
      nbHeuresStagiaires += session.dureeReelleHeures * session.nbParticipantsReels;
    }
  }

  const caTotalHtCents = sessions.reduce((acc, s) => acc + s.montantHtCents, 0);

  const caParFinanceur: BpfFinanceurDetail = {
    opco: 0,
    cpf: 0,
    france_travail: 0,
    direct: 0,
    mixte: 0,
  };
  for (const session of sessions) {
    const type = session.financementType ?? "direct";
    if (type in caParFinanceur) {
      caParFinanceur[type as keyof BpfFinanceurDetail] += session.montantHtCents;
    }
  }

  const [nbFormateursInternes, nbFormateursExternes] = await Promise.all([
    prisma.trainer.count({ where: { statut: "salarie", actif: true } }),
    prisma.trainer.count({ where: { statut: "sous_traitant", actif: true } }),
  ]);

  return {
    annee,
    organisme: {
      raisonSociale: identite.raisonSociale,
      nda: identite.nda,
      siret: identite.siret,
    },
    nbSessions,
    nbStagiairesDistincts,
    nbHeuresStagiaires,
    caTotalHtCents,
    caParFinanceur,
    nbFormateursInternes,
    nbFormateursExternes,
    calculeAt: new Date(),
  };
}

export function bpfToCsv(bpf: BpfResult): string {
  const lignes: string[] = [];

  lignes.push(`Bilan Pédagogique et Financier — Année ${bpf.annee}`);
  lignes.push(`Organisme;${bpf.organisme.raisonSociale}`);
  lignes.push(`NDA;${bpf.organisme.nda}`);
  lignes.push(`SIRET;${bpf.organisme.siret}`);
  lignes.push(`Généré le;${bpf.calculeAt.toLocaleDateString("fr-FR")}`);
  lignes.push("");
  lignes.push("Indicateur;Valeur");
  lignes.push(`Nombre de sessions réalisées;${bpf.nbSessions}`);
  lignes.push(`Nombre de stagiaires distincts;${bpf.nbStagiairesDistincts}`);
  lignes.push(`Nombre d'heures stagiaires;${bpf.nbHeuresStagiaires}`);
  lignes.push(`Chiffre d'affaires total HT (€);${centimesEnEuros(bpf.caTotalHtCents)}`);
  lignes.push("");
  lignes.push("Financeur;CA HT (€)");
  lignes.push(`OPCO;${centimesEnEuros(bpf.caParFinanceur.opco)}`);
  lignes.push(`CPF;${centimesEnEuros(bpf.caParFinanceur.cpf)}`);
  lignes.push(`France Travail;${centimesEnEuros(bpf.caParFinanceur.france_travail)}`);
  lignes.push(`Financement direct;${centimesEnEuros(bpf.caParFinanceur.direct)}`);
  lignes.push(`Mixte;${centimesEnEuros(bpf.caParFinanceur.mixte)}`);
  lignes.push("");
  lignes.push("Formateurs;Nombre");
  lignes.push(`Formateurs internes (salariés);${bpf.nbFormateursInternes}`);
  lignes.push(`Formateurs externes (sous-traitants);${bpf.nbFormateursExternes}`);

  return lignes.join("\n");
}

function centimesEnEuros(centimes: number): string {
  return (centimes / 100).toFixed(2);
}

function buildEmptyBpf(
  annee: number,
  identite: Awaited<ReturnType<typeof getOrganismeIdentite>>,
): BpfResult {
  return {
    annee,
    organisme: {
      raisonSociale: identite.raisonSociale,
      nda: identite.nda,
      siret: identite.siret,
    },
    nbSessions: 0,
    nbStagiairesDistincts: 0,
    nbHeuresStagiaires: 0,
    caTotalHtCents: 0,
    caParFinanceur: { opco: 0, cpf: 0, france_travail: 0, direct: 0, mixte: 0 },
    nbFormateursInternes: 0,
    nbFormateursExternes: 0,
    calculeAt: new Date(),
  };
}
