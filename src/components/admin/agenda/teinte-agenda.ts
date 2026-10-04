// Couleur d'une ligne d'agenda (2026-10-04, chantier « Types de rendez-vous », lot L3).
//
// Une réservation Calendly prend la teinte de son TYPE (Diagnostic IA = or,
// Échange projet = bleu, Apporteur = violet, Salon = magenta) ; un type sans
// teinte (« Autre ») et les autres sources gardent la couleur de leur source.
// Un seul endroit, partagé par les vues Mois et Semaine et par la légende.

import type { AgendaItem } from "@/features/admin-agenda/types";
import { TEINTE_TYPE_RDV } from "@/features/admin-rendezvous/type-rdv";

/** Teinte d'identité de chaque source — celle des pastilles de filtre. */
export const TEINTE_SOURCE: Readonly<Record<AgendaItem["source"], string>> = {
  calendly: "bleu",
  google: "teal",
  console: "terracotta",
};

export function teinteDe(it: Pick<AgendaItem, "source" | "typeRendezVous">): string {
  if (it.source === "calendly" && it.typeRendezVous) {
    const t = TEINTE_TYPE_RDV[it.typeRendezVous];
    if (t) return t;
  }
  return TEINTE_SOURCE[it.source];
}

export const couleurDe = (it: Pick<AgendaItem, "source" | "typeRendezVous">): string =>
  `var(--color-admin-id-${teinteDe(it)})`;

export const fondDe = (it: Pick<AgendaItem, "source" | "typeRendezVous">): string =>
  `var(--color-admin-id-${teinteDe(it)}-soft)`;
