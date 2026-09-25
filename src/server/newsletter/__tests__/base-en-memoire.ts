/**
 * Base EN MÉMOIRE pour les tests de purge et d'effacement (lot L6).
 *
 * 🔑 Pourquoi pas un mock qui enregistre les arguments : une clause `where`
 * lue dans ses arguments prouve qu'elle est ÉCRITE, jamais ce qu'elle
 * SUPPRIME. Ici, les lignes existent, la clause est évaluée, et l'on regarde
 * ce qui reste — l'effet, pas l'intention.
 *
 * Sous-ensemble de Prisma : égalité, `null`, `lt`, `gte`, `in`, `not: null`,
 * `startsWith`, `OR`, `AND`, `NOT`, et le filtre JSON `{ path, equals }`.
 * Tout autre opérateur LÈVE : un test ne doit pas passer au vert parce que le
 * faux moteur a ignoré une condition qu'il ne comprenait pas.
 *
 * Casse : Postgres compare sans la casse les SEULES colonnes `citext`. La liste
 * est explicite (`COLONNES_CITEXT`, relevée dans `schema.prisma`) : une
 * comparaison insensible partout aurait rendu vert un test qui, en base,
 * rougirait — une empreinte hexadécimale, un statut ou une référence de
 * formulaire se comparent à l'octet près.
 */

export type Ligne = Record<string, unknown>;
type Where = Record<string, unknown>;

/** Colonnes `@db.Citext` des tables que ces tests manipulent (adresses). */
export const COLONNES_CITEXT: ReadonlySet<string> = new Set(["email", "recipient"]);

function egal(cle: string, a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (COLONNES_CITEXT.has(cle) && typeof a === "string" && typeof b === "string") {
    return a.toLowerCase() === b.toLowerCase();
  }
  return a === b;
}

/** Filtre JSON Prisma (`{ path: [...], equals }`) : sensible à la casse, comme `jsonb`. */
function valeurAuChemin(v: unknown, chemin: readonly string[]): unknown {
  let courant = v;
  for (const pas of chemin) {
    if (courant === null || typeof courant !== "object") return undefined;
    courant = (courant as Record<string, unknown>)[pas];
  }
  return courant;
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
    if (cle === "NOT") {
      const liste = Array.isArray(cond) ? (cond as Where[]) : [cond as Where];
      if (liste.some((w) => correspond(ligne, w))) return false;
      continue;
    }
    const v = ligne[cle];
    if (cond === null) {
      if (v !== null && v !== undefined) return false;
      continue;
    }
    if (cond instanceof Date || typeof cond !== "object") {
      if (!egal(cle, v, cond)) return false;
      continue;
    }
    const ops = cond as Record<string, unknown>;
    if ("path" in ops) {
      const { path, equals, ...reste } = ops;
      if (Object.keys(reste).length > 0) {
        throw new Error(`filtre JSON non pris en charge : ${Object.keys(reste).join(", ")}`);
      }
      if (valeurAuChemin(v, path as string[]) !== equals) return false;
      continue;
    }
    for (const [op, arg] of Object.entries(ops)) {
      switch (op) {
        case "lt":
          // SQL : NULL < x est inconnu, donc la ligne n'est pas retenue.
          if (!(v instanceof Date && v.getTime() < (arg as Date).getTime())) return false;
          break;
        case "gte":
          if (!(v instanceof Date && v.getTime() >= (arg as Date).getTime())) return false;
          break;
        case "in":
          if (!(arg as unknown[]).some((x) => egal(cle, v, x))) return false;
          break;
        case "not":
          if (arg !== null) throw new Error("`not` n'est pris en charge qu'avec null");
          if (v === null || v === undefined) return false;
          break;
        case "startsWith":
          // SQL : NULL LIKE 'x%' est inconnu.
          if (typeof v !== "string" || !v.startsWith(arg as string)) return false;
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
  findMany: (a?: {
    where?: Where;
    select?: Record<string, boolean>;
    take?: number;
  }) => Promise<Ligne[]>;
  findUnique: (a: { where: Where; select?: Record<string, boolean> }) => Promise<Ligne | null>;
  deleteMany: (a?: { where?: Where }) => Promise<{ count: number }>;
  updateMany: (a: { where?: Where; data: Ligne }) => Promise<{ count: number }>;
  create: (a: { data: Ligne; select?: Record<string, boolean> }) => Promise<Ligne>;
  upsert: (a: {
    where: Where;
    create: Ligne;
    update: Ligne;
    select?: Record<string, boolean>;
  }) => Promise<Ligne>;
}

function projeter(l: Ligne, select?: Record<string, boolean>): Ligne {
  if (!select) return { ...l };
  const r: Ligne = {};
  for (const [k, oui] of Object.entries(select)) if (oui) r[k] = l[k];
  return r;
}

let compteur = 0;

export function table(lignes: Ligne[]): Table {
  const t: Table = {
    lignes,
    findMany: async (a) => {
      const trouvees = t.lignes.filter((l) => correspond(l, a?.where));
      const bornees = a?.take === undefined ? trouvees : trouvees.slice(0, a.take);
      return bornees.map((l) => projeter(l, a?.select));
    },
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
    create: async (a) => {
      compteur += 1;
      const l: Ligne = { id: `cree-${compteur}`, ...a.data };
      t.lignes.push(l);
      return projeter(l, a.select);
    },
    upsert: async (a) => {
      const l = t.lignes.find((x) => correspond(x, a.where));
      if (l) {
        Object.assign(l, a.update);
        return projeter(l, a.select);
      }
      return t.create({ data: a.create, ...(a.select ? { select: a.select } : {}) });
    },
  };
  return t;
}
