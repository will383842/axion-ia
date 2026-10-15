// Banc @formateurs, équipe sécurité — `next/headers` hors d'une requête Next.
//
// Les cookies et en-têtes sont ceux que le scénario pose : c'est ainsi qu'un
// formateur « connecté » se présente aux actions de son espace, avec un VRAI
// jeton de session émis par le code du dépôt.

export * from "next/headers";

const pot = new Map<string, string>();
const entetes = new Headers({ "user-agent": "banc-formateurs", "x-forwarded-for": "192.0.2.20" });

export function poserCookie(nom: string, valeur: string | null): void {
  if (valeur === null) pot.delete(nom);
  else pot.set(nom, valeur);
}

export function lireCookiesPoses(): ReadonlyMap<string, string> {
  return pot;
}

const magasin = {
  get(nom: string) {
    const value = pot.get(nom);
    return value === undefined ? undefined : { name: nom, value };
  },
  getAll() {
    return [...pot].map(([name, value]) => ({ name, value }));
  },
  has(nom: string) {
    return pot.has(nom);
  },
  set(nom: string | { name: string; value: string }, valeur?: string) {
    if (typeof nom === "string") pot.set(nom, valeur ?? "");
    else pot.set(nom.name, nom.value);
    return magasin;
  },
  delete(nom: string | { name: string }) {
    pot.delete(typeof nom === "string" ? nom : nom.name);
    return magasin;
  },
  toString() {
    return [...pot].map(([n, v]) => `${n}=${v}`).join("; ");
  },
};

export async function cookies(): Promise<typeof magasin> {
  return magasin;
}

export async function headers(): Promise<Headers> {
  return entetes;
}
