/**
 * Le profil de cache qui expire VRAIMENT, et pourquoi il fallait le nommer.
 *
 * ## Le défaut que cette constante ferme
 *
 * Mesuré le 2026-08-27. Deux endroits du dépôt appelaient
 * `revalidateTag(tag, "default")` sous un commentaire affirmant que `"default"`
 * « reproduit le comportement de `revalidateTag(tag)` des versions 14/15 ».
 *
 * C'est l'inverse exact, et la source installée le dit :
 *
 * · `next/dist/server/web/spec-extension/revalidate.js` — la forme SANS second
 *   argument expire en dur ; avec un profil, l'entrée est marquée *périmée* et
 *   Next sert la version périmée pendant qu'il en cherche une fraîche.
 * · `defaultConfig.cacheLife.default.expire` vaut **4 294 967 294** secondes,
 *   soit ~136 ans. Le profil `"max"` vaut 31 536 000. **Aucun des deux
 *   n'expire.**
 *
 * Conséquence observée sur `/fr/appel` : le visiteur suivant une réservation
 * recevait encore la liste de créneaux périmée, et sur une page à faible trafic
 * « le visiteur suivant » est en pratique le seul visiteur.
 *
 * ## Pourquoi un objet et pas la forme à un argument
 *
 * `revalidateTag(tag)` a le bon comportement mais elle est **dépréciée** : Next
 * émet un avertissement et annonce son retrait. `updateTag(tag)` porterait le
 * bon nom, mais elle `throw` hors d'une Server Action — inutilisable depuis un
 * route handler, qui est précisément d'où l'on invalide ici.
 *
 * Reste la forme documentée et non dépréciée : un profil en ligne dont
 * `expire` vaut 0. `revalidate.js` la traite explicitement comme l'expiration
 * dure (`if (!profile || cacheLife?.expire === 0)`).
 *
 * ⚠️ NE PAS remplacer par `"default"` ni `"max"` « pour faire propre ». Le test
 * `src/server/calendly/__tests__/revalider-creneaux.test.ts` résout la valeur
 * dans la configuration de Next et refuse toute valeur non nulle — il nomme le
 * défaut dans son message d'échec.
 */

/**
 * Profil à passer en second argument de `revalidateTag` quand on veut que la
 * prochaine requête aille RÉELLEMENT chercher la donnée fraîche.
 */
export const EXPIRATION_IMMEDIATE = { expire: 0 } as const;
