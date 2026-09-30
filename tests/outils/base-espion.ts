/**
 * BASE ESPIONNE : un faux client Prisma qui ENREGISTRE chaque appel
 * (`modele.methode(args)`, `$executeRaw` avec son SQL et ses valeurs) et rend
 * des réponses préparées. `$transaction(fn)` appelle `fn` avec la même base.
 *
 * Sert aux fonctions qui écrivent beaucoup (retrait de l'accord, effacement
 * ciblé, gestes sur un compte rendu) : le test lit le JOURNAL des écritures.
 * La vraie base (triggers, contraintes) est prouvée par Gate D.
 */

export interface Appel {
  readonly modele: string;
  readonly methode: string;
  readonly args: Record<string, unknown>;
}

export interface SqlBrut {
  readonly sql: string;
  readonly valeurs: readonly unknown[];
}

type Reponse = (args: Record<string, unknown>) => unknown;

export function baseEspion(reponses: Record<string, Reponse> = {}) {
  const appels: Appel[] = [];
  const sqls: SqlBrut[] = [];
  const defaut = (methode: string): unknown => {
    if (methode === "findMany") return [];
    if (methode === "findUnique" || methode === "findFirst") return null;
    if (methode === "count") return 0;
    if (methode.endsWith("Many")) return { count: 0 };
    return { id: "00000000-0000-4000-8000-00000000cafe" };
  };
  const brut = (strings: TemplateStringsArray, ...valeurs: unknown[]) => {
    sqls.push({ sql: strings.join("?"), valeurs });
    return Promise.resolve(1);
  };
  const base: Record<string, unknown> = new Proxy(
    {},
    {
      get(_c, nom: string | symbol) {
        if (nom === "then") return undefined;
        if (nom === "$transaction") {
          return async (fn: (tx: unknown) => Promise<unknown>) => fn(base);
        }
        if (nom === "$executeRaw" || nom === "$executeRawUnsafe") {
          return (strings: TemplateStringsArray | string, ...valeurs: unknown[]) =>
            typeof strings === "string"
              ? (sqls.push({ sql: strings, valeurs }), Promise.resolve(0))
              : brut(strings, ...valeurs);
        }
        if (nom === "$queryRaw") {
          return (strings: TemplateStringsArray, ...valeurs: unknown[]) => {
            sqls.push({ sql: strings.join("?"), valeurs });
            const r = reponses["$queryRaw"];
            return Promise.resolve(r ? r({ sql: strings.join("?") }) : []);
          };
        }
        const modele = String(nom);
        return new Proxy(
          {},
          {
            get(_m, methode: string | symbol) {
              return async (args: Record<string, unknown> = {}) => {
                appels.push({ modele, methode: String(methode), args });
                const r = reponses[`${modele}.${String(methode)}`];
                return r ? r(args) : defaut(String(methode));
              };
            },
          },
        );
      },
    },
  );
  return {
    base: base as never,
    appels,
    sqls,
    /** Les appels d'un modèle et d'une méthode. */
    de: (modele: string, methode: string) =>
      appels.filter((a) => a.modele === modele && a.methode === methode),
  };
}
