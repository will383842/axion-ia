/**
 * Référent handicap — contact PUBLIC (fiches formation, page accessibilité).
 *
 * 🔴 Audit site public 2026-09-30 (indicateur 26 du Référentiel national
 * qualité). Les 22 fiches formation et `/accessibilite` écrivaient « un
 * référent handicap est désigné » sans le nommer ni dire comment le joindre.
 * L'indicateur demande un référent IDENTIFIÉ et JOIGNABLE : une promesse sans
 * contact ne le prouve pas.
 *
 * UNE seule source : la configuration Qualiopi (`referent_handicap_nom`,
 * `referent_handicap_email`), la même que lisent les PDF (`organisme.ts`,
 * `exports-pdf.ts`) et le moteur de conformité. Aucun nom ni aucune adresse
 * n'est recopié en dur dans une page.
 *
 * Même prédicat que `evaluerConformite` et l'alerte R01 (cf.
 * `conformite/referent-handicap-un-seul-predicat.spec.ts`) : le NOM a une valeur
 * par défaut au registre, il ne prouve donc rien seul. Tant que l'E-MAIL n'est
 * pas saisi, on n'affiche PAS le nom par défaut — on affiche le repli générique.
 *
 * Build `stub.invalid` (ADR 0026) : `getQualiopiConfig` rend les défauts du
 * registre (e-mail vide) → repli. Les pages sont en ISR (`revalidate`), elles se
 * repeuplent avec la vraie configuration au runtime.
 *
 * Aucun numéro de téléphone n'est exposé ici (règle interne : aucun numéro
 * public), même si la configuration en porte un pour les pièces PDF.
 */

import { cache } from "react";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";

export interface ReferentHandicapPublic {
  /** Nom de la personne désignée, ou `""` tant que la désignation n'est pas prouvée. */
  readonly nom: string;
  /** Adresse à laquelle écrire — jamais vide (repli générique). */
  readonly email: string;
}

/**
 * Repli quand la configuration n'est pas lisible (build stub) ou pas renseignée.
 * Adresse générique dédiée : elle doit exister et être relevée par le référent.
 */
export const REFERENT_HANDICAP_REPLI: ReferentHandicapPublic = {
  nom: "",
  email: "handicap@axion-ia.com",
};

/** Implémentation non mémoïsée (tests). En production : `getReferentHandicapPublic`. */
export async function computeReferentHandicapPublic(): Promise<ReferentHandicapPublic> {
  const [nom, email] = await Promise.all([
    getQualiopiConfig("referent_handicap_nom").catch(() => ""),
    getQualiopiConfig("referent_handicap_email").catch(() => ""),
  ]);
  const emailPropre = typeof email === "string" ? email.trim() : "";
  // Nommé ET joignable, ou rien : le nom seul est le défaut du registre.
  if (emailPropre === "") return REFERENT_HANDICAP_REPLI;
  return { nom: typeof nom === "string" ? nom.trim() : "", email: emailPropre };
}

/** Version mémoïsée par rendu. */
export const getReferentHandicapPublic = cache(computeReferentHandicapPublic);
