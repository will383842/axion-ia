/**
 * Les lignes d'une chaîne de signatures, telles qu'elles doivent être lues.
 *
 * ## Pourquoi ce fragment de requête existe
 *
 * 🔴 Une chaîne de hachage ne se vérifie QUE sur les lignes vivantes, dans
 * l'ordre d'insertion. Ces deux conditions ne sont pas un détail de requête :
 * elles sont la condition pour que `verifierChaine` rende un verdict juste.
 *
 *   · `revokedAt: null` — une ligne révoquée est retirée du décompte ; la
 *     laisser produirait une rupture de chaînage là où il n'y a qu'une
 *     correction régulière ;
 *   · `orderBy: [createdAt, id]` — l'ordre d'INSERTION, **jamais** `signeAt`.
 *     `signeAt` est figé avant l'écriture de l'image ; trier dessus produit une
 *     rupture de chaînage FANTÔME, c'est-à-dire un faux verdict de corruption
 *     dans un dossier d'audit.
 *
 * ⚠️ Ces deux lignes étaient recopiées à chaque lecture — deux fois dans
 * `conformite/dossier-session.ts`, et il en fallait une troisième pour le
 * registre d'émargement. `registre-verification.ts` documente d'ailleurs
 * l'invariant en toutes lettres (« doit contenir les lignes VIVANTES DÉJÀ
 * triées »), en précisant que le tri « appartient à la requête, et le refaire
 * donnerait l'illusion qu'un appelant peut se permettre de le rater ».
 *
 * 🔑 Un invariant qu'on documente en demandant à chaque appelant de le respecter
 * est un invariant qui sera raté. Il vit maintenant à un seul endroit.
 */

/**
 * Filtre et ordre à appliquer à toute lecture de chaîne.
 *
 * Le type de retour est écrit à la main plutôt qu'inféré : `as const` sur un
 * littéral produit des tuples en lecture seule que Prisma refuse, et un
 * `orderBy` typé trop largement laisserait passer `signeAt`.
 */
export function lignesDeChaine(): {
  where: { revokedAt: null };
  orderBy: [{ createdAt: "asc" }, { id: "asc" }];
} {
  return {
    where: { revokedAt: null },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  };
}
