/**
 * QNC L02 — une base Prisma EN MÉMOIRE, juste assez pour juger des lectures.
 *
 * Les relations sont EMBARQUÉES dans les lignes (`enrollment.session`,
 * `session.enrollments`…) : le jeu d'essai les écrit une fois, l'évaluateur
 * les lit. Les filtres Prisma reconnus : égalité, `in`, `notIn`, `not`,
 * `gt(e)`/`lt(e)`, `contains`, `startsWith`, `has`, `equals`, `AND`/`OR`/`NOT`,
 * `some`/`every`/`none` (vers plusieurs), `is`/`isNot` (vers un). Un opérateur
 * inconnu LÈVE : un test ne doit pas passer parce qu'un filtre a été ignoré.
 *
 * `findMany` rend les lignes ENTIÈRES (le `select` n'est pas appliqué, sauf le
 * `where` d'une relation sélectionnée et `_count`) : les lecteurs lisent ce
 * qu'ils ont demandé, le reste ne les gêne pas.
 */

export type Ligne = Record<string, unknown>;
export type Tables = Record<string, Ligne[]>;

const OPERATEURS = new Set([
  "equals",
  "in",
  "notIn",
  "not",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains",
  "startsWith",
  "endsWith",
  "has",
  "mode",
]);

function comparable(v: unknown): unknown {
  return v instanceof Date ? v.getTime() : v;
}

function estObjet(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !(v instanceof Date) && !Array.isArray(v);
}

function filtreChamp(valeur: unknown, filtre: unknown): boolean {
  if (!estObjet(filtre)) return comparable(valeur) === comparable(filtre);
  for (const [op, attendu] of Object.entries(filtre)) {
    if (!OPERATEURS.has(op)) throw new Error(`base en mémoire : opérateur inconnu « ${op} »`);
    const v = comparable(valeur);
    const a = comparable(attendu);
    switch (op) {
      case "equals":
        if (v !== a) return false;
        break;
      case "in":
        if (!(attendu as unknown[]).map(comparable).includes(v)) return false;
        break;
      case "notIn":
        if ((attendu as unknown[]).map(comparable).includes(v)) return false;
        break;
      case "not":
        if (estObjet(attendu) ? filtreChamp(valeur, attendu) : v === a) return false;
        break;
      case "gt":
        if (v === null || v === undefined || !((v as number) > (a as number))) return false;
        break;
      case "gte":
        if (v === null || v === undefined || !((v as number) >= (a as number))) return false;
        break;
      case "lt":
        if (v === null || v === undefined || !((v as number) < (a as number))) return false;
        break;
      case "lte":
        if (v === null || v === undefined || !((v as number) <= (a as number))) return false;
        break;
      case "contains":
        if (typeof valeur !== "string" || !valeur.includes(attendu as string)) return false;
        break;
      case "startsWith":
        if (typeof valeur !== "string" || !valeur.startsWith(attendu as string)) return false;
        break;
      case "endsWith":
        if (typeof valeur !== "string" || !valeur.endsWith(attendu as string)) return false;
        break;
      case "has":
        if (!Array.isArray(valeur) || !valeur.includes(attendu)) return false;
        break;
      case "mode":
        break;
    }
  }
  return true;
}

export function correspond(ligne: Ligne, where: unknown): boolean {
  if (where === undefined || where === null) return true;
  if (!estObjet(where)) throw new Error("base en mémoire : `where` invalide");
  for (const [cle, filtre] of Object.entries(where)) {
    if (filtre === undefined) continue;
    if (cle === "AND") {
      const liste = Array.isArray(filtre) ? filtre : [filtre];
      if (!liste.every((w) => correspond(ligne, w))) return false;
      continue;
    }
    if (cle === "OR") {
      if (!(filtre as unknown[]).some((w) => correspond(ligne, w))) return false;
      continue;
    }
    if (cle === "NOT") {
      const liste = Array.isArray(filtre) ? filtre : [filtre];
      if (liste.some((w) => correspond(ligne, w))) return false;
      continue;
    }
    const valeur = ligne[cle];
    if (
      Array.isArray(valeur) &&
      estObjet(filtre) &&
      ("some" in filtre || "every" in filtre || "none" in filtre)
    ) {
      const f = filtre as { some?: unknown; every?: unknown; none?: unknown };
      const enfants = valeur as Ligne[];
      if (f.some !== undefined && !enfants.some((e) => correspond(e, f.some))) return false;
      if (f.every !== undefined && !enfants.every((e) => correspond(e, f.every))) return false;
      if (f.none !== undefined && enfants.some((e) => correspond(e, f.none))) return false;
      continue;
    }
    if (estObjet(filtre) && ("is" in filtre || "isNot" in filtre)) {
      const f = filtre as { is?: unknown; isNot?: unknown };
      if ("is" in f) {
        if (
          f.is === null
            ? valeur !== null && valeur !== undefined
            : !estObjet(valeur) || !correspond(valeur, f.is)
        )
          return false;
      }
      if ("isNot" in f) {
        if (
          f.isNot === null
            ? valeur === null || valeur === undefined
            : estObjet(valeur) && correspond(valeur, f.isNot)
        )
          return false;
      }
      continue;
    }
    if (estObjet(valeur)) {
      // Relation vers un : filtre imbriqué direct.
      if (!correspond(valeur, filtre)) return false;
      continue;
    }
    if (
      (valeur === null || valeur === undefined) &&
      estObjet(filtre) &&
      !Object.keys(filtre).some((k) => OPERATEURS.has(k))
    ) {
      // Relation absente filtrée par contenu : ne correspond pas.
      return false;
    }
    if (!filtreChamp(valeur ?? null, filtre)) return false;
  }
  return true;
}

/** Applique les `where` des relations sélectionnées et les `_count`. */
function projeter(ligne: Ligne, select: unknown): Ligne {
  if (!estObjet(select)) return ligne;
  const out: Ligne = { ...ligne };
  for (const [cle, s] of Object.entries(select)) {
    if (cle === "_count" && estObjet(s) && estObjet(s["select"])) {
      const compte: Record<string, number> = {};
      for (const [rel, rs] of Object.entries(s["select"] as Record<string, unknown>)) {
        const enfants = (ligne[rel] as Ligne[] | undefined) ?? [];
        const w = estObjet(rs) ? rs["where"] : undefined;
        compte[rel] = enfants.filter((e) => correspond(e, w)).length;
      }
      out["_count"] = compte;
      continue;
    }
    const v = ligne[cle];
    if (Array.isArray(v) && estObjet(s)) {
      out[cle] = (v as Ligne[])
        .filter((e) => correspond(e, s["where"]))
        .map((e) => projeter(e, s["select"] ?? s["include"]));
    } else if (estObjet(v) && estObjet(s)) {
      out[cle] = projeter(v, s["select"] ?? s["include"]);
    }
  }
  return out;
}

function delegue(lignes: () => Ligne[], ajouter: (l: Ligne) => void) {
  const filtrer = (args?: { where?: unknown }) =>
    lignes().filter((l) => correspond(l, args?.where));
  return {
    count: async (args?: { where?: unknown }) => filtrer(args).length,
    findMany: async (args?: {
      where?: unknown;
      select?: unknown;
      include?: unknown;
      take?: number;
    }) => {
      const r = filtrer(args).map((l) => projeter(l, args?.select ?? args?.include));
      return args?.take !== undefined ? r.slice(0, args.take) : r;
    },
    findFirst: async (args?: { where?: unknown; select?: unknown }) =>
      filtrer(args).map((l) => projeter(l, args?.select))[0] ?? null,
    findUnique: async (args?: { where?: unknown; select?: unknown }) =>
      filtrer(args).map((l) => projeter(l, args?.select))[0] ?? null,
    aggregate: async (args: { where?: unknown; _sum?: Record<string, boolean> }) => {
      const r = filtrer(args);
      const _sum: Record<string, number | null> = {};
      for (const champ of Object.keys(args._sum ?? {})) {
        _sum[champ] = r.length === 0 ? null : r.reduce((s, l) => s + Number(l[champ] ?? 0), 0);
      }
      return { _sum, _count: { _all: r.length } };
    },
    create: async (args: { data: Ligne }) => {
      const l = { id: `cree-${lignes().length + 1}`, ...args.data };
      ajouter(l);
      return l;
    },
    createMany: async (args: { data: Ligne[] }) => {
      for (const d of args.data) ajouter({ ...d });
      return { count: args.data.length };
    },
    groupBy: async (args: { by: string[]; where?: unknown }) => {
      const groupes = new Map<string, { cles: Ligne; n: number }>();
      for (const l of filtrer(args)) {
        const cles: Ligne = Object.fromEntries(args.by.map((b) => [b, l[b] ?? null]));
        const k = JSON.stringify(cles);
        const g = groupes.get(k) ?? { cles, n: 0 };
        g.n += 1;
        groupes.set(k, g);
      }
      return [...groupes.values()].map((g) => ({ ...g.cles, _count: { _all: g.n } }));
    },
  };
}

/**
 * Un faux client Prisma sur `tables` : tout modèle absent est une table VIDE.
 * `tables` est relu à chaque requête : on peut l'enrichir entre deux appels.
 * `create`/`createMany` ajoutent la ligne telle quelle (journal, file…).
 */
export function fauxPrisma(tables: Tables): Record<string, unknown> {
  return new Proxy(
    {},
    {
      get(_cible, modele: string | symbol) {
        if (typeof modele !== "string") return undefined;
        if (modele === "$queryRaw" || modele === "$queryRawUnsafe") return async () => [];
        if (modele === "$transaction") {
          return async (fn: unknown) =>
            typeof fn === "function"
              ? (fn as (tx: unknown) => unknown)(fauxPrisma(tables))
              : Promise.all(fn as unknown[]);
        }
        return delegue(
          () => tables[modele] ?? [],
          (l) => {
            (tables[modele] ??= []).push(l);
          },
        );
      },
    },
  );
}
