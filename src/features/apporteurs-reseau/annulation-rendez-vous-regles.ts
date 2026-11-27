/**
 * Contrat 2.8, art. 3.2 — un rendez-vous pris pendant la réservation, puis annulé ou non honoré,
 * ne retient l'entreprise que selon QUI l'a annulé. Module pur, sans base ni horloge.
 *
 *   · auteur non qualifié → retient (art. 1.3 : la Société ne profite pas de son inaction) ;
 *   · Axion IA            → retient (réputé tenu à la date où il était fixé) ;
 *   · l'entreprise        → retient 15 jours, ou tant qu'un report est convenu.
 */

import { ajouterJoursOuvres } from "@/lib/jours-ouvres";

import { finDuNiemeJourParis } from "./regles";

export const JOURS_REPORT_APRES_ANNULATION = 15;

export function annulationRetientEncore(a: {
  auteur: "axion" | "entreprise" | null;
  constateeAt: Date;
  reportCle: string | null;
  maintenant: Date;
}): boolean {
  if (a.auteur === null || a.auteur === "axion") return true;
  if (a.reportCle) return true;
  return (
    a.maintenant.getTime() <=
    finDuNiemeJourParis(a.constateeAt, JOURS_REPORT_APRES_ANNULATION).getTime()
  );
}

/** Seuils d'alerte interne d'une annulation non qualifiée : 5 puis 10 jours ouvrés après le constat. */
export function echeanceQualification(constateeAt: Date): { alerte: Date; critique: Date } {
  return {
    alerte: ajouterJoursOuvres(constateeAt, 5),
    critique: ajouterJoursOuvres(constateeAt, 10),
  };
}
