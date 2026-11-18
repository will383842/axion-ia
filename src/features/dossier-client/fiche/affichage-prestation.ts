/**
 * Affichage d'une prestation (lot B8). PUR : les quatre étapes de la frise et les libellés de
 * chances et de clôture. « En pause » et « Perdue » sortent du parcours.
 */

import type { EtapePrestation } from "@/features/dossier-client/prestations";
import { LIBELLE_ETAPE_PRESTATION } from "@/features/dossier-client/prestations";

export type EtatEtapeFrise = "fait" | "courant" | "a_venir" | "hors_parcours";

const PARCOURS = ["besoin", "devis_envoye", "accepte", "terminee"] as const;

export const LEGENDE_HORS_PARCOURS = "« En pause » et « Perdue » sortent du parcours.";

export function etapesDeLaFrise(
  etape: EtapePrestation,
): ReadonlyArray<{ libelle: string; etat: EtatEtapeFrise }> {
  const rang = (PARCOURS as readonly string[]).indexOf(etape);
  if (rang === -1) {
    return [
      ...PARCOURS.map((e) => ({
        libelle: LIBELLE_ETAPE_PRESTATION[e],
        etat: "hors_parcours" as const,
      })),
      { libelle: LIBELLE_ETAPE_PRESTATION[etape], etat: "hors_parcours" as const },
    ];
  }
  return PARCOURS.map((e, i) => ({
    libelle: LIBELLE_ETAPE_PRESTATION[e],
    etat: i < rang ? ("fait" as const) : i === rang ? ("courant" as const) : ("a_venir" as const),
  }));
}

/** Terminée ou perdue : plus rien à pondérer. */
export const estEtapeFinale = (etape: EtapePrestation): boolean =>
  etape === "terminee" || etape === "perdue";

export const libelleChances = (pct: number | null): string =>
  pct === null ? "non estimées" : `${pct} %`;

/**
 * « 15 déc. » (jour réel de la saisie, fuseau de Paris), avec l'année quand elle diffère de
 * l'année en cours (« 15 janv. 2027 ») ; `null` : « non estimée ».
 */
export function libelleCloture(jour: string | null): string {
  if (jour === null) return "non estimée";
  const date = new Date(`${jour}T12:00:00.000Z`);
  const annee = (d: Date): string =>
    new Intl.DateTimeFormat("fr-FR", { year: "numeric", timeZone: "Europe/Paris" }).format(d);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    ...(annee(date) === annee(new Date()) ? {} : { year: "numeric" as const }),
    timeZone: "Europe/Paris",
  }).format(date);
}
