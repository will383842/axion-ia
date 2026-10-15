// Banc @formateurs — `@/auth` remplacé : la session de console est celle que le
// banc a posée pour l'appel en cours (`globalThis.__BANC_CONTEXTE__.admin`).
// Aucune session = non connecté, exactement comme un visiteur.

export async function auth() {
  const admin = globalThis.__BANC_CONTEXTE__?.admin;
  if (!admin) return null;
  return { user: { id: admin.id, role: admin.role, email: admin.email }, expires: "2999-01-01" };
}

export const handlers = {};
export async function signIn() {
  throw new Error("banc @formateurs : signIn indisponible");
}
export async function signOut() {
  throw new Error("banc @formateurs : signOut indisponible");
}
