/**
 * Tour France IA : les messages de la page « Demandes » (PR-2a).
 *
 * Une Server Action rend la main par une redirection `?ok=<code>` ou `?erreur=<code>`. La page ne
 * recopie JAMAIS le texte de l'adresse : elle cherche le code dans ces deux listes FERMÉES et
 * n'affiche rien s'il n'y est pas. Une adresse forgée (`?erreur=un texte au choix`) n'affiche donc
 * aucun texte choisi par un tiers.
 *
 * Module PUR, sans import (ce n'est pas un module « use server » : il peut exporter des constantes).
 */

/** Longueur maximale du motif de « créer quand même » (contrôlée côté serveur). */
export const LONGUEUR_MAX_MOTIF = 300;

/** Les refus de `fiche.ts` que la page sait reconnaître (le texte rendu par la fonction). */
export const MESSAGE_DEMANDE_EFFACEE = "Demande effacée.";
export const MESSAGE_DEMANDE_ECARTEE = "Demande écartée.";
export const MESSAGE_DEMANDE_INTROUVABLE = "Demande introuvable.";

export const MESSAGES_OK = {
  relancee: "Demande marquée comme relancée.",
  ecartee: "Demande écartée.",
  remise: "Demande remise en attente.",
  fiche_creee: "Fiche prospect créée.",
  fiche_completee: "Fiche complétée avec ce qui manquait.",
} as const;

export const MESSAGES_ERREUR = {
  role: "Votre rôle ne permet pas ce geste sur les demandes du Tour.",
  demande_inconnue: "Demande inconnue.",
  demande_effacee: "Cette demande a été effacée à la demande de la personne : rien à changer.",
  demande_ecartee: "Cette demande est écartée : remettez-la en attente avant ce geste.",
  statut_echec: "Le changement n'a pas pu être enregistré, réessayez.",
  nom_fiche: "Donnez un nom à la fiche.",
  motif_long: "Le motif est trop long (300 caractères au plus).",
  fiche_echec: "La fiche n'a pas pu être créée, réessayez.",
  fiche_refusee:
    "La fiche n'a pas été créée : l'adresse e-mail est peut-être déjà sur une fiche (ouvrez-la, " +
    "ou indiquez un motif), ou une information manque.",
  deja_fiche: "Cette demande a déjà une fiche.",
  completer_echec: "La fiche n'a pas pu être complétée, réessayez.",
  fiche_non_proche: "Cette fiche n'est pas parmi les fiches proches de la demande.",
  fiche_disparue: "Cette fiche n'existe plus ou a été regroupée avec une autre.",
} as const;

export type CodeOk = keyof typeof MESSAGES_OK;
export type CodeErreur = keyof typeof MESSAGES_ERREUR;

/** Le message de succès de ce code, ou `null` si le code n'est pas dans la liste. PUR. */
export function messageOk(code: string | null | undefined): string | null {
  if (code === null || code === undefined) return null;
  return (Object.keys(MESSAGES_OK) as string[]).includes(code) ? MESSAGES_OK[code as CodeOk] : null;
}

/** Le message d'erreur de ce code, ou `null` si le code n'est pas dans la liste. PUR. */
export function messageErreur(code: string | null | undefined): string | null {
  if (code === null || code === undefined) return null;
  return (Object.keys(MESSAGES_ERREUR) as string[]).includes(code)
    ? MESSAGES_ERREUR[code as CodeErreur]
    : null;
}
