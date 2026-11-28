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

type LigneAnnulation = {
  rendezVousCle: string;
  auteur: "axion" | "entreprise" | null;
  constateeAt: Date;
  reportCle: string | null;
};

/**
 * Les clés qui ne retiennent PLUS, chaîne des reports comprise : un report qui est lui-même un
 * rendez-vous annulé NE REND PAS la retenue de l'annulation précédente éternelle. Si le report B
 * ne retient plus (entreprise, sans report, 15 jours passés), l'annulation A qui renvoyait à B
 * cesse de retenir à son tour. Point fixe, borné par le nombre de lignes.
 */
export function clesSansRetenue(lignes: LigneAnnulation[], maintenant: Date): Set<string> {
  const libres = new Set<string>();
  let change = true;
  while (change) {
    change = false;
    for (const l of lignes) {
      if (libres.has(l.rendezVousCle)) continue;
      const reportEteint = l.reportCle !== null && libres.has(l.reportCle);
      const retient = annulationRetientEncore({
        auteur: l.auteur,
        constateeAt: l.constateeAt,
        // Un report éteint n'est plus un report convenu : la fenêtre de 15 jours décide.
        reportCle: reportEteint ? null : l.reportCle,
        maintenant,
      });
      if (!retient) {
        libres.add(l.rendezVousCle);
        change = true;
      }
    }
  }
  return libres;
}

/** Un report ne se convient que dans les 15 jours de l'annulation : prise du report ≤ fin du 15e jour. */
export function reportDansLesDelais(constateeAt: Date, reportPrisAt: Date): boolean {
  return (
    reportPrisAt.getTime() <=
    finDuNiemeJourParis(constateeAt, JOURS_REPORT_APRES_ANNULATION).getTime()
  );
}
