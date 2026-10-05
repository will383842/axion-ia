// Les LIEUX d'un type d'événement Calendly, lus dans sa réponse d'API.
//
// Module FEUILLE (aucun import à l'exécution) : `availability.ts` le lit, et il ne
// doit surtout pas dépendre de `types-reservables.ts` — qui lit, lui, les adresses
// par défaut de `type-rendez-vous.ts`, lequel importe `availability.ts`. Ce
// triangle ferait échouer l'initialisation selon le module qui charge en premier.

import type { FormatDemande } from "@/server/calendly/reservation";

/** Les types de lieu Calendly qui valent une visioconférence (miroir de `canal.ts`). */
const LIEUX_VISIO = new Set([
  "google_conference",
  "zoom_conference",
  "microsoft_teams_conference",
  "gotomeeting_conference",
  "webex_conference",
  "custom",
]);
const LIEUX_TELEPHONE = new Set(["outbound_call", "inbound_call"]);
const LIEUX_SUR_PLACE = new Set(["physical"]);

/** Ce que l'on sait des lieux d'un événement : ses formats, et l'adresse s'il est sur place. */
export interface LieuxDeLEvenement {
  readonly formats: readonly FormatDemande[];
  /** L'adresse du lieu `physical`, quand Calendly la donne. */
  readonly adresse?: string;
}

/**
 * Lit le champ `locations` d'un type d'événement Calendly.
 *
 * `null` quand le champ est ABSENT ou illisible : on ne sait rien, et surtout on
 * n'invente rien — l'appelant retombe sur les formats candidats de la table
 * (`formatsProposes`). ⚠️ Ce champ n'a PAS pu être mesuré contre le compte réel
 * (pas de jeton dans l'environnement de développement) : la lecture est
 * volontairement défensive. Un lieu d'un type inconnu est ignoré, jamais deviné.
 */
export function lieuxDeLEvenement(locations: unknown): LieuxDeLEvenement | null {
  if (!Array.isArray(locations) || locations.length === 0) return null;
  const formats = new Set<FormatDemande>();
  let adresse: string | undefined;
  for (const brut of locations) {
    if (typeof brut !== "object" || brut === null) continue;
    const lieu = brut as Record<string, unknown>;
    const kind = typeof lieu["kind"] === "string" ? lieu["kind"] : "";
    if (LIEUX_VISIO.has(kind)) formats.add("visio");
    else if (LIEUX_TELEPHONE.has(kind)) formats.add("telephone");
    else if (LIEUX_SUR_PLACE.has(kind)) {
      formats.add("sur_place");
      const a = lieu["location"];
      if (!adresse && typeof a === "string" && a.trim() !== "") adresse = a.trim().slice(0, 300);
    }
  }
  if (formats.size === 0) return null;
  return { formats: [...formats], ...(adresse ? { adresse } : {}) };
}
