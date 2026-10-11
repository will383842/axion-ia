/**
 * « Dossiers et contrats » (lot L8) — LECTURE de la liste des formateurs
 * indépendants, avec l'étape calculée de chacun.
 *
 * Lecture seule. L'étape vient de `etapeFormateurIndependant` (pure) : aucune
 * colonne d'étape n'est lue ni écrite.
 */

import "server-only";

import { prisma } from "@/lib/prisma";
import { versionGabaritInstantane } from "@/server/qualiopi/documents/templates/gabarit-versions";

import { etapeFormateurIndependant, type Etape } from "./etape-parcours-independant";

/** Première version du contrat-cadre signée avec un code (L7c) : celle du parcours. */
const VERSION_CONTRAT_PARCOURS = 3;

/** Plafond de la liste : au-delà, la console découpera. */
export const PLAFOND_LISTE = 500;

export interface LigneDossier {
  readonly trainerId: string;
  /** « Prénom N. » — l'écran de console, jamais un journal. */
  readonly nomAffiche: string;
  readonly etape: Etape;
  readonly estTestInterne: boolean;
}

function versionDuContrat(metadata: unknown): number {
  if (typeof metadata !== "object" || metadata === null) return 1;
  return versionGabaritInstantane((metadata as Record<string, unknown>)["renderData"]);
}

export async function lireDossiersEtContrats(): Promise<LigneDossier[]> {
  const trainers = await prisma.trainer.findMany({
    where: { statut: "sous_traitant" },
    orderBy: { updatedAt: "desc" },
    take: PLAFOND_LISTE,
    select: {
      id: true,
      prenom: true,
      nom: true,
      actif: true,
      estTestInterne: true,
      finCollaborationAt: true,
      activationValideeAt: true,
      dossierStatut: true,
      dossierOuvertAt: true,
      dossierEnvoyeAt: true,
      dossierVerifieAt: true,
      verificationsRegistre: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { verdict: true },
      },
      documentsGeneres: {
        where: { type: "contrat_sous_traitance", annuleeAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          metadata: true,
          statutSignature: true,
          signatures: {
            where: { revokedAt: null },
            select: { partie: true, signeAt: true },
          },
        },
      },
    },
  });

  return trainers.map((t) => {
    const contrat = t.documentsGeneres.find(
      (d) => versionDuContrat(d.metadata) >= VERSION_CONTRAT_PARCOURS,
    );
    const signature = (partie: string) =>
      contrat?.signatures.find((s) => s.partie === partie)?.signeAt ?? null;
    return {
      trainerId: t.id,
      nomAffiche: `${t.prenom} ${t.nom.slice(0, 1)}.`,
      estTestInterne: t.estTestInterne,
      etape: etapeFormateurIndependant({
        actif: t.actif,
        finCollaborationAt: t.finCollaborationAt,
        activationValideeAt: t.activationValideeAt,
        dossierStatut: t.dossierStatut,
        dossierOuvertAt: t.dossierOuvertAt,
        dossierEnvoyeAt: t.dossierEnvoyeAt,
        dossierVerifieAt: t.dossierVerifieAt,
        dernierVerdict: t.verificationsRegistre[0]?.verdict ?? null,
        contrat:
          contrat === undefined
            ? null
            : {
                statutSignature: contrat.statutSignature,
                signeLe: signature("sous_traitant"),
                contresigneLe: signature("axionia"),
              },
      }),
    };
  });
}
