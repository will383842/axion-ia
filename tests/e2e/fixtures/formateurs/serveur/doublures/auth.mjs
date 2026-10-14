// Doublure de `@/auth` pour l'exécuteur des étapes du banc : la session est celle
// que le spec déclare dans `BANC_SESSION` (un administrateur du banc, réel en base),
// ou aucune. Rien d'autre de NextAuth n'est exposé.
export async function auth() {
  const brute = process.env.BANC_SESSION;
  return brute ? { user: JSON.parse(brute), expires: "2999-01-01T00:00:00.000Z" } : null;
}
export const handlers = {};
export async function signIn() {
  throw new Error("banc @formateurs : signIn n'existe pas dans le banc");
}
export async function signOut() {}
