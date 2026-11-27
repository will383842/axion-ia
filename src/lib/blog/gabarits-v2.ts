/**
 * Interrupteur des nouveaux gabarits d'articles de blog (chantier « gabarits
 * d'articles », PR S1).
 *
 * Éteint par défaut : SEULE la valeur exacte "true" l'allume. Absente, "false"
 * ou vide → les pages actuelles, au balisage identique. (`env.ts` n'accepte que
 * "true" | "false" : une autre valeur échoue à la validation de l'environnement
 * au démarrage ; cette fonction reste malgré tout stricte par défense.)
 *
 * Lecture à chaque appel (jamais en constante de module) et côté serveur
 * seulement : jamais `NEXT_PUBLIC_`.
 */
export function gabaritsV2Actifs(): boolean {
  return process.env.BLOG_GABARITS_V2 === "true";
}
