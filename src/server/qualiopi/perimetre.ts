/**
 * Périmètre Qualiopi — LA table de vérité (refonte console phase 3, 2026-08-01,
 * cf. `_PLANS/PLAN-REFONTE-CONSOLE-2026-08.md`).
 *
 * ## Pourquoi ce module
 *
 * Verdict de Will : « il n'y a pas de distinction claire entre ce qui doit
 * faire partie de Qualiopi ou pas (formation, AFEST, 1-to-1, implémentations,
 * site web, etc.) ». La certification Qualiopi ne couvre que les actions
 * concourant au développement des compétences (art. L.6313-1 du Code du
 * travail) ; les prestations de conseil et de technique pure (audit IA,
 * implémentation, sites web) sont HORS périmètre — elles ne passent ni par le
 * BPF « actions de formation », ni par les indicateurs du référentiel, ni par
 * l'audit de surveillance.
 *
 * ## Contrat
 *
 * - UNE SEULE table (`PERIMETRE_QUALIOPI` ci-dessous). Toute la console dérive
 *   de là : badge de la vue Dossiers, filtres, et demain le BPF ou les
 *   exports. Si Will change d'avis sur une activité (ex. : un audit devient
 *   un « bilan de compétences » certifiable), on change UNE ligne ICI et tout
 *   suit.
 * - C'est un choix MÉTIER, pas technique : ce fichier est le bon endroit pour
 *   le discuter, pas les pages qui le consomment.
 * - Les clés sont ALIGNÉES sur l'enum Prisma `ActiviteFacturation`
 *   (`prisma/schema.prisma`) — la seule taxonomie d'activité stockée en base
 *   (portée par `Devis.activite` et `FactureFormation.activite`). Pas de
 *   deuxième vocabulaire à maintenir.
 * - Défaut : une activité inconnue (ou absente — `Devis.activite` est
 *   nullable) est HORS périmètre. On ne classe JAMAIS Qualiopi par accident :
 *   afficher « Qualiopi » sur une prestation non couverte, c'est un engagement
 *   d'audit qu'on ne tient pas ; l'inverse n'est qu'un badge trop prudent.
 */

import type { ActiviteFacturation } from "../../../prisma/generated/client";

/** Alias local — le type vit dans Prisma, le SENS vit ici. */
export type ActivitePerimetre = ActiviteFacturation;

/**
 * 🔴 LA table de vérité. Une activité, un booléen, un POURQUOI.
 *
 * | Activité         | Qualiopi | Justification                                                        |
 * | ---------------- | -------- | -------------------------------------------------------------------- |
 * | `formation`      | ✅       | Action de formation collective — L.6313-1 1° (le cœur du certificat) |
 * | `un_a_un`        | ✅       | Coaching 1-to-1 / AFEST — action de formation en situation de        |
 * |                  |          | travail, D.6313-3-1 (modalité de L.6313-2, donc couverte)            |
 * | `audit`          | ❌       | Diagnostic / prestation de CONSEIL — pas une action de développement |
 * |                  |          | des compétences au sens L.6313-1                                     |
 * | `implementation` | ❌       | Projet technique (intégration IA) — prestation de service            |
 * | `site_web`       | ❌       | Développement web / SaaS — prestation de service                     |
 */
const PERIMETRE_QUALIOPI: Record<ActivitePerimetre, boolean> = {
  formation: true,
  un_a_un: true,
  audit: false,
  implementation: false,
  site_web: false,
};

/**
 * L'activité est-elle couverte par la certification Qualiopi ?
 *
 * PURE, et volontairement laxiste sur l'ENTRÉE (`string | null | undefined`) :
 * les appelants tiennent l'activité de sources hétérogènes (enum Prisma,
 * valeur dérivée, champ nullable). Tout ce qui n'est pas une clé CONNUE de la
 * table retombe sur `false` — cf. l'en-tête : jamais Qualiopi par accident.
 */
export function estDansPerimetreQualiopi(activite: string | null | undefined): boolean {
  if (!activite) return false;
  // `Object.hasOwn` et pas l'opérateur `in` : `"constructor" in objet` est
  // vrai via la chaîne de prototypes et l'accès indexé renverrait une
  // FONCTION (truthy) — soit exactement le « Qualiopi par accident » que ce
  // module existe pour interdire. Une faute de frappe (« formations ») donne
  // false, pas un undefined interprété au petit bonheur.
  if (Object.hasOwn(PERIMETRE_QUALIOPI, activite)) {
    return PERIMETRE_QUALIOPI[activite as ActivitePerimetre];
  }
  return false;
}

/**
 * Les deux faces du badge — consommées telles quelles par les vues.
 *
 * 🔴 Ces libellés ont porté « ✅ » et « ⚙️ » jusqu'au 2026-08-03. Ils
 * s'affichaient sur chaque ligne ET sur les deux filtres de la page Dossiers,
 * en contradiction avec la convention lucide de la console, sans qu'aucun test
 * ne s'en aperçoive : le cliquet anti-emoji ne scanne pas `src/server`.
 *
 * Le badge porte déjà sa couleur et sa bordure : il se distingue sans glyphe.
 * Le cliquet couvre désormais ce fichier nommément.
 */
export const PERIMETRE_LABELS = {
  qualiopi: "Qualiopi",
  hors: "Hors périmètre",
} as const;

/** Libellé du badge d'une ligne, à partir du booléen dérivé. */
export function libellerPerimetre(qualiopi: boolean): string {
  return qualiopi ? PERIMETRE_LABELS.qualiopi : PERIMETRE_LABELS.hors;
}
