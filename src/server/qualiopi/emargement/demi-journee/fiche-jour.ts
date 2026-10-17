/**
 * Chantier QNC, lot L06 — LA FICHE DU JOUR J.
 *
 * Deux cases que l'organisme coche le jour même :
 *   - **rappel du cadre** : règlement intérieur, objectifs, horaires et
 *     modalités d'émargement rappelés en séance ;
 *   - **supports remis** : les supports de la journée remis aux stagiaires.
 *
 * Chaque case cochée écrit, pour chaque inscrit actif, une ligne de
 * `remises_retours` (journal en AJOUT SEUL du socle) : nature `remise`,
 * destinataire `stagiaire`, objet `emargement_<case>:<jour>`. Ainsi la preuve
 * est nominative et ne s'efface pas : décocher n'existe pas, et l'écran le dit.
 *
 * Réécrire est idempotent : un inscrit qui a déjà sa ligne n'en reçoit pas une
 * seconde ; un inscrit ajouté dans la journée reçoit la sienne au clic suivant.
 */

import { prisma } from "@/lib/prisma";
import { inscriptionsActives } from "@/server/qualiopi/inscriptions/inscriptions-actives";
import type { CanalRemise } from "../../../../../prisma/generated/client";

export type CaseFicheJour = "rappel_cadre" | "supports_remis";

export const LIBELLE_CASE: Readonly<Record<CaseFicheJour, string>> = {
  rappel_cadre:
    "Rappel du cadre en séance : règlement intérieur, objectifs, horaires et modalités d'émargement",
  supports_remis: "Supports de la journée remis aux stagiaires",
};

/** `emargement_rappel_cadre:2026-10-16`. */
export function objetCase(c: CaseFicheJour, jour: string): string {
  return `emargement_${c}:${jour}`;
}

export interface EtatFicheJour {
  /** Première écriture de la case ce jour, `null` si elle n'est pas cochée. */
  readonly rappelCadreLe: Date | null;
  readonly supportsRemisLe: Date | null;
}

export async function lireFicheJour(sessionId: string, jour: string): Promise<EtatFicheJour> {
  const lignes = await prisma.remiseRetour.findMany({
    where: {
      sessionId,
      nature: "remise",
      objet: { in: [objetCase("rappel_cadre", jour), objetCase("supports_remis", jour)] },
    },
    select: { objet: true, survenuLe: true },
    orderBy: { survenuLe: "asc" },
  });
  const premier = (c: CaseFicheJour) =>
    lignes.find((l) => l.objet === objetCase(c, jour))?.survenuLe ?? null;
  return { rappelCadreLe: premier("rappel_cadre"), supportsRemisLe: premier("supports_remis") };
}

/**
 * Coche des cases de la fiche du jour pour toute la session.
 * L'habilitation et l'interrupteur se vérifient chez l'appelant.
 *
 * @returns le nombre de lignes écrites (0 = tout était déjà consigné).
 */
export async function cocherFicheJour(input: {
  readonly sessionId: string;
  readonly jour: string;
  readonly cases: ReadonlyArray<CaseFicheJour>;
  readonly canalSupports: CanalRemise;
  readonly adminUserId: string;
}): Promise<number> {
  if (input.cases.length === 0) return 0;
  const inscrits = await prisma.enrollment.findMany({
    where: { sessionId: input.sessionId, ...inscriptionsActives(), trainee: { deletedAt: null } },
    select: { id: true },
  });
  if (inscrits.length === 0) return 0;
  const objets = input.cases.map((c) => objetCase(c, input.jour));
  const deja = await prisma.remiseRetour.findMany({
    where: { sessionId: input.sessionId, nature: "remise", objet: { in: objets } },
    select: { enrollmentId: true, objet: true },
  });
  const present = new Set(deja.map((d) => `${d.enrollmentId ?? ""}|${d.objet}`));
  const data = input.cases.flatMap((c) =>
    inscrits
      .filter((e) => !present.has(`${e.id}|${objetCase(c, input.jour)}`))
      .map((e) => ({
        sessionId: input.sessionId,
        enrollmentId: e.id,
        nature: "remise" as const,
        destinataire: "stagiaire" as const,
        canal: c === "rappel_cadre" ? ("autre" as const) : input.canalSupports,
        objet: objetCase(c, input.jour),
        libelle: `${LIBELLE_CASE[c]} — ${input.jour}`.slice(0, 300),
        auteurId: input.adminUserId,
      })),
  );
  if (data.length === 0) return 0;
  const r = await prisma.remiseRetour.createMany({ data });
  return r.count;
}
