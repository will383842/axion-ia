/**
 * Qualiopi ind. 27 — LECTURE du registre des sous-traitants indépendants, avec ce que
 * l'outil en calcule (pièces, dernier contrôle, prochaine échéance). Une seule lecture
 * pour l'écran, l'export et les alertes : trois lecteurs qui ne divergent pas.
 *
 * Module neutre (ni `server-only`, ni Next) : le moteur d'alertes tourne dans le worker.
 */

import { prisma } from "@/lib/prisma";

import { etatControle } from "../controle-regles";
import { lireCumulsHonorairesHtCents } from "../vigilance-seuil-lecture";

import { preuvesDuControle } from "./controles.config";
import { correctionsEchues } from "./ecarts-regles";
import { lireReglagesInd27 } from "./reglages";

import {
  etatLigneRegistre,
  etatPieces,
  type EtatControle,
  type EtatPiece,
  type ResultatControle,
  type StatutRegistre,
} from "./regles";

export interface TraceLue {
  readonly code: string;
  readonly faitAt: Date;
  readonly resultat: ResultatControle;
  readonly motif: string | null;
  readonly auteurId: string | null;
  /** Contrôle de chaque mission : la mission contrôlée. */
  readonly missionId: string | null;
}

/** Un plan de correction (écart mineur) encore ouvert. */
export interface CorrectionOuverte {
  readonly ecartId: string;
  readonly libelle: string;
  readonly echeance: Date;
}

export interface SuspensionLue {
  readonly suspenduAt: Date;
  readonly motif: string;
}

export interface LigneRegistreLue {
  readonly registreId: string;
  readonly trainerId: string;
  readonly sousTraitantId: string;
  readonly raisonSociale: string;
  readonly siret: string | null;
  readonly nda: string | null;
  readonly formationsHabilitees: string;
  readonly dateEntree: Date;
  readonly statut: StatutRegistre;
  readonly statutDepuis: Date;
  readonly dateSortie: Date | null;
  readonly motifSortie: string | null;
  readonly pieces: ReadonlyArray<EtatPiece>;
  readonly controles: ReadonlyArray<EtatControle>;
  readonly traces: ReadonlyArray<TraceLue>;
  readonly dernierControleAt: Date | null;
  readonly prochaineEcheance: Date | null;
  /** Suspension pour écart majeur en cours, ou `null`. */
  readonly suspension: SuspensionLue | null;
  readonly corrections: ReadonlyArray<CorrectionOuverte>;
  readonly correctionsEchues: ReadonlyArray<{ readonly libelle: string; readonly echeance: Date }>;
}

/** Le libellé d'une preuve, lu dans la liste du contrôle qui l'a constatée. */
function libellePreuve(codeControle: string, codePreuve: string): string {
  return preuvesDuControle(codeControle)?.find((p) => p.code === codePreuve)?.libelle ?? codePreuve;
}

/** Plafond de lecture : bien au-delà du vivier d'un organisme ; l'écran le dit s'il est atteint. */
export const PLAFOND_REGISTRE = 1000;

export async function lireRegistre(maintenant: Date): Promise<LigneRegistreLue[]> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return [];
  const lues = await prisma.registreSousTraitantIndependant.findMany({
    select: {
      id: true,
      trainerId: true,
      sousTraitantId: true,
      dateEntree: true,
      statut: true,
      statutDepuis: true,
      dateSortie: true,
      motifSortie: true,
      sousTraitant: { select: { nom: true, siret: true, nda: true, objetPrestation: true } },
      controles: {
        select: {
          code: true,
          faitAt: true,
          resultat: true,
          motif: true,
          auteurId: true,
          missionId: true,
        },
        orderBy: { faitAt: "desc" },
      },
      suspensions: {
        where: { leveeAt: null },
        select: { suspenduAt: true, motif: true },
        orderBy: { suspenduAt: "desc" },
        take: 1,
      },
      ecarts: {
        where: { gravite: "mineur", corrigeAt: null },
        select: {
          id: true,
          preuveCode: true,
          echeanceCorrectionAt: true,
          controle: { select: { code: true } },
        },
        orderBy: { echeanceCorrectionAt: "asc" },
      },
      trainer: {
        select: {
          documents: {
            select: {
              type: true,
              statutValidation: true,
              fichierUrl: true,
              dateEmission: true,
              dateExpiration: true,
              archiveAt: true,
            },
          },
          verificationsRegistre: {
            select: { verdict: true, source: true, verifieAt: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
      },
    },
    orderBy: { dateEntree: "asc" },
    take: PLAFOND_REGISTRE,
  });
  const [cumuls, reglages] = await Promise.all([
    lireCumulsHonorairesHtCents(lues.map((l) => l.trainerId)),
    lireReglagesInd27(),
  ]);
  return lues.map((l): LigneRegistreLue => {
    const pieces = etatPieces(
      l.trainer.documents.filter((d) => d.archiveAt === null),
      cumuls.get(l.trainerId) ?? null,
      maintenant,
    );
    // Un orange encore à valider n'est pas une conclusion : il ne compte pas comme fait.
    const registre = etatControle(l.trainer.verificationsRegistre, maintenant);
    const etat = etatLigneRegistre(
      {
        dateEntree: l.dateEntree,
        traces: l.controles,
        dernierControleRegistreAt:
          registre.statut === "orange_a_valider" ? null : registre.dernierAt,
        pieces,
      },
      maintenant,
      reglages,
    );
    const corrections = l.ecarts.flatMap((e): CorrectionOuverte[] =>
      e.echeanceCorrectionAt === null
        ? []
        : [
            {
              ecartId: e.id,
              libelle: libellePreuve(e.controle.code, e.preuveCode),
              echeance: e.echeanceCorrectionAt,
            },
          ],
    );
    const suspension = l.suspensions[0] ?? null;
    return {
      registreId: l.id,
      trainerId: l.trainerId,
      sousTraitantId: l.sousTraitantId,
      raisonSociale: l.sousTraitant.nom,
      siret: l.sousTraitant.siret,
      nda: l.sousTraitant.nda,
      formationsHabilitees: l.sousTraitant.objetPrestation,
      dateEntree: l.dateEntree,
      statut: l.statut,
      statutDepuis: l.statutDepuis,
      dateSortie: l.dateSortie,
      motifSortie: l.motifSortie,
      pieces,
      controles: etat.controles,
      traces: l.controles,
      dernierControleAt: etat.dernierControleAt,
      prochaineEcheance: etat.prochaineEcheance,
      suspension,
      corrections,
      correctionsEchues: correctionsEchues(
        corrections.map((c) => ({ ...c, corrigeAt: null })),
        maintenant,
      ),
    };
  });
}

export interface MissionAControler {
  readonly missionId: string;
  readonly trainerId: string;
  readonly libelle: string;
  /** Un contrôle de mission y est déjà tracé (un nouveau peut toujours s'ajouter). */
  readonly dejaControlee: boolean;
}

/** Au plus 300 missions proposées au contrôle : les plus récentes d'abord. */
export const MISSIONS_A_CONTROLER_MAX = 300;

/**
 * Les missions ACCORDÉES des sous-traitants du registre, sessions commencées, pour le
 * contrôle de chaque mission. Lecture seule ; illisible : liste vide.
 */
export async function lireMissionsAControler(
  trainerIds: ReadonlyArray<string>,
  maintenant: Date,
): Promise<MissionAControler[]> {
  if (trainerIds.length === 0 || process.env["DATABASE_URL"]?.includes("stub.invalid")) return [];
  try {
    const lues = await prisma.missionFormateur.findMany({
      where: {
        trainerId: { in: [...trainerIds] },
        // = `STATUTS_ACCORD_DONNE` (`trainers/mission-formateur.ts`, trop lourd à importer
        // ici : il tire la file d'envoi dans le moteur d'alertes).
        statut: { in: ["acceptee", "accord_hors_outil"] },
        session: { dateDebut: { lte: maintenant } },
      },
      select: {
        id: true,
        trainerId: true,
        session: { select: { numero: true, titreSession: true, dateDebut: true } },
        controlesSousTraitance: { select: { id: true }, take: 1 },
      },
      orderBy: { session: { dateDebut: "desc" } },
      take: MISSIONS_A_CONTROLER_MAX,
    });
    return lues.map((m) => ({
      missionId: m.id,
      trainerId: m.trainerId,
      libelle: `${m.session.numero} — ${m.session.titreSession} (${m.session.dateDebut.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })})`,
      dejaControlee: m.controlesSousTraitance.length > 0,
    }));
  } catch {
    return [];
  }
}
