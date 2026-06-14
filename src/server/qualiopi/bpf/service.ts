/**
 * Qualiopi — Service BPF (Bilan Pédagogique et Financier) (AGENT A — T10 + T17).
 *
 * computeBpf      : agrégats annuels via Prisma (sessions réalisées).
 * bpfToCsv        : export CSV `;`-séparé (pur).
 * listDepenses    : dépenses BPF par année.
 * ajouterDepense  : création d'une dépense BPF.
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

export interface BpfDepenseItem {
  id: string;
  annee: number;
  categorie: string;
  libelle: string;
  montantHtCents: number;
  createdAt: Date;
}

export interface BpfDepensesResult {
  totalHtCents: number;
  parCategorie: Record<string, number>;
  items: BpfDepenseItem[];
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
  /** Heures stagiaires des sessions collectives (dureeReelle × participants). */
  nbHeuresStagiairesCollectif: number;
  /** Heures stagiaires des parcours coaching AFEST 1-to-1 (Σ séances). */
  nbHeuresStagiairesCoaching: number;
  /** Nombre de parcours coaching AFEST réalisés dans l'année. */
  nbCoachingParcours: number;
  caTotalHtCents: number;
  caParFinanceur: BpfFinanceurDetail;
  nbFormateursInternes: number;
  nbFormateursExternes: number;
  depenses: BpfDepensesResult;
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

  // ── Coaching AFEST 1-to-1 (C1) ─────────────────────────────────────────────
  // Le BPF agrège aussi les parcours de coaching 1-to-1 :
  //  - CA : CoachingContract.montantHtCents signés dans l'année, ventilés par
  //    financementType (direct/opco/cpf/france_travail/mixte) ;
  //  - heures stagiaires : Σ CompteRenduSeance.dureeMinutes / 60 des séances
  //    AFEST réalisées dans l'année. C'est du 1-to-1 → AUCUNE multiplication
  //    par un nombre de participants.
  const coaching = await aggregateCoaching(plage, caParFinanceur);

  const caTotalHtCentsFinal = caTotalHtCents + coaching.caHtCents;
  const nbHeuresStagiairesFinal = nbHeuresStagiaires + coaching.nbHeuresStagiaires;

  const [nbFormateursInternes, nbFormateursExternes, depenses] = await Promise.all([
    prisma.trainer.count({ where: { statut: "salarie", actif: true } }),
    prisma.trainer.count({ where: { statut: "sous_traitant", actif: true } }),
    listDepenses(annee),
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
    nbHeuresStagiaires: nbHeuresStagiairesFinal,
    nbHeuresStagiairesCollectif: nbHeuresStagiaires,
    nbHeuresStagiairesCoaching: coaching.nbHeuresStagiaires,
    nbCoachingParcours: coaching.nbParcours,
    caTotalHtCents: caTotalHtCentsFinal,
    caParFinanceur,
    nbFormateursInternes,
    nbFormateursExternes,
    depenses,
    calculeAt: new Date(),
  };
}

interface CoachingAggregat {
  caHtCents: number;
  nbHeuresStagiaires: number;
  nbParcours: number;
}

/**
 * Agrège la contribution du coaching AFEST 1-to-1 au BPF d'une année :
 *  - somme CoachingContract.montantHtCents signés dans l'année (ventilés par
 *    financeur, MUTE `caParFinanceur` en place comme les sessions collectives) ;
 *  - somme les heures réelles = Σ CompteRenduSeance.dureeMinutes / 60 des séances
 *    AFEST réalisées dans l'année (1-to-1 : pas de multiplication participants).
 *
 * Note : pas de garde stub.invalid ici — `computeBpf` court-circuite déjà avant
 * tout appel Prisma en mode build stub.
 */
async function aggregateCoaching(
  plage: { gte: Date; lt: Date },
  caParFinanceur: BpfFinanceurDetail,
): Promise<CoachingAggregat> {
  const [contracts, coachingSessions] = await Promise.all([
    prisma.coachingContract.findMany({
      where: { dateSigneeAt: plage },
      select: { montantHtCents: true, financementType: true },
    }),
    prisma.coachingSession.findMany({
      where: {
        estAfest: true,
        statut: "realisee",
        dateSeance: plage,
      },
      select: {
        comptesRendus: { select: { dureeMinutes: true } },
      },
    }),
  ]);

  let caHtCents = 0;
  for (const contract of contracts) {
    caHtCents += contract.montantHtCents;
    const type = contract.financementType ?? "direct";
    if (type in caParFinanceur) {
      caParFinanceur[type as keyof BpfFinanceurDetail] += contract.montantHtCents;
    }
  }

  let totalMinutes = 0;
  for (const session of coachingSessions) {
    for (const cr of session.comptesRendus) {
      if (cr.dureeMinutes !== null) {
        totalMinutes += cr.dureeMinutes;
      }
    }
  }

  return { caHtCents, nbHeuresStagiaires: totalMinutes / 60, nbParcours: coachingSessions.length };
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
  lignes.push(`  dont sessions collectives;${bpf.nbHeuresStagiairesCollectif}`);
  lignes.push(`  dont coaching AFEST 1-to-1;${bpf.nbHeuresStagiairesCoaching}`);
  lignes.push(`Nombre de parcours coaching AFEST;${bpf.nbCoachingParcours}`);
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

  // Section dépenses
  if (bpf.depenses.items.length > 0) {
    lignes.push("");
    lignes.push("Dépenses BPF;Montant HT (€)");
    lignes.push(`Total dépenses;${centimesEnEuros(bpf.depenses.totalHtCents)}`);
    lignes.push("");
    lignes.push("Catégorie;Montant HT (€)");
    for (const [categorie, montant] of Object.entries(bpf.depenses.parCategorie)) {
      lignes.push(`${categorie};${centimesEnEuros(montant)}`);
    }
    lignes.push("");
    lignes.push("Libellé;Catégorie;Montant HT (€)");
    for (const d of bpf.depenses.items) {
      lignes.push(`${d.libelle};${d.categorie};${centimesEnEuros(d.montantHtCents)}`);
    }
  }

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
    nbHeuresStagiairesCollectif: 0,
    nbHeuresStagiairesCoaching: 0,
    nbCoachingParcours: 0,
    caTotalHtCents: 0,
    caParFinanceur: { opco: 0, cpf: 0, france_travail: 0, direct: 0, mixte: 0 },
    nbFormateursInternes: 0,
    nbFormateursExternes: 0,
    depenses: { totalHtCents: 0, parCategorie: {}, items: [] },
    calculeAt: new Date(),
  };
}

// ─── Helpers dépenses BPF ────────────────────────────────────────────────────

/**
 * Liste les dépenses BPF d'une année, agrégées (total + par catégorie).
 * Stub-aware : retourne un résultat vide si DATABASE_URL contient "stub.invalid".
 */
export async function listDepenses(annee: number): Promise<BpfDepensesResult> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { totalHtCents: 0, parCategorie: {}, items: [] };
  }

  const rows = await prisma.bpfDepense.findMany({
    where: { annee },
    orderBy: [{ categorie: "asc" }, { createdAt: "asc" }],
  });

  const parCategorie: Record<string, number> = {};
  let totalHtCents = 0;

  for (const row of rows) {
    totalHtCents += row.montantHtCents;
    parCategorie[row.categorie] = (parCategorie[row.categorie] ?? 0) + row.montantHtCents;
  }

  return {
    totalHtCents,
    parCategorie,
    items: rows.map((r) => ({
      id: r.id,
      annee: r.annee,
      categorie: r.categorie,
      libelle: r.libelle,
      montantHtCents: r.montantHtCents,
      createdAt: r.createdAt,
    })),
  };
}

/**
 * Crée une nouvelle dépense BPF.
 * Stub-aware : no-op si DATABASE_URL contient "stub.invalid".
 */
export async function ajouterDepense(input: {
  annee: number;
  categorie: string;
  libelle: string;
  montantHtCents: number;
}): Promise<BpfDepenseItem> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return {
      id: "stub-id",
      annee: input.annee,
      categorie: input.categorie,
      libelle: input.libelle,
      montantHtCents: input.montantHtCents,
      createdAt: new Date(),
    };
  }

  const row = await prisma.bpfDepense.create({
    data: {
      annee: input.annee,
      categorie: input.categorie.slice(0, 80),
      libelle: input.libelle.slice(0, 250),
      montantHtCents: input.montantHtCents,
    },
  });

  return {
    id: row.id,
    annee: row.annee,
    categorie: row.categorie,
    libelle: row.libelle,
    montantHtCents: row.montantHtCents,
    createdAt: row.createdAt,
  };
}

/**
 * Supprime une dépense BPF par id.
 * Stub-aware : no-op si DATABASE_URL contient "stub.invalid".
 */
export async function supprimerDepense(id: string): Promise<void> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return;
  await prisma.bpfDepense.delete({ where: { id } });
}
