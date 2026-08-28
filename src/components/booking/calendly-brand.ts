/**
 * Les couleurs envoyées à Calendly — DÉRIVÉES, jamais recopiées.
 *
 * ## Le défaut que ce module ferme
 *
 * Trois oranges circulaient dans le dépôt le 2026-08-28 :
 *
 * ```
 * globals.css  --color-terracotta   #b23f16   ← ce que le visiteur voit
 * CLAUDE-GLOBAL.md                  #c24a1b   ← référence de charte, périmée
 * CalendlyInlineWidget              #c2410c   ← ni l'un ni l'autre
 * ```
 *
 * Le `#c2410c` envoyé à Calendly ne correspondait à AUCUNE couleur du site. La
 * cause n'est pas une faute de frappe : c'est que la valeur avait été
 * **recopiée**. Le 2026-07-26, un audit d'accessibilité a fait passer le
 * terracotta de `#c24a1b` à `#b23f16` (contraste AA : 4,42 → 5,24) ; les jetons
 * ont suivi, la constante recopiée non — et rien ne pouvait le signaler.
 *
 * 🔑 D'où ce module : une seule dérivation, depuis le miroir de `globals.css`
 * que `brand-tokens.parity.spec.ts` garde déjà. Changer la charte dans
 * `globals.css` + son miroir suffit désormais à changer Calendly.
 *
 * ⚠️ L'import vient de `@/server/qualiopi/brand/brand-tokens` malgré son nom :
 * c'est l'UNIQUE miroir de `globals.css` sous test de parité dans ce dépôt, et
 * il ne porte aucun `server-only`. Créer un second miroir « pour le public »
 * recréerait exactement le problème qu'on vient de fermer.
 *
 * ## Ces paramètres marchent AUSSI hors iframe — c'est mesuré
 *
 * Vérifié le 2026-08-28 sur `calendly.com/axion-ia/premier-contact` : sans
 * paramètre, `b23f16` apparaît **0 fois** dans le HTML servi ; avec, **2 fois**.
 * Ils teintent donc aussi la page autonome vers laquelle pointent les liens de
 * `CalendlySlotPicker`.
 *
 * ⚠️ Ne PAS généraliser ce constat aux autres paramètres : `?locale=fr` est,
 * lui, **ignoré** sur les pages autonomes (mesuré le 2026-07-09). La langue se
 * règle dans le tableau de bord Calendly, la couleur par l'URL.
 */

import { QUALIOPI_BRAND_COLORS } from "@/server/qualiopi/brand/brand-tokens";

/** Calendly veut ses couleurs SANS le croisillon. */
const sansCroisillon = (hex: string): string => hex.replace(/^#/, "");

export const CALENDLY_BRAND = {
  /** L'accent éditorial du site — boutons et créneau sélectionné chez Calendly. */
  primary: sansCroisillon(QUALIOPI_BRAND_COLORS.terracotta),
  /** Le texte principal du site. */
  text: sansCroisillon(QUALIOPI_BRAND_COLORS.fg),
  /** L'ivoire chaud du site, pour que la bascule ne change pas de fond. */
  background: sansCroisillon(QUALIOPI_BRAND_COLORS.bg),
} as const;

/**
 * Ajoute les trois paramètres de couleur à une URL Calendly.
 *
 * Sert aux DEUX chemins — l'iframe de `CalendlyInlineWidget` et les liens
 * sortants de `CalendlySlotPicker`. Une seule fonction, donc un seul endroit où
 * la charte s'applique.
 *
 * Ne touche à rien d'autre : les paramètres déjà présents sur l'URL d'entrée
 * (`hide_event_type_details`, `hide_gdpr_banner`…) sont préservés.
 */
export function avecCouleursAxion(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("primary_color", CALENDLY_BRAND.primary);
    u.searchParams.set("text_color", CALENDLY_BRAND.text);
    u.searchParams.set("background_color", CALENDLY_BRAND.background);
    return u.toString();
  } catch {
    // Une URL invalide ne doit pas casser le rendu du sélecteur : mieux vaut un
    // lien non teinté qu'une page de créneaux qui ne s'affiche pas.
    return url;
  }
}
