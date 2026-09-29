/**
 * Ouverture du circuit visio : le préavis aux clients actifs, contrôlé par le
 * CODE (chantier visio, PR 8 ; LOTS-EXECUTION §5 PR 8, §8 point 5 ; B3).
 *
 * ## La règle
 *
 * Le mode demandé (`ferme | pilote | ouvert`) se lit à l'exécution dans les
 * variables `ENREGISTREMENT_VISIO_PILOTE` et `ENREGISTREMENT_VISIO_OUVERT`
 * (module `drapeau.ts` de la PR 5). Ce module-ci décide seulement de ce que
 * vaut `ouvert` : il n'est EFFECTIF que si aujourd'hui ≥ `PREAVIS.finLe`, date
 * d'envoi réel du préavis + 30 jours. Avant, `ouvert` vaut `pilote` (seule une
 * rencontre du client fictif est enregistrable) et une alerte « préavis non
 * échu » est levée — on ne le découvre pas en regardant un appel qui n'a pas
 * été enregistré.
 *
 * Un préavis NON ENVOYÉ (`PREAVIS_SOUS_TRAITANTS = null`) n'échoit jamais :
 * `ouvert` reste `pilote` tant qu'une PR n'a pas posé la date réelle, relevée
 * dans `email_outbox` et écrite dans `07-execution/PREAVIS.md`. Poser une date
 * se fait par une PR relue, jamais par une variable d'environnement : c'est
 * une promesse faite aux clients (« au moins 30 jours avant la prise
 * d'effet », politique de confidentialité), pas un réglage.
 *
 * ## Pourquoi un module à part de `drapeau.ts`
 *
 * `drapeau.ts` est écrit par la PR 5 (lecture des variables, battement du
 * worker). Cette PR-ci ne dépend que du schéma déjà en production : elle pose
 * la règle du préavis en fonction PURE, que `drapeau.ts` appelle au rebase
 * (ordre de fusion 3 → 8). Aucune duplication : la PR 5 ne recode pas le
 * calcul de date, elle le lit ici.
 *
 * Module PUR : aucun import d'exécution (lu par le site, le worker et la CI).
 */

/** Durée du préavis promis aux clients actifs (politique de confidentialité). */
export const DUREE_PREAVIS_JOURS = 30;

export type ModeCircuitVisio = "ferme" | "pilote" | "ouvert";

export interface PreavisSousTraitants {
  /** Date d'envoi RÉEL du préavis (relevée dans `email_outbox`), ISO `AAAA-MM-JJ`. */
  readonly envoyeLe: string;
  /** Fin du préavis : `envoyeLe` + 30 jours, ISO `AAAA-MM-JJ`. */
  readonly finLe: string;
}

/**
 * Le préavis RÉELLEMENT envoyé. `null` : il n'est pas encore parti (le 29/09,
 * l'e-mail attend la validation de Will dans la file ; `07-execution/PREAVIS.md`
 * n'est pas rempli). Le jour où il part : une PR d'une ligne, par exemple
 * `{ envoyeLe: "2026-09-30", finLe: "2026-10-30" }`.
 */
// `as` : sans lui, TypeScript réduirait le type à `null` et refuserait de
// compiler toute lecture de la date le jour où elle sera posée.
export const PREAVIS_SOUS_TRAITANTS = null as PreavisSousTraitants | null;

/** `envoyeLe` + 30 jours, au jour près (UTC). */
export function finDuPreavis(envoyeLe: string): string {
  const d = new Date(`${envoyeLe}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`date de préavis illisible : « ${envoyeLe} »`);
  d.setUTCDate(d.getUTCDate() + DUREE_PREAVIS_JOURS);
  return d.toISOString().slice(0, 10);
}

/**
 * Un préavis est cohérent si sa fin est EXACTEMENT l'envoi + 30 jours. Une fin
 * avancée à la main (« finLe: aujourd'hui ») raccourcirait une promesse
 * publique : refusée ici, et par la garde
 * `le-drapeau-ouvert-attend-la-fin-du-preavis.spec.ts`.
 */
export function preavisCoherent(p: PreavisSousTraitants): boolean {
  return finDuPreavis(p.envoyeLe) === p.finLe;
}

export interface ModeEffectif {
  readonly mode: ModeCircuitVisio;
  /** Alerte à lever (`AlerteVisio`, catégorie `preavis`), ou `null`. */
  readonly alerte: "preavis_non_echu" | "preavis_incoherent" | null;
}

/**
 * Ce que vaut réellement le mode demandé, compte tenu du préavis.
 *
 * - `ferme` et `pilote` passent tels quels (le pilote n'enregistre que le
 *   client fictif : il ne touche aucun client et n'attend pas le préavis) ;
 * - `ouvert` n'est effectif que si le préavis est parti, cohérent, et échu
 *   (`maintenant` ≥ `finLe` à 00:00 UTC) ; sinon `pilote` + alerte.
 */
export function modeEffectif(
  demande: ModeCircuitVisio,
  maintenant: Date,
  preavis: PreavisSousTraitants | null = PREAVIS_SOUS_TRAITANTS,
): ModeEffectif {
  if (demande !== "ouvert") return { mode: demande, alerte: null };
  if (preavis === null) return { mode: "pilote", alerte: "preavis_non_echu" };
  if (!preavisCoherent(preavis)) return { mode: "pilote", alerte: "preavis_incoherent" };
  const fin = new Date(`${preavis.finLe}T00:00:00.000Z`).getTime();
  if (maintenant.getTime() < fin) return { mode: "pilote", alerte: "preavis_non_echu" };
  return { mode: "ouvert", alerte: null };
}
