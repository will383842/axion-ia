/**
 * Challenges d'apporteurs — les messages de retour de la console, par CODE.
 *
 * `?retour=` et `?erreur=` ne portent jamais de texte libre : un lien forgé ne peut pas faire
 * afficher une consigne ou un faux succès à un administrateur. Les pages traduisent le code par
 * cette table fermée ; un code inconnu n'affiche rien.
 */
export const MESSAGES_RETOUR = {
  brouillon: "Brouillon enregistré. Rien n'est visible des apporteurs.",
  publie: "Challenge publié. Son règlement ne peut plus être modifié.",
  archive: "Challenge archivé.",
} as const;

export const MESSAGES_ERREUR = {
  eteint: "Les challenges sont éteints.",
  session: "Session expirée : reconnectez-vous.",
  role: "Seul un administrateur peut gérer les challenges.",
  inconnu: "Challenge inconnu.",
  cases: "Cochez les trois cases pour publier.",
  confirmer_archivage: "Confirmez d'abord l'archivage.",
  pas_brouillon: "Ce challenge n'est plus un brouillon : sa règle ne peut plus être modifiée.",
  pas_publiable: "Seul un brouillon peut être publié.",
  modifie: "Ce challenge vient d'être modifié : rechargez la page et relisez-le.",
  termine: "La période de ce challenge est déjà terminée : on ne publie pas une prime rétroactive.",
  deja_commence:
    "La période a déjà commencé : cochez « Je publie un challenge déjà commencé » pour confirmer.",
  chevauche: "Un challenge déjà publié, ou archivé après son début, couvre une partie de cette période : les primes de challenges ne se cumulent pas.",
  pas_archivable: "Seul un challenge publié peut être archivé.",
  publication: "Publication impossible. Réessayez.",
  archivage: "Archivage impossible. Réessayez.",
} as const;

export type CodeRetour = keyof typeof MESSAGES_RETOUR;
export type CodeErreur = keyof typeof MESSAGES_ERREUR;

/** Le texte d'un code de retour, ou null (code absent, inconnu ou hérité d'Object.prototype). */
export function messageRetour(code: string | undefined): string | null {
  return code !== undefined && Object.hasOwn(MESSAGES_RETOUR, code)
    ? MESSAGES_RETOUR[code as CodeRetour]
    : null;
}

export function messageErreur(code: string | undefined): string | null {
  return code !== undefined && Object.hasOwn(MESSAGES_ERREUR, code)
    ? MESSAGES_ERREUR[code as CodeErreur]
    : null;
}
