import "server-only";

/**
 * LE PILOTAGE DU RECRUTEMENT — les chiffres de l'écran, sans session.
 *
 * ⚠️ Comme `reads.ts` et `export-csv.ts` : **pas un module `"use server"`**.
 *    Aucun droit n'est supposé ici ; la page tranche avant d'appeler.
 *
 * 🔑 AUCUNE IDENTITÉ NE SORT DE CE FICHIER. Il ne rend que des compteurs et des
 *    durées. C'est ce qui permet de l'afficher sans le prédicat d'ouverture de
 *    dossier : savoir qu'il y a onze candidatures en entretien n'apprend rien
 *    sur personne. Les noms, eux, restent derrière `listerDossiersEnSommeil`.
 */

import { prisma } from "@/lib/prisma";
import { STATUTS_CANDIDATURE } from "@/content/recrutement/statuts";
import type { JobApplicationStatus } from "../../../prisma/generated/client";

/**
 * Fenêtre du délai de première réponse.
 *
 * Quatre-vingt-dix jours : assez pour que la médiane repose sur plus d'une
 * poignée de dossiers, assez court pour qu'elle décrive la façon dont on
 * travaille AUJOURD'HUI. Une médiane « depuis toujours » met des années à
 * bouger — donc ne sert jamais à corriger quoi que ce soit.
 */
export const FENETRE_DELAI_JOURS = 90;

/** Plafond du calcul de médiane — fini par principe, large en pratique. */
const PLAFOND_DELAI = 2_000;

export interface BilanPilotage {
  /** Un compteur pour CHAQUE statut, zéro compris. */
  readonly parStatut: Readonly<Record<JobApplicationStatus, number>>;
  readonly total: number;
  /** Dossiers ouverts, tous statuts d'attente confondus. */
  readonly ouverts: number;
  /**
   * Délai médian de première réponse, en heures, sur la fenêtre — `null` quand
   * aucun dossier de la fenêtre n'a encore reçu de réponse.
   *
   * 🔑 MÉDIANE et non moyenne. Un seul dossier répondu six mois plus tard
   * déplace une moyenne de plusieurs jours et rend le chiffre inutilisable ;
   * la médiane dit ce qu'un candidat vit RÉELLEMENT dans un cas sur deux.
   */
  readonly delaiReponseMedianHeures: number | null;
  /** Combien de dossiers ont servi à ce calcul — sans quoi la médiane ment par omission. */
  readonly delaiEchantillon: number;
}

export async function construireBilanPilotage(maintenant: Date): Promise<BilanPilotage> {
  const depuis = new Date(maintenant.getTime() - FENETRE_DELAI_JOURS * 24 * 60 * 60 * 1000);

  const [groupes, repondus] = await Promise.all([
    prisma.jobApplication.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.jobApplication.findMany({
      where: { submittedAt: { gte: depuis }, firstResponseAt: { not: null } },
      select: { submittedAt: true, firstResponseAt: true },
      take: PLAFOND_DELAI,
    }),
  ]);

  // 🔴 La table part de ZÉRO pour chaque statut, et n'est pas construite depuis
  // les groupes rendus. `groupBy` ne rend que les statuts PRÉSENTS : bâtir la
  // table à partir de lui laisserait « En entretien » absent de l'écran tant
  // qu'aucun dossier n'y est — c'est-à-dire exactement quand l'information
  // « personne n'est en entretien » compte le plus.
  const parStatut = Object.fromEntries(STATUTS_CANDIDATURE.map((s) => [s, 0])) as Record<
    JobApplicationStatus,
    number
  >;
  for (const g of groupes) parStatut[g.status] = g._count._all;

  const total = Object.values(parStatut).reduce((n, v) => n + v, 0);

  const heures = repondus
    .map((r) => (r.firstResponseAt!.getTime() - r.submittedAt.getTime()) / 3_600_000)
    // Un délai négatif n'existe pas : il signalerait une date bricolée. On
    // l'écarte plutôt que de le laisser tirer la médiane vers le bas.
    .filter((h) => h >= 0)
    .sort((a, b) => a - b);

  return {
    parStatut,
    total,
    ouverts: parStatut.new + parStatut.reviewing + parStatut.shortlisted,
    delaiReponseMedianHeures: mediane(heures),
    delaiEchantillon: heures.length,
  };
}

/** Médiane d'une série DÉJÀ triée. `null` sur série vide — jamais zéro. */
export function mediane(triee: readonly number[]): number | null {
  if (triee.length === 0) return null;
  const milieu = Math.floor(triee.length / 2);
  // Effectif pair : moyenne des deux valeurs centrales. Prendre l'une des deux
  // ferait sauter la médiane d'un dossier à l'autre à chaque ajout, pour un
  // chiffre censé décrire une tendance.
  return triee.length % 2 === 1 ? triee[milieu]! : (triee[milieu - 1]! + triee[milieu]!) / 2;
}

/** « 3 h », « 2 j 4 h » — le format lu par un humain, pas un nombre décimal. */
export function formaterDuree(heures: number): string {
  if (heures < 1) return "< 1 h";
  if (heures < 48) return `${Math.round(heures)} h`;
  const jours = Math.floor(heures / 24);
  const reste = Math.round(heures - jours * 24);
  return reste === 0 ? `${jours} j` : `${jours} j ${reste} h`;
}
