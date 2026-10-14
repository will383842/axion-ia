// Banc @formateurs — `next/headers` remplacé : aucune requête HTTP n'existe.
// Les cookies sont ceux que le banc a posés pour l'appel en cours ; aucun en-tête.

function contexte() {
  return globalThis.__BANC_CONTEXTE__ ?? {};
}

export async function cookies() {
  const jar = new Map(Object.entries(contexte().cookies ?? {}));
  return {
    get: (nom) => (jar.has(nom) ? { name: nom, value: jar.get(nom) } : undefined),
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    has: (nom) => jar.has(nom),
    set: (nom, valeur) => {
      jar.set(nom, typeof valeur === "object" ? valeur.value : valeur);
    },
    delete: (nom) => {
      jar.delete(nom);
    },
  };
}

export async function headers() {
  return new Headers(contexte().entetes ?? {});
}

export async function draftMode() {
  return { isEnabled: false, enable() {}, disable() {} };
}
