/**
 * Une base Prisma EN MÉMOIRE pour les tests du dossier client (chantier visio,
 * PR 4). Ce n'est pas un faux Prisma complet : elle interprète les formes de
 * requête qu'écrivent les modules du dossier client, et LÈVE sur toute autre
 * forme — un test ne passe jamais « par accident » sur une requête que la base
 * n'a pas su lire.
 *
 * Ce qu'elle tient pour de vrai :
 *   · `$transaction` : une exception annule TOUTES les écritures de la
 *     transaction (instantané puis restauration) — c'est ce qui permet de
 *     prouver « rien n'est écrit à moitié » ;
 *   · les unicités déclarées (`uniques`) : un doublon lève `P2002` ;
 *   · les contrôles déclarés (`verifier`) : appelés à la fin de chaque écriture
 *     hors transaction, et au COMMIT d'une transaction (comme un CHECK
 *     différé) — un contrôle qui lève annule la transaction.
 *
 * Ce qu'elle ne fait PAS (angle mort assumé, couvert par Gate D sur une vraie
 * base) : les clés étrangères, les triggers, les filtres de relation
 * (`{ rencontre: { … } }`), `include`, `select` (la ligne entière est rendue).
 */

import { randomUUID } from "node:crypto";

export type Ligne = Record<string, unknown>;
export type Tables = Record<string, Ligne[]>;

export interface OptionsBase {
  /** Colonnes uniques par modèle (camelCase), une liste de colonnes par contrainte. */
  readonly uniques?: Record<string, ReadonlyArray<ReadonlyArray<string>>>;
  /** Valeurs par défaut posées à la création, par modèle. */
  readonly defauts?: Record<string, () => Ligne>;
  /** Contrôles « CHECK » : lèvent si l'état est invalide. */
  readonly verifier?: (tables: Tables) => void;
  /** Clé primaire d'un modèle qui n'a pas de colonne `id`. */
  readonly clesPrimaires?: Record<string, ReadonlyArray<string>>;
}

export class ErreurUnicite extends Error {
  readonly code = "P2002";
  constructor(modele: string, cols: ReadonlyArray<string>) {
    super(`unicité violée sur ${modele}(${cols.join(", ")})`);
  }
}

export class ErreurIntrouvable extends Error {
  readonly code = "P2025";
}

function inconnue(quoi: string, v: unknown): never {
  throw new Error(`base en mémoire : forme non prévue (${quoi}) : ${JSON.stringify(v)}`);
}

function egal(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a === undefined) a = null;
  if (b === undefined) b = null;
  return a === b;
}

function compare(a: unknown, b: unknown): number {
  const va = a instanceof Date ? a.getTime() : a;
  const vb = b instanceof Date ? b.getTime() : b;
  if (va === vb) return 0;
  if (va === null || va === undefined) return -1;
  if (vb === null || vb === undefined) return 1;
  return (va as number) < (vb as number) ? -1 : 1;
}

const OPERATEURS = new Set([
  "in",
  "notIn",
  "not",
  "lt",
  "lte",
  "gt",
  "gte",
  "equals",
  "contains",
  "startsWith",
  "endsWith",
  "mode",
]);

function estFiltreDeChamp(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== "object" || v instanceof Date || Array.isArray(v)) return false;
  const cles = Object.keys(v);
  return cles.length > 0 && cles.every((c) => OPERATEURS.has(c));
}

export function satisfait(l: Ligne, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;
  for (const [cle, v] of Object.entries(where)) {
    if (v === undefined) continue;
    if (cle === "OR") {
      if (!(v as Record<string, unknown>[]).some((w) => satisfait(l, w))) return false;
      continue;
    }
    if (cle === "AND") {
      const liste = Array.isArray(v) ? v : [v];
      if (!(liste as Record<string, unknown>[]).every((w) => satisfait(l, w))) return false;
      continue;
    }
    if (cle === "NOT") {
      const liste = Array.isArray(v) ? v : [v];
      if ((liste as Record<string, unknown>[]).some((w) => satisfait(l, w))) return false;
      continue;
    }
    const valeur = l[cle];
    if (estFiltreDeChamp(v)) {
      const insensible = v["mode"] === "insensitive";
      const txt = (x: unknown) => (insensible ? String(x ?? "").toLowerCase() : String(x ?? ""));
      for (const [op, arg] of Object.entries(v)) {
        if (op === "mode") continue;
        if (op === "in" && !(arg as unknown[]).some((x) => egal(valeur, x))) return false;
        if (op === "notIn" && (arg as unknown[]).some((x) => egal(valeur, x))) return false;
        if (op === "equals" && !egal(valeur, arg)) return false;
        if (op === "not") {
          if (estFiltreDeChamp(arg)) {
            if (satisfait(l, { [cle]: arg })) return false;
          } else if (egal(valeur, arg)) return false;
        }
        if (op === "lt" && !(valeur !== null && valeur !== undefined && compare(valeur, arg) < 0))
          return false;
        if (op === "lte" && !(valeur !== null && valeur !== undefined && compare(valeur, arg) <= 0))
          return false;
        if (op === "gt" && !(valeur !== null && valeur !== undefined && compare(valeur, arg) > 0))
          return false;
        if (op === "gte" && !(valeur !== null && valeur !== undefined && compare(valeur, arg) >= 0))
          return false;
        if (op === "contains" && !txt(valeur).includes(txt(arg))) return false;
        if (op === "startsWith" && !txt(valeur).startsWith(txt(arg))) return false;
        if (op === "endsWith" && !txt(valeur).endsWith(txt(arg))) return false;
      }
      continue;
    }
    if (v !== null && typeof v === "object" && !(v instanceof Date)) {
      inconnue(`filtre de relation ou composé « ${cle} »`, v);
    }
    if (!egal(valeur, v)) return false;
  }
  return true;
}

function copier<T>(v: T): T {
  return structuredClone(v);
}

function trier(lignes: Ligne[], orderBy: unknown): Ligne[] {
  if (!orderBy) return lignes;
  const criteres = (Array.isArray(orderBy) ? orderBy : [orderBy]) as Record<string, string>[];
  return [...lignes].sort((a, b) => {
    for (const c of criteres) {
      const [champ, sens] = Object.entries(c)[0] ?? inconnue("orderBy", c);
      if (typeof sens !== "string") inconnue("orderBy imbriqué", c);
      const r = compare(a[champ], b[champ]);
      if (r !== 0) return sens === "desc" ? -r : r;
    }
    return 0;
  });
}

/** `{ a_b: { a, b } }` (clé composée Prisma) → `{ a, b }`. */
function aplatirUnique(where: Record<string, unknown>): Record<string, unknown> {
  const plat: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(where)) {
    if (k.includes("_") && v !== null && typeof v === "object" && !(v instanceof Date)) {
      Object.assign(plat, v);
    } else plat[k] = v;
  }
  return plat;
}

function appliquerDonnees(l: Ligne, data: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (v !== null && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      if ("increment" in o) {
        l[k] = Number(l[k] ?? 0) + Number(o["increment"]);
        continue;
      }
      if ("set" in o) {
        l[k] = o["set"];
        continue;
      }
      if ("connect" in o || "create" in o) inconnue(`écriture imbriquée « ${k} »`, v);
    }
    l[k] = v;
  }
}

export interface BaseEnMemoire {
  readonly tables: Tables;
  /** Les requêtes brutes reçues (`$executeRaw`, `$executeRawUnsafe`), en texte. */
  readonly brut: string[];
  /** Nombre de transactions ouvertes (au premier niveau). */
  transactions: number;
  /** Le client à passer au code testé. */
  readonly client: Record<string, unknown> & {
    $transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T>;
  };
}

export function prismaEnMemoire(initial: Tables = {}, options: OptionsBase = {}): BaseEnMemoire {
  const tables: Tables = initial;
  const brut: string[] = [];
  let profondeur = 0;

  const table = (m: string): Ligne[] => (tables[m] ??= []);

  function verifierUnicite(m: string, l: Ligne, ignorer?: Ligne): void {
    for (const cols of options.uniques?.[m] ?? []) {
      if (cols.some((c) => l[c] === null || l[c] === undefined)) continue;
      const doublon = table(m).some(
        (autre) => autre !== ignorer && autre !== l && cols.every((c) => egal(autre[c], l[c])),
      );
      if (doublon) throw new ErreurUnicite(m, cols);
    }
  }

  function apresEcriture(): void {
    if (profondeur === 0) options.verifier?.(tables);
  }

  function uneSeule(m: string, where: Record<string, unknown>): Ligne | null {
    const plat = aplatirUnique(where);
    return table(m).find((l) => satisfait(l, plat)) ?? null;
  }

  function delegue(m: string) {
    return {
      async findUnique(a: { where: Record<string, unknown> }) {
        const l = uneSeule(m, a.where);
        return l ? copier(l) : null;
      },
      async findUniqueOrThrow(a: { where: Record<string, unknown> }) {
        const l = uneSeule(m, a.where);
        if (!l) throw new ErreurIntrouvable(`${m} introuvable`);
        return copier(l);
      },
      async findFirst(a: { where?: Record<string, unknown>; orderBy?: unknown } = {}) {
        const l = trier(
          table(m).filter((x) => satisfait(x, a.where)),
          a.orderBy,
        )[0];
        return l ? copier(l) : null;
      },
      async findMany(
        a: {
          where?: Record<string, unknown>;
          orderBy?: unknown;
          take?: number;
          skip?: number;
        } = {},
      ) {
        let r = trier(
          table(m).filter((x) => satisfait(x, a.where)),
          a.orderBy,
        );
        if (a.skip) r = r.slice(a.skip);
        if (a.take !== undefined) r = r.slice(0, a.take);
        return r.map(copier);
      },
      async count(a: { where?: Record<string, unknown> } = {}) {
        return table(m).filter((x) => satisfait(x, a.where)).length;
      },
      async create(a: { data: Record<string, unknown> }) {
        const l: Ligne = {
          ...(options.clesPrimaires?.[m] ? {} : { id: randomUUID() }),
          ...(options.defauts?.[m]?.() ?? {}),
        };
        appliquerDonnees(l, a.data);
        verifierUnicite(m, l);
        table(m).push(l);
        apresEcriture();
        return copier(l);
      },
      async createMany(a: { data: Record<string, unknown>[]; skipDuplicates?: boolean }) {
        let n = 0;
        for (const d of a.data) {
          const l: Ligne = {
            ...(options.clesPrimaires?.[m] ? {} : { id: randomUUID() }),
            ...(options.defauts?.[m]?.() ?? {}),
          };
          appliquerDonnees(l, d);
          try {
            verifierUnicite(m, l);
          } catch (e) {
            if (a.skipDuplicates) continue;
            throw e;
          }
          table(m).push(l);
          n += 1;
        }
        apresEcriture();
        return { count: n };
      },
      async update(a: { where: Record<string, unknown>; data: Record<string, unknown> }) {
        const l = uneSeule(m, a.where);
        if (!l) throw new ErreurIntrouvable(`${m} introuvable pour mise à jour`);
        const avant = copier(l);
        appliquerDonnees(l, a.data);
        try {
          verifierUnicite(m, l, l);
        } catch (e) {
          Object.assign(l, avant);
          throw e;
        }
        apresEcriture();
        return copier(l);
      },
      async updateMany(a: { where?: Record<string, unknown>; data: Record<string, unknown> }) {
        const cibles = table(m).filter((x) => satisfait(x, a.where));
        for (const l of cibles) appliquerDonnees(l, a.data);
        apresEcriture();
        return { count: cibles.length };
      },
      async upsert(a: {
        where: Record<string, unknown>;
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) {
        const l = uneSeule(m, a.where);
        if (l) {
          appliquerDonnees(l, a.update);
          apresEcriture();
          return copier(l);
        }
        return this.create({ data: a.create });
      },
      async delete(a: { where: Record<string, unknown> }) {
        const l = uneSeule(m, a.where);
        if (!l) throw new ErreurIntrouvable(`${m} introuvable pour suppression`);
        tables[m] = table(m).filter((x) => x !== l);
        apresEcriture();
        return copier(l);
      },
      async deleteMany(a: { where?: Record<string, unknown> } = {}) {
        const avant = table(m).length;
        tables[m] = table(m).filter((x) => !satisfait(x, a.where));
        apresEcriture();
        return { count: avant - (tables[m]?.length ?? 0) };
      },
    };
  }

  const base: BaseEnMemoire = {
    tables,
    brut,
    transactions: 0,
    client: undefined as never,
  };

  const client: Record<string, unknown> = {
    async $executeRaw(parts: TemplateStringsArray | string, ...vals: unknown[]) {
      brut.push(typeof parts === "string" ? parts : parts.join("?") + JSON.stringify(vals));
      return 0;
    },
    async $executeRawUnsafe(sql: string) {
      brut.push(sql);
      return 0;
    },
    async $queryRaw() {
      return [];
    },
    async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
      if (typeof fn !== "function") inconnue("$transaction en tableau", fn);
      if (profondeur > 0) return fn(proxy);
      base.transactions += 1;
      const instantane = copier(tables);
      profondeur += 1;
      try {
        const r = await fn(proxy);
        profondeur -= 1;
        options.verifier?.(tables);
        return r;
      } catch (e) {
        if (profondeur > 0) profondeur -= 1;
        for (const k of Object.keys(tables)) delete tables[k];
        Object.assign(tables, instantane);
        throw e;
      }
    },
  };

  const delegues = new Map<string, ReturnType<typeof delegue>>();
  const proxy: Record<string, unknown> = new Proxy(client, {
    get(cible, nom: string) {
      if (nom in cible) return cible[nom];
      if (nom === "then") return undefined;
      let d = delegues.get(nom);
      if (!d) {
        d = delegue(nom);
        delegues.set(nom, d);
      }
      return d;
    },
  });

  (base as { client: unknown }).client = proxy;
  return base;
}
