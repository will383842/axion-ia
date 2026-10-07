/**
 * Le lien d'un rendez-vous tel qu'on l'ÉCRIT dans un e-mail : celui de NOTRE site.
 *
 * ## Pourquoi ce module existe (2026-10-05)
 *
 * Jusqu'ici, les e-mails d'invitation envoyaient le visiteur sur la page Calendly
 * brute. Le parcours maison existe désormais pour les quatre rendez-vous
 * (`/fr/appel/<type>`, voir `server/calendly/types-reservables.ts`) : le lien
 * écrit dans un e-mail doit y mener.
 *
 * ## Où la traduction se fait : au RENDU, pas à la mise en file
 *
 * Les gabarits appellent `lienDeReservationDuSite(url)` au moment d'écrire le
 * bouton. Deux conséquences voulues :
 *
 *  · la charge utile en file garde l'adresse Calendly (`calendlyUrl`) — rien ne
 *    change pour la console, les validations (`estLienCalendlyValide`), les
 *    rappels qui relisent la variable, ni pour les tests qui les couvrent ;
 *  · un e-mail déjà en file, ou un rappel qui part demain, porte lui aussi le lien
 *    du site : la bascule est complète dès le déploiement.
 *
 * ## Aucune rupture
 *
 * Les invitations DÉJÀ envoyées portent l'adresse Calendly : elle continue de
 * fonctionner, Calendly n'a pas bougé. Et une adresse que ce module ne reconnaît
 * pas comme l'un des quatre types (un autre compte, un autre événement, un lien
 * saisi à la main dans la console) est rendue TELLE QUELLE.
 *
 * Module PUR : aucune dépendance Next, importable depuis le worker et les gabarits.
 */

import { SITE_URL } from "@/lib/site-url";
import {
  CHOIX_RENDEZ_VOUS,
  TYPES_RESERVABLES,
  urlConfigureeDuChoix,
  type ChoixRendezVous,
} from "@/server/calendly/types-reservables";
import { URL_CALENDLY_APPORTEUR_ANCIEN_DEFAUT } from "@/server/calendly/urls-par-defaut";

/** Origine + chemin, en minuscules et sans barre finale — la forme comparable d'une URL Calendly. */
function cheminCanonique(valeur: string): string | null {
  try {
    const u = new URL(valeur);
    return `${u.origin}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return null;
  }
}

/** Les UTM d'une URL Calendly : les seuls paramètres qui valent d'être gardés. */
const PARAMS_GARDES = ["utm_source", "utm_medium", "utm_campaign"] as const;

/**
 * Quel rendez-vous désigne cette adresse Calendly ? `null` si aucun des quatre.
 *
 * Compare au CHEMIN configuré de chaque type (variable d'environnement, sinon
 * défaut) — la même règle de comparaison que le classement des rendez-vous.
 * L'ancien défaut de l'échange apporteur (`…-affaires`) reste reconnu.
 */
export function choixDeLUrlCalendly(url: string): ChoixRendezVous | null {
  const chemin = cheminCanonique(url);
  if (!chemin) return null;
  for (const choix of CHOIX_RENDEZ_VOUS) {
    if (cheminCanonique(urlConfigureeDuChoix(choix)) === chemin) return choix;
  }
  if (cheminCanonique(URL_CALENDLY_APPORTEUR_ANCIEN_DEFAUT) === chemin) return "apporteur";
  return null;
}

/** L'adresse de NOTRE page pour ce rendez-vous : `https://…/fr/appel/<route>`. */
export function lienDuSite(
  choix: ChoixRendezVous,
  options: {
    readonly locale?: "fr" | "en";
    /** Emplacement du lien (`email-invitation-apporteur`) : mesuré en `utm_content`. */
    readonly depuis?: string;
    readonly origine?: string;
  } = {},
): string {
  const base = (options.origine ?? SITE_URL).replace(/\/+$/, "");
  const locale = options.locale ?? "fr";
  const params = new URLSearchParams();
  // Même nettoyage que `lireDepuis` : minuscules, chiffres, tirets — rien d'autre.
  if (options.depuis && /^[a-z0-9][a-z0-9-]{0,59}$/.test(options.depuis)) {
    params.set("depuis", options.depuis);
  }
  const requete = params.toString();
  return `${base}/${locale}/appel/${TYPES_RESERVABLES[choix].route}${requete ? `?${requete}` : ""}`;
}

/**
 * Le lien à écrire dans un e-mail : la page de NOTRE site si l'adresse est celle de
 * l'un des quatre rendez-vous, l'adresse reçue sinon.
 */
export function lienDeReservationDuSite(
  url: string,
  options: {
    readonly locale?: "fr" | "en";
    readonly depuis?: string;
    readonly origine?: string;
  } = {},
): string {
  const choix = choixDeLUrlCalendly(url);
  if (!choix) return url;
  const lien = lienDuSite(choix, options);
  // Les UTM éventuelles de l'adresse d'origine suivent : l'attribution ne se perd pas.
  try {
    const source = new URL(url);
    const cible = new URL(lien);
    for (const cle of PARAMS_GARDES) {
      const v = source.searchParams.get(cle);
      if (v) cible.searchParams.set(cle, v.slice(0, 200));
    }
    return cible.toString();
  } catch {
    return lien;
  }
}
