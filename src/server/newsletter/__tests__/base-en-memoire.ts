/**
 * Base EN MÉMOIRE pour les tests de purge et d'effacement (lot L6).
 *
 * 🔑 Pourquoi pas un mock qui enregistre les arguments : une clause `where`
 * lue dans ses arguments prouve qu'elle est ÉCRITE, jamais ce qu'elle
 * SUPPRIME. Ici, les lignes existent, la clause est évaluée, et l'on regarde
 * ce qui reste — l'effet, pas l'intention.
 *
 * Sous-ensemble de Prisma : égalité, `null`, `lt`, `gte`, `in`, `OR`, `AND`.
 * Tout autre opérateur LÈVE : un test ne doit pas passer au vert parce que le
 * faux moteur a ignoré une condition qu'il ne comprenait pas.
 *
 * Les chaînes se comparent sans la casse : les colonnes d'adresse de ces
 * tables sont en `citext`.
 */

export type Ligne = Record<string, unknown>;
type Where = Record<string, unknown>;

function egal(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (typeof a === "string" && typeof b === "string") return a.toLowerCase() === b.toLowerCase();
  return a === b;
}

export function correspond(ligne: Ligne, where: Where | undefined): boolean {
  if (!where) return true;
  for (const [cle, cond] of Object.entries(where)) {
    if (cle === "AND") {
      if (!(cond as Where[]).every((w) => correspond(ligne, w))) return false;
      continue;
    }
    if (cle === "OR") {
      if (!(cond as Where[]).some((w) => correspond(ligne, w))) return false;
      continue;
    }
    const v = ligne[cle];
    if (cond === null) {
      if (v !== null && v !== undefined) return false;
      continue;
    }
    if (cond instanceof Date || typeof cond !== "object") {
      if (!egal(v, cond)) return false;
      continue;
    }
    for (const [op, arg] of Object.entries(cond as Record<string, unknown>)) {
      switch (op) {
        case "lt":
          // SQL : NULL < x est inconnu, donc la ligne n'est pas retenue.
          if (!(v instanceof Date && v.getTime() < (arg as Date).getTime())) return false;
          break;
        case "gte":
          if (!(v instanceof Date && v.getTime() >= (arg as Date).getTime())) return false;
          break;
        case "in":
          if (!(arg as unknown[]).some((x) => egal(v, x))) return false;
          break;
        default:
          throw new Error(`opérateur non pris en charge par la base en mémoire : ${op}`);
      }
    }
  }
  return true;
}

export interface Table {
  lignes: Ligne[];
  findMany: (a?: { where?: Where; select?: Record<string, boolean> }) => Promise<Ligne[]>;
  findUnique: (a: { where: Where; select?: Record<string, boolean> }) => Promise<Ligne | null>;
  deleteMany: (a?: { where?: Where }) => Promise<{ count: number }>;
  updateMany: (a: { where?: Where; data: Ligne }) => Promise<{ count: number }>;
}

function projeter(l: Ligne, select?: Record<string, boolean>): Ligne {
  if (!select) return { ...l };
  const r: Ligne = {};
  for (const [k, oui] of Object.entries(select)) if (oui) r[k] = l[k];
  return r;
}

export function table(lignes: Ligne[]): Table {
  const t: Table = {
    lignes,
    findMany: async (a) =>
      t.lignes.filter((l) => correspond(l, a?.where)).map((l) => projeter(l, a?.select)),
    findUnique: async (a) => {
      const l = t.lignes.find((x) => correspond(x, a.where));
      return l ? projeter(l, a.select) : null;
    },
    deleteMany: async (a) => {
      const avant = t.lignes.length;
      t.lignes = t.lignes.filter((l) => !correspond(l, a?.where));
      return { count: avant - t.lignes.length };
    },
    updateMany: async (a) => {
      let n = 0;
      for (const l of t.lignes) {
        if (correspond(l, a.where)) {
          Object.assign(l, a.data);
          n += 1;
        }
      }
      return { count: n };
    },
  };
  return t;
}
