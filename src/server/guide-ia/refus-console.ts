/**
 * QUI PEUT RECEVOIR LE GUIDE DEPUIS LA CONSOLE — la règle, PURE (lot L3).
 *
 * Séparée de `envoi-console.ts` pour que les écrans (fiche abonné, écran des
 * demandes) appliquent EXACTEMENT la règle des gestes sans tirer la file
 * d'e-mails : un bouton affiché promet un envoi que le geste tiendra, un
 * bouton masqué dit pourquoi, avec la même phrase que le refus.
 *
 * Aucun import : ce module ne lit rien, il décide sur ce qu'on lui donne.
 */

/** Les refus propres à la console : aucun ne crée de ligne, aucun ne met en file. */
export type RefusConsole =
  /** Désabonné : sans demande de sa part, la console ne lui écrit pas. */
  | "adresse-desabonnee"
  /** `pending` de l'ancien double opt-in : jamais confirmé, donc pas inscrit. */
  | "inscription-non-confirmee"
  /** Opposition à toute sollicitation (`email_oppositions`). */
  | "adresse-opposee"
  /** Rebond dur connu : aucun envoi n'arriverait. */
  | "adresse-rejetee";

/** Ce qu'il faut savoir d'une adresse pour décider d'un envoi console. */
export interface EtatAdresseConsole {
  /** Statut de la ligne d'abonné, `null` s'il n'y en a pas. */
  readonly statut: "pending" | "confirmed" | "unsubscribed" | "bounced" | null;
  readonly opposee: boolean;
  /** Rebond dur connu dans `email_logs`. */
  readonly rebondDur: boolean;
}

/**
 * LA règle, pure : un envoi depuis la console est-il permis ?
 *
 * `origine` est celle de la demande existante (`null` : il n'y en a pas
 * encore, la console la créerait). Rend le refus, ou `null` si l'envoi est
 * permis. Les écrans et les gestes appellent la même fonction : un bouton
 * affiché promet un envoi que le geste tiendra.
 */
export function refusConsole(
  etat: EtatAdresseConsole,
  origine: "formulaire" | "admin" | null,
): RefusConsole | "introuvable" | null {
  // Le rebond dur arrête tout, demande ou pas : rien n'arriverait.
  if (etat.rebondDur || etat.statut === "bounced") return "adresse-rejetee";
  // La personne a demandé le guide elle-même : le renvoi reste permis.
  if (origine === "formulaire") return null;
  if (etat.opposee) return "adresse-opposee";
  if (etat.statut === "unsubscribed") return "adresse-desabonnee";
  if (etat.statut === "pending") return "inscription-non-confirmee";
  // Une demande console sans abonné : la fiche a été effacée entre-temps.
  if (etat.statut === null) return "introuvable";
  return null;
}

/** Phrases des refus, partagées par les écrans (bouton masqué) et les gestes. */
export const LIBELLE_REFUS_CONSOLE: Readonly<Record<RefusConsole, string>> = {
  "adresse-desabonnee":
    "Cette personne s'est désabonnée : aucun envoi depuis la console. Elle peut redemander le guide elle-même sur le site.",
  "inscription-non-confirmee":
    "Inscription jamais confirmée (ancien double opt-in) : aucun envoi depuis la console.",
  "adresse-opposee": "Cette personne s'est opposée à toute sollicitation : aucun envoi.",
  "adresse-rejetee": "Adresse en rebond définitif : rien n'est parti.",
};
