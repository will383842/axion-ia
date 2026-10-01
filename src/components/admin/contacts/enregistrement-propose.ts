// Qui reçoit la question « Enregistrer cette visio ? » (2026-10-01).
//
// Un rendez-vous du DOSSIER CLIENT (liste blanche, jamais un apporteur ni une
// candidature) et un drapeau d'enregistrement non fermé. Sinon : `null`, et le
// bouton « Rejoindre la visio » reste tel quel — aucun enregistrement possible.
// Module PUR : la page lit le drapeau côté serveur et le passe ici.

import type { ModeEnregistrement } from "@/server/visio/drapeau";
import { estRendezVousDuDossier } from "@/server/visio/liste-blanche-types";

export function enregistrementPropose(e: {
  /** Nom du type Calendly (le titre du rendez-vous). */
  readonly titre: string | null;
  /** Rencontre si elle existe, sinon `CalendlyEvent.id` : ce que l'extension retrouve. */
  readonly identifiant: string;
  readonly drapeau: ModeEnregistrement;
  /** OBLIGATOIRE : un rendez-vous de candidature n'est jamais proposé. */
  readonly linkedJobApplicationId: string | null;
}): string | null {
  if (e.drapeau === "ferme") return null;
  const ok = estRendezVousDuDossier({
    eventTypeName: e.titre,
    linkedJobApplicationId: e.linkedJobApplicationId,
  });
  return ok ? e.identifiant : null;
}
