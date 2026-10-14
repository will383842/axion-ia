// Doublure de `next/headers` : la requête d'une action de console, vue du serveur.
// Adresse de documentation (RFC 5737), aucun cookie.
const entetes = new Headers({
  "x-forwarded-for": process.env.BANC_IP || "192.0.2.10",
  "user-agent": "banc-formateurs",
});
export async function headers() {
  return entetes;
}
export async function cookies() {
  const vide = new Map();
  return {
    get: (n) => vide.get(n),
    getAll: () => [],
    has: (n) => vide.has(n),
    set: (n, v) => vide.set(n, { name: n, value: v }),
    delete: (n) => vide.delete(n),
  };
}
export async function draftMode() {
  return { isEnabled: false, enable() {}, disable() {} };
}
