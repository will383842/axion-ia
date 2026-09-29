/**
 * G3 — QUI PARLE COMPTE (`compte-rendu-et-extraction.md` §2.3, §4.2).
 *
 * La piste RÉELLE du premier segment de la preuve (client / axion) décide,
 * pas le `locuteur_declare` de l'IA — et une divergence entre les deux est un
 * rejet. Pour chaque type (`TYPES_DE_FAITS[type].locuteurs`) :
 *
 *   · `client` : une phrase de la piste client suffit ;
 *   · Williams `oui` : sa phrase suffit (ses engagements, ses prix) ;
 *   · Williams `avec_confirmation` : sa phrase ET une confirmation VÉRIFIÉE
 *     (G1, G2) sur la piste client, qui commence au plus 90 s après la fin de
 *     sa phrase (« donc vous êtes douze ? » / « oui, douze ») ;
 *   · Williams `jamais` : rejet, confirmation ou pas. Un budget, un décideur,
 *     un problème ou un besoin doivent être dits PAR LE CLIENT : un « oui » à
 *     « votre budget est de 5 000 € ? » est trop faible pour un devis.
 *
 * Module PUR.
 */

import type { FaitType } from "../../../../prisma/generated/client";
import { TYPES_DE_FAITS } from "../types-de-faits";
import type { VerdictPreuve } from "./g01-citation";

export const DELAI_CONFIRMATION_MS = 90_000;

export type VerdictLocuteur =
  | { readonly ok: true; readonly certitude: "dit_explicitement" | "confirme_sur_reformulation" }
  | { readonly ok: false };

export function verifierLocuteur(a: {
  readonly type: FaitType;
  readonly locuteurDeclare: "client" | "axion";
  readonly preuve: Extract<VerdictPreuve, { ok: true }>;
  /** Confirmation déjà vérifiée par G1/G2, ou `null`. */
  readonly confirmation: VerdictPreuve | null;
}): VerdictLocuteur {
  const regles = TYPES_DE_FAITS[a.type].locuteurs;
  if (a.preuve.piste !== a.locuteurDeclare) return { ok: false };
  if (a.preuve.piste === "client") {
    return regles.client ? { ok: true, certitude: "dit_explicitement" } : { ok: false };
  }
  // Piste de Williams.
  if (regles.axion === "oui") return { ok: true, certitude: "dit_explicitement" };
  if (regles.axion === "jamais") return { ok: false };
  const c = a.confirmation;
  if (c === null || !c.ok || c.piste !== "client") return { ok: false };
  const ecart = c.debutMs - a.preuve.finMs;
  if (ecart < 0 || ecart > DELAI_CONFIRMATION_MS) return { ok: false };
  return { ok: true, certitude: "confirme_sur_reformulation" };
}
