/**
 * LE GUIDE IA ENTREPRISE — source unique de son chemin public.
 *
 * POURQUOI CE FICHIER (2026-09-23)
 *
 * La page `/guide-ia` promettait depuis des mois un « Guide IA entreprise ·
 * 40 pages » et un « téléchargement immédiat après inscription ». Aucun PDF
 * n'existait : le formulaire n'envoyait que l'e-mail de double opt-in, et la page
 * de confirmation ne parlait d'aucun guide. La promesse n'était tenue nulle part.
 *
 * Le guide existe désormais. Il est servi depuis `public/imprimes/` et lié à
 * quatre endroits, qui lisent tous ce chemin — le recopier ferait quatre chemins
 * dont un finira par viser un fichier renommé :
 *   · le lien personnel de l'e-mail « Votre guide » (lot L2, 2026-09-24) :
 *     `/api/guide-ia/telecharger`, qui redirige ici après le clic ;
 *   · la page de confirmation de la lettre (`/confirmation/newsletter`) ;
 *   · l'e-mail de confirmation d'un appel de découverte (`appel-rappel.tsx`) ;
 *   · l'onglet Imprimés de la console (`content/imprimes.ts`), qui mesure le
 *     fichier sur le disque et signale son absence.
 *
 * ⚠️ NE PAS RENOMMER LE FICHIER : son URL part dans des e-mails déjà envoyés.
 * Une nouvelle édition remplace le fichier sous le MÊME nom.
 *
 * 🔴 Ce module n'est PAS `"use server"` : il est importé par un gabarit d'e-mail
 * (rendu dans le worker) et par des pages.
 */

import { SITE_URL } from "@/lib/site-url";

/** Chemin sous `public/`, sans slash initial — même convention que les imprimés. */
export const GUIDE_IA_CHEMIN = "imprimes/guide-ia-entreprise-2026-axion-ia.pdf";

/**
 * Nombre de pages du PDF servi, LU dans le fichier (pypdf, 2026-09-23), pas
 * supposé. La page publique l'affiche : `__tests__/le-guide-promis-existe.spec.ts` recompte le PDF et
 * rougit si une nouvelle édition change la pagination sans que le texte suive.
 */
export const GUIDE_IA_PAGES = 40;

/** URL absolue du PDF — un e-mail n'a pas d'origine. */
export function urlGuideIa(origine: string = SITE_URL): string {
  return `${origine.replace(/\/+$/, "")}/${GUIDE_IA_CHEMIN}`;
}
