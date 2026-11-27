/**
 * Base en mémoire, juste assez fidèle pour les tests du robot (jamais de vraie base) : elle
 * implémente les opérations et les filtres EXACTS que l'ingestion, le rattrapage et la purge
 * utilisent, pas un Prisma général.
 */
type Ligne = Record<string, unknown>;

function egalDate(a: unknown, b: unknown): boolean {
  return a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b;
}
function val(v: unknown): number | string {
  return v instanceof Date ? v.getTime() : (v as number | string);
}

function correspond(l: Ligne, where: Ligne | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, cond]) => {
    if (k === "OR") return (cond as Ligne[]).some((c) => correspond(l, c));
    const v = l[k];
    if (cond instanceof Date || typeof cond !== "object" || cond === null) return egalDate(v, cond);
    const c = cond as Record<string, unknown>;
    return Object.entries(c).every(([op, x]) => {
      if (op === "in") return (x as unknown[]).some((y) => egalDate(v, y));
      if (op === "gte") return val(v) >= val(x);
      if (op === "gt") return val(v) > val(x);
      if (op === "lte") return val(v) <= val(x);
      if (op === "lt") return val(v) < val(x);
      if (op === "not") return x === null ? v !== null && v !== undefined : !egalDate(v, x);
      throw new Error(`faux-prisma : opérateur ${op} non géré`);
    });
  });
}

class Table {
  lignes: Ligne[] = [];
  private seq = 1;
  constructor(
    private readonly cleUnique: ReadonlyArray<string> = [],
    private readonly cuid = false,
  ) {}
  private nouvelId(): string | number {
    return this.cuid ? `id${this.seq++}` : this.seq++;
  }
  private doublon(d: Ligne): boolean {
    return (
      this.cleUnique.length > 0 &&
      this.lignes.some((l) => this.cleUnique.every((k) => egalDate(l[k], d[k])))
    );
  }
  async create({ data }: { data: Ligne }) {
    if (this.doublon(data)) throw Object.assign(new Error("unique"), { code: "P2002" });
    const l = { id: this.nouvelId(), debutLe: new Date(), ...data };
    this.lignes.push(l);
    return l;
  }
  async createMany({ data, skipDuplicates }: { data: Ligne[]; skipDuplicates?: boolean }) {
    let n = 0;
    for (const d of data) {
      if (this.doublon(d)) {
        if (skipDuplicates) continue;
        throw Object.assign(new Error("unique"), { code: "P2002" });
      }
      this.lignes.push({ id: this.nouvelId(), ...d });
      n++;
    }
    return { count: n };
  }
  async findMany(args: { where?: Ligne; take?: number; orderBy?: Ligne; select?: Ligne } = {}) {
    let r = this.lignes.filter((l) => correspond(l, args.where));
    const ordre = args.orderBy ? Object.entries(args.orderBy)[0] : undefined;
    if (ordre) {
      const [champ, sens] = ordre;
      r = [...r].sort(
        (a, b) => (val(a[champ]) < val(b[champ]) ? -1 : 1) * (sens === "desc" ? -1 : 1),
      );
    }
    if (args.take) r = r.slice(0, args.take);
    return r.map((l) => ({ ...l }));
  }
  async findUnique({ where }: { where: Ligne }) {
    const cle = Object.values(where)[0] as Ligne;
    const l = this.lignes.find((x) => Object.entries(cle).every(([k, v]) => egalDate(x[k], v)));
    return l ? { ...l } : null;
  }
  async update({ where, data }: { where: Ligne; data: Ligne }) {
    const l = this.lignes.find((x) => correspond(x, where));
    if (!l) throw new Error("introuvable");
    Object.assign(l, data);
    return { ...l };
  }
  async updateMany({ where, data }: { where: Ligne; data: Ligne }) {
    const cibles = this.lignes.filter((l) => correspond(l, where));
    for (const l of cibles) Object.assign(l, data);
    return { count: cibles.length };
  }
  async deleteMany({ where }: { where?: Ligne } = {}) {
    const avant = this.lignes.length;
    this.lignes = this.lignes.filter((l) => !correspond(l, where));
    return { count: avant - this.lignes.length };
  }
  async groupBy({ by, where }: { by: string[]; where?: Ligne; _sum?: Ligne; orderBy?: Ligne }) {
    const groupes = new Map<string, Ligne>();
    for (const l of this.lignes.filter((x) => correspond(x, where))) {
      const k = by.map((b) => String(val(l[b]))).join("|");
      const g = groupes.get(k) ?? {
        ...Object.fromEntries(by.map((b) => [b, l[b]])),
        _sum: { impressions: 0 },
      };
      (g["_sum"] as { impressions: number }).impressions += (l["impressions"] as number) ?? 0;
      groupes.set(k, g);
    }
    return [...groupes.values()];
  }
}

export function creerFauxPrisma(opts: { noms?: Array<{ prenom: string; nom: string }> } = {}) {
  const base = {
    gscImportRun: new Table(["jour", "typeRecherche"], true),
    gscPageJour: new Table(["date", "typeRecherche", "chemin"]),
    gscRequete: new Table(["texte"]),
    gscPageRequeteJour: new Table(["date", "typeRecherche", "chemin", "requeteId"]),
    gscPageRequeteSemaine: new Table(["semaine", "typeRecherche", "chemin", "requeteId"]),
    siteRoute: new Table(),
    trainer: new Table(),
    jobApplication: new Table(),
    client: new Table(),
    trainee: new Table(),
    clientContact: new Table(),
    adminUser: new Table(),
  };
  for (const n of opts.noms ?? []) base.trainer.lignes.push({ ...n });
  const prisma = {
    ...base,
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      // Rejoue sur une copie : une erreur au milieu annule tout (comme une vraie transaction).
      const sauve = Object.entries(base).map(
        ([k, t]) => [k, t.lignes.map((l) => ({ ...l }))] as const,
      );
      try {
        return await fn(base);
      } catch (e) {
        for (const [k, l] of sauve) (base as Record<string, Table>)[k]!.lignes = l;
        throw e;
      }
    },
  };
  return { prisma: prisma as never, base };
}
