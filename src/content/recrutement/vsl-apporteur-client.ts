// Textes de la page VSL apporteurs LUS PAR LE NAVIGATEUR (île du formulaire, page
// de merci). Fichier volontairement PETIT : le contenu de la page (héro, FAQ…)
// vit dans `vsl-apporteur.ts`, côté serveur seulement. Tout import d'un module
// de contenu entier dans une île ferait entrer ses textes dans les chunks de
// page (cliquet de poids, AGENTS.md).

import { VSL_CONSENT_TEXTE, VSL_MERCI_PATH } from "@/lib/commercial-application/vsl-apporteur";

export { VSL_REPONSES } from "@/lib/commercial-application/vsl-apporteur";
export { VSL_MERCI_PATH };

/** Dimension d'analyse de la page (propriété `landing` des événements). */
export const VSL_SLUG = "vsl-apporteur-v1";

/**
 * Ancre du formulaire — tous les boutons de la page y mènent. 🔴 Identifiant
 * TECHNIQUE d'URL, jamais lu par le visiteur : il reste `candidater` pour ne
 * casser aucun lien déjà publié (annonces, e-mails de reprise).
 */
export const VSL_ANCRE = "candidater";

export const VSL_FORMULAIRE = {
  titre: "Devenir apporteur en 2 minutes",
  etape1: {
    eyebrow: "Étape 1 sur 2",
    titre: "Parlons de vous",
    micro: "20 secondes.",
    prenom: "Prénom",
    prenomAide: "Pour vous écrire correctement.",
    email: "E-mail",
    emailAide: "Pour vous envoyer la confirmation.",
    bouton: "Continuer",
    // Texte versionné, porté par la capture (v5) : `VSL_CONSENT_TEXTE`.
    consent: VSL_CONSENT_TEXTE,
    legal: "Vos données sont utilisées pour traiter votre demande.",
    legalLien: "Politique de confidentialité",
  },
  etape2: {
    eyebrow: "Étape 2 sur 2",
    titre: "Dernière étape",
    telephone: "Téléphone",
    telephoneAide:
      "Pour vous joindre au sujet de votre rendez-vous. Nous ne l'affichons jamais publiquement.",
    question: "Combien de dirigeants connaissez-vous à peu près ?",
    bouton: "Envoyer et choisir mon créneau",
    micro: "Un échange de 15 minutes. Aucun engagement.",
    retour: "Modifier mes réponses précédentes",
  },
  annonceEtape: (n: number) => `Étape ${n} sur 2`,
} as const;

/** Messages d'erreur — simples, jamais accusateurs. */
export const VSL_ERREURS = {
  prenom: "Votre prénom, pour savoir à qui nous écrivons.",
  emailVide: "Votre e-mail, pour vous envoyer la confirmation.",
  emailInvalide: "Cette adresse semble incomplète.",
  consent: "Cochez la case pour que nous puissions vous écrire.",
  telephoneVide: "Votre numéro, pour vous joindre au sujet de votre rendez-vous.",
  telephoneInvalide: "Ce numéro ne ressemble pas à un téléphone.",
  reponse: "Choisissez la réponse qui s'en approche le plus.",
  invalide: "Une information semble incorrecte. Vérifiez vos réponses et réessayez.",
  rate: "Trop de tentatives pour le moment. Réessayez dans quelques minutes.",
  jeton: "Votre demande a expiré. Reprenez l'étape 1 : ce sera très rapide.",
  inconnue: "Une erreur est survenue. Réessayez ou écrivez-nous à contact@axion-ia.com.",
  perime: "Le site vient d'être mis à jour. Rechargez la page et renvoyez le formulaire.",
} as const;
