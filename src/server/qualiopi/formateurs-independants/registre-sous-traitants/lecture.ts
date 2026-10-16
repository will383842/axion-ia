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
        select: { code: true, faitAt: true, resultat: true, motif: true, auteurId: true },
        orderBy: { faitAt: "desc" },
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
  const cumuls = await lireCumulsHonorairesHtCents(lues.map((l) => l.trainerId));
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
    );
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
    };
  });
}
