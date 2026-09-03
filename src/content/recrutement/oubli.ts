/**
 * QUAND UN DOSSIER DE CANDIDAT EST « OUBLIÉ » — la règle, et rien d'autre.
 *
 * 🔴 POURQUOI CE FICHIER EST PUR.
 *
 * La même règle sert TROIS consommateurs : l'écran de pilotage, le passage de
 * cron qui alerte sur Telegram, et le test qui prouve les deux. Écrite dans une
 * requête SQL, elle aurait été recopiée trois fois — et la troisième copie est
 * toujours celle qui dérive. Ici elle est écrite une fois, sans base de données,
 * donc éprouvable sur une date fixe plutôt que sur « maintenant ».
 *
 * 🔑 LA REQUÊTE NE FAIT QUE PRÉ-TRIER. `listerDossiersEnSommeil` borne en SQL
 * un SUR-ENSEMBLE (dossiers ouverts déposés depuis plus que le plus court des
 * deux seuils) puis appelle cette fonction sur chaque ligne. Une requête qui
 * trancherait elle-même serait une seconde écriture de la règle, libre de
 * diverger sans que rien ne rougisse.
 */

import type { JobApplicationStatus } from "../../../prisma/generated/client";
import { estOuvert } from "./statuts";

/**
 * Un candidat qui n'a JAMAIS eu de réponse depuis son dépôt.
 *
 * Sept jours, et non quatorze : au-delà d'une semaine, la personne a compris
 * qu'on ne répondrait pas. Le seuil ne mesure pas notre confort d'organisation,
 * il mesure ce que le candidat vit.
 */
export const SEUIL_SANS_REPONSE_JOURS = 7;

/**
 * Un dossier dont plus rien ne bouge — ni réponse, ni note, ni entretien.
 *
 * Vingt-et-un jours parce qu'un processus de recrutement respire : trois
 * semaines sans une seule ligne au journal ne sont plus une respiration, c'est
 * un dossier tombé de la pile. Un seuil plus court remplirait l'écran de
 * dossiers en cours normaux — et un écran d'alerte plein de faux positifs
 * cesse d'être regardé, ce qui est pire que pas d'écran du tout.
 */
export const SEUIL_SANS_ACTIVITE_JOURS = 21;

export type MotifOubli = "jamais_repondu" | "sans_activite";

export const LIBELLE_MOTIF_OUBLI: Record<MotifOubli, string> = {
  jamais_repondu: "Jamais répondu depuis le dépôt",
  sans_activite: "Aucune activité depuis trois semaines",
};

/**
 * L'ordre de gravité, et il n'est pas décoratif : c'est celui du tri de
 * l'écran. Un candidat qui n'a rien reçu passe avant un dossier qui s'endort,
 * parce que le premier a une attente et le second n'en a plus.
 */
export const MOTIFS_OUBLI_PAR_GRAVITE = ["jamais_repondu", "sans_activite"] as const;

/** Ce que la règle a besoin de savoir — pas une ligne Prisma, juste ces quatre champs. */
export interface DossierAExaminer {
  readonly status: JobApplicationStatus;
  readonly submittedAt: Date;
  readonly firstResponseAt: Date | null;
  readonly lastActivityAt: Date | null;
}

const JOUR_MS = 24 * 60 * 60 * 1000;

/** Le plus court des deux seuils — la borne que la requête peut poser sans trancher. */
export const SEUIL_LE_PLUS_COURT_JOURS = Math.min(
  SEUIL_SANS_REPONSE_JOURS,
  SEUIL_SANS_ACTIVITE_JOURS,
);

export function ilYAJours(maintenant: Date, jours: number): Date {
  return new Date(maintenant.getTime() - jours * JOUR_MS);
}

/**
 * Le motif pour lequel ce dossier est oublié, ou `null` s'il ne l'est pas.
 *
 * 🔑 Trois refus délibérés :
 *
 * - **un dossier refermé n'est jamais oublié.** Écarté, retiré, recruté,
 *   archivé : la décision est prise, l'absence d'activité est normale. Sans ce
 *   premier filtre, l'écran se remplirait des refus de l'an dernier et on ne
 *   verrait plus les vrais.
 * - **« jamais répondu » l'emporte sur « sans activité »**, même quand les deux
 *   sont vrais. Une note interne posée il y a deux jours rend le dossier
 *   « actif » de notre point de vue et ne change RIEN pour le candidat, qui
 *   n'a toujours rien reçu. Annoncer le motif le plus doux serait mentir sur
 *   ce qui reste à faire.
 * - **l'ancre du second motif est `lastActivityAt ?? submittedAt`.** Un dossier
 *   qui n'a jamais eu la moindre ligne de journal n'est pas « sans date donc
 *   sans problème » : c'est le cas le plus abandonné qui soit.
 */
export function motifDOubli(dossier: DossierAExaminer, maintenant: Date): MotifOubli | null {
  if (!estOuvert(dossier.status)) return null;

  if (
    dossier.firstResponseAt === null &&
    dossier.submittedAt < ilYAJours(maintenant, SEUIL_SANS_REPONSE_JOURS)
  ) {
    return "jamais_repondu";
  }

  const ancre = dossier.lastActivityAt ?? dossier.submittedAt;
  if (ancre < ilYAJours(maintenant, SEUIL_SANS_ACTIVITE_JOURS)) {
    return "sans_activite";
  }

  return null;
}

/** Âge en jours pleins depuis l'ancre — ce qu'on affiche à côté du motif. */
export function joursDepuis(date: Date, maintenant: Date): number {
  return Math.floor((maintenant.getTime() - date.getTime()) / JOUR_MS);
}
