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
// Réexportée pour ne rien casser chez les appelants existants — la règle vit
// désormais dans `@/lib/calendly/lien-valide`, partagée avec le recrutement.
// Voir le commentaire de tête de ce module partagé pour le pourquoi du départ.
export { estLienCalendlyValide } from "@/lib/calendly/lien-valide";

/**
 * Chemin public du document de présentation, servi depuis `public/imprimes/`.
 * Il figure aussi dans l'onglet Imprimés (`src/content/imprimes.ts`).
 * ⚠️ Ne pas renommer le fichier : ce chemin part dans des e-mails déjà envoyés.
 */
export const DOCUMENT_APPORTEUR_CHEMIN = "imprimes/devenir-apporteur-d-affaires-axion-ia.pdf";

/**
 * 🔴 JUR-T44 (Axion Partners) — le document de présentation est RETIRÉ du kit.
 *
 * Décision C1 de Williams du 2026-10-01 (option A) : le PDF porte des
 * formulations relevées par la vérification de bout en bout du chantier
 * Partners. On le retire tout de suite des e-mails et de la page de
 * remerciement, on le réécrit avec des formulations prudentes, et on ne le
 * remet qu'après cette réécriture (JUR-T45) — en repassant ce drapeau à `true`
 * et en rétablissant les textes qui l'annonçaient.
 *
 * Le fichier reste servi à son chemin : des e-mails déjà envoyés pointent
 * dessus. Témoin : `__tests__/kit-apporteur-sans-pdf.spec.ts`, sur le rendu
 * réel de chaque gabarit et de la page de remerciement.
 */
export const DOCUMENT_APPORTEUR_DIFFUSE: boolean = false;

/** Page publique du catalogue : feuilleter ou télécharger (`/[locale]/catalogue`). */
const CATALOGUE_SEGMENT = "catalogue";

export interface LiensKitApporteur {
  /** `null` tant que le document n'est pas diffusé (`DOCUMENT_APPORTEUR_DIFFUSE`). */
  documentUrl: string | null;
  catalogueUrl: string;
}

/** Les liens du kit, en URL absolues (un e-mail n'a pas d'origine). */
export function liensKitApporteur(
  locale: "fr" | "en" = "fr",
  origine = SITE_URL,
): LiensKitApporteur {
  const base = origine.replace(/\/+$/, "");
  return {
    documentUrl: DOCUMENT_APPORTEUR_DIFFUSE ? `${base}/${DOCUMENT_APPORTEUR_CHEMIN}` : null,
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
 * Durée pendant laquelle une entreprise présentée par un apporteur lui est
 * attribuée — décision de Will du 2026-09-22 : SIX mois (était douze).
 *
 * 🔴 Première constante de cette règle côté axionia : elle n'était écrite
 * nulle part dans le code. Les documents ont été alignés par la décision
 * explicite (#1247, reconfirmée le 2026-09-30) : `docs/contrat-apporteur-clauses.md`
 * §1.4 et `docs/fonctionnement-reseau-apporteurs.md` disent 6 mois ;
 * `docs/audit-attribution-apporteurs-siren.md`, audit daté, garde son
 * raisonnement à 12 mois sous un encart qui renvoie ici. Le parrainage
 * (10 %, 12 mois) est une autre règle.
 */
export const FENETRE_ATTRIBUTION_APPORTEUR_MOIS = 6;
