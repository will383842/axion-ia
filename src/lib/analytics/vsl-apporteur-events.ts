/**
 * Événements de mesure de la page VSL apporteurs (plan 01 §3.2, lot 3).
 *
 * ── Pourquoi une liste LOCALE ──────────────────────────────────────────────
 * Les listes fermées du site (`FunnelEvent` dans `src/lib/tracking.ts`,
 * `FUNNEL_EVENT_NAMES` dans `funnel-event-schema.ts`) appartiennent au lot 1 «
 * mesure d'abord » (autre développeur). Tant qu'il n'a pas posé ses noms, la
 * page émet ses nouveaux événements par Plausible SEULEMENT, via cette
 * fonction ; quand le lot 1 est fusionné, on remplace `trackVsl` par
 * `trackFunnel` et ce fichier disparaît (les noms ci-dessous sont ceux du plan,
 * pour que ce remplacement soit mécanique).
 *
 * Les événements DÉJÀ déclarés (`Landing Viewed`, `Landing Video Played`,
 * `Landing CTA Clicked`, `Lead Apporteur Submitted`) passent, eux, par
 * `trackFunnel`.
 *
 * Doctrine : AUCUNE donnée personnelle dans les propriétés (ni e-mail, ni prénom,
 * ni téléphone, ni identifiant de fiche) — des étapes, des quarts de vidéo.
 */

import { trackEvent } from "@/lib/analytics/plausible-tracker";

export type VslEvent =
  /** Lecture de la vidéo : 25 / 50 / 75 / 95 % (propriété `step` = `p25`…`p95`). */
  | "Video Progress"
  /** Une étape du formulaire s'affiche (`step` = 1 ou 2, `stepIndex`, `stepTotal`). */
  | "Lead Step Viewed"
  /** L'étape 1 est enregistrée (l'e-mail est capté). */
  | "Lead Email Captured"
  /** La page de remerciement (le choix du créneau) est affichée. */
  | "Call Booking Viewed";

export interface VslProps {
  landing: string;
  step?: string;
  stepIndex?: number;
  stepTotal?: number;
}

export function trackVsl(event: VslEvent, props: VslProps): void {
  const propres: Record<string, string | number> = {};
  for (const [cle, valeur] of Object.entries(props)) {
    if (typeof valeur === "string" && valeur !== "") propres[cle] = valeur;
    else if (typeof valeur === "number") propres[cle] = valeur;
  }
  trackEvent(event, { props: propres });
}
