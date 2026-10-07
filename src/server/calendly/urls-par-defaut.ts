// Les adresses Calendly par défaut des quatre rendez-vous — module FEUILLE.
//
// Aucun import : la table des types (`types-reservables.ts`) et l'aide des liens
// d'e-mail (`@/lib/calendly/lien-du-site.ts`) les lisent, et ni l'une ni l'autre ne
// doit tirer `availability.ts` (via `type-rendez-vous.ts`) dans le graphe d'un
// gabarit d'e-mail ou d'un cycle d'import.
//
// Les défauts sont les URL réelles du compte : le worker ne reçoit pas les
// variables `NEXT_PUBLIC_*` (inlinées au build de l'application), et un
// classement fiable ne doit pas dépendre d'une variable oubliée.

/** Type « Discutons de votre projet IA » (devenu « Échange projet »). */
export const URL_CALENDLY_APPEL_PAR_DEFAUT = "https://calendly.com/axion-ia/premier-contact";
/** Type « Diagnostic IA ». */
export const URL_CALENDLY_DIAGNOSTIC_PAR_DEFAUT = "https://calendly.com/axion-ia/diagnostic-ia";
/**
 * Type « Échange apporteur d'affaires » (15 min, Google Meet). Slug donné par
 * Will le 2026-10-05 (`echange-apporteur`) ; en production la variable
 * `CALENDLY_APPORTEUR_URL` le porte déjà et l'emporte sur ce défaut.
 */
export const URL_CALENDLY_APPORTEUR_PAR_DEFAUT = "https://calendly.com/axion-ia/echange-apporteur";
/**
 * L'ANCIEN défaut (`echange-apporteur-affaires`), jamais confirmé chez Calendly.
 * Gardé UNIQUEMENT pour le classement (`urlsDeReservationConfigurees`) : si une
 * ligne ou une variable l'a retenu, elle reste classée « apporteur ».
 */
export const URL_CALENDLY_APPORTEUR_ANCIEN_DEFAUT =
  "https://calendly.com/axion-ia/echange-apporteur-affaires";
/** Type « Rencontre au salon GOFAB — 13 octobre » (20 min, sur place). */
export const URL_CALENDLY_SALON_PAR_DEFAUT = "https://calendly.com/axion-ia/rencontre-salon-gofab";
