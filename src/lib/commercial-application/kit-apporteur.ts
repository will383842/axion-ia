// LE KIT APPORTEUR — ce que reçoit toute personne qui s'intéresse au réseau
// d'apporteurs d'affaires, dès qu'on a son adresse (décision Will 2026-09-19).
//
// Deux documents, toujours les mêmes, toujours ensemble :
//   · le document de présentation « Devenir apporteur d'affaires » (13 pages) —
//     statut d'indépendant, commissions, fonctionnement, prestations ;
//   · le catalogue complet des prestations (formations, audit IA,
//     accompagnement 1-to-1, implémentation) — pour savoir ce qu'on recommande.
//
// Ils partent en LIENS, jamais en pièces jointes : une pièce jointe de 10 Mo
// pousse l'e-mail vers les indésirables, et un lien suit la dernière version du
// document sans rien renvoyer.
//
// L'APPEL, lui, ne part PAS automatiquement. Le lien Calendly « échange de
// 15 minutes » n'est envoyé qu'aux personnes que Will choisit, depuis la console
// (`invitation-actions.ts`) : un lien distribué à tous saturerait son agenda.
//
// 🔴 Ce module n'est PAS `"use server"` : il est importé par les gabarits
// d'e-mail (rendus dans le worker) et par la console.

import { SITE_URL } from "@/lib/site-url";

/**
 * Chemin public du document de présentation, servi depuis `public/imprimes/`.
 * Il figure aussi dans l'onglet Imprimés (`src/content/imprimes.ts`).
 * ⚠️ Ne pas renommer le fichier : ce chemin part dans des e-mails déjà envoyés.
 */
export const DOCUMENT_APPORTEUR_CHEMIN = "imprimes/devenir-apporteur-d-affaires-axion-ia.pdf";

/** Page publique du catalogue : feuilleter ou télécharger (`/[locale]/catalogue`). */
const CATALOGUE_SEGMENT = "catalogue";

export interface LiensKitApporteur {
  documentUrl: string;
  catalogueUrl: string;
}

/** Les deux liens du kit, en URL absolues (un e-mail n'a pas d'origine). */
export function liensKitApporteur(
  locale: "fr" | "en" = "fr",
  origine = SITE_URL,
): LiensKitApporteur {
  const base = origine.replace(/\/+$/, "");
  return {
    documentUrl: `${base}/${DOCUMENT_APPORTEUR_CHEMIN}`,
    catalogueUrl: `${base}/${locale}/${CATALOGUE_SEGMENT}`,
  };
}

/**
 * Variante de `lead-apporteur-recu` envoyée à la personne qui a commencé le
 * dossier sans le finir. Constante ICI (et non dans le gabarit) : l'action qui
 * pose le job n'a pas à importer un composant React d'e-mail pour une chaîne.
 */
export const VARIANTE_DOSSIER_COMMENCE = "dossier-commence";

/** Durée de l'échange proposé sur invitation. */
export const DUREE_ECHANGE_APPORTEUR_MINUTES = 15;

/**
 * Délai avant d'envoyer le kit à quelqu'un qui a COMMENCÉ le dossier (écran 1)
 * sans le finir.
 *
 * Pas immédiat, délibérément : lui écrire pendant qu'il remplit lui dirait
 * qu'il peut s'arrêter là. Le dossier prend trois minutes ; au bout d'une
 * demi-heure, celui qui l'a fini a reçu la confirmation (qui porte le kit, et
 * qui annule cet envoi), et celui qui l'a quitté reçoit le kit.
 */
export const DELAI_KIT_DOSSIER_COMMENCE_MS = 30 * 60 * 1000;

/**
 * Un lien Calendly acceptable pour l'invitation : https, sur calendly.com.
 * Refuser tout le reste empêche qu'une faute de frappe — ou un lien collé
 * depuis ailleurs — parte dans un e-mail signé Axion-IA.
 */
export function estLienCalendlyValide(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      (u.hostname === "calendly.com" || u.hostname.endsWith(".calendly.com")) &&
      u.pathname.length > 1
    );
  } catch {
    return false;
  }
}
