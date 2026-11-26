// Simulateur en mémoire pour les specs « TVA figée par pièce » et « changement de régime » : une base
// minimale (commissions, fiche apporteur, pièces figées, changements de régime, journal) qui interprète
// vraiment les requêtes de `facturation.ts`, `commissions.ts`, `tva-pieces.ts` et `regime-tva.ts`.
// Aucun `vi` ici : chaque spec pose ses `vi.mock` et importe ce module de façon asynchrone.

export interface Ligne {
  id: string;
  apporteurId: string;
  statut: string;
  montantCents: number | null;
  autofactureNumero: string | null;
  autofactureEmiseAt: Date | null;
  avoirNumero: string | null;
  autofactureAttenteMotif: string | null;
  autofactureAttenteDepuis: Date | null;
  litigeDepuis: Date | null;
  litigeMotif: string | null;
  releveMois: string | null;
  verseeAt: Date | null;
  majAt: Date;
  activite: string;
  creeAt?: Date;
  palier: string | null;
  parrainage: boolean;
  prixPublicHtCents: number | null;
  factureHtCents: number;
  factureId: string;
}

export interface Piece {
  numero: string;
  apporteurId: string;
  genre: string;
  regimeTva: "assujetti" | "franchise_293b";
  numeroTva: string | null;
  totalHtCents: number | null;
  totalTvaCents: number | null;
  totalTtcCents: number | null;
  factureRectifiee: string | null;
  emiseAt: Date;
  origine: string;
}

export interface Changement {
  id: string;
  apporteurId: string;
  regimeAvant: string | null;
  numeroTvaAvant: string | null;
  regimeTva: "assujetti" | "franchise_293b";
  numeroTva: string | null;
  effetAu: Date;
  saisiAt: Date;
  saisiPar: string | null;
  annuleAt: Date | null;
}

export const etat = {
  lignes: [] as Ligne[],
  pieces: [] as Piece[],
  changements: [] as Changement[],
  /** `false` : la migration n'est pas passée (les deux tables n'existent pas). */
  tables: true,
  apporteurs: {} as Record<string, Record<string, unknown>>,
  journal: [] as Array<Record<string, unknown>>,
  envoyes: [] as Array<Record<string, unknown>>,
  confirmations: [] as Array<Record<string, unknown>>,
  alertes: [] as Array<{ jobId: string; payload: Record<string, unknown> }>,
  jobIds: new Set<string>(),
  sentry: [] as string[],
  pdfs: [] as string[],
  seq: 0,
};

export function remettreAZero(): void {
  etat.lignes = [];
  etat.pieces = [];
  etat.changements = [];
  etat.tables = true;
  etat.apporteurs = {};
  etat.journal = [];
  etat.envoyes = [];
  etat.confirmations = [];
  etat.alertes = [];
  etat.jobIds = new Set();
  etat.sentry = [];
  etat.pdfs = [];
  etat.seq = 0;
}

type V = unknown;
export function correspond(l: Record<string, V>, where: Record<string, V>): boolean {
  return Object.entries(where).every(([cle, cond]) => {
    if (cle === "OR") return (cond as Array<Record<string, V>>).some((w) => correspond(l, w));
    if (cle === "NOT") return !correspond(l, cond as Record<string, V>);
    const v = l[cle];
    if (cond === null) return v === null || v === undefined;
    if (cond instanceof Date) return v instanceof Date && v.getTime() === cond.getTime();
    if (typeof cond === "object") {
      const c = cond as Record<string, V>;
      if ("in" in c) return (c["in"] as V[]).includes(v);
      if ("not" in c) return c["not"] === null ? v !== null && v !== undefined : v !== c["not"];
      if ("gt" in c) return v instanceof Date ? v.getTime() > (c["gt"] as Date).getTime() : false;
      if ("lte" in c)
        return v instanceof Date ? v.getTime() <= (c["lte"] as Date).getTime() : false;
      if ("startsWith" in c) return typeof v === "string" && v.startsWith(String(c["startsWith"]));
      return true;
    }
    return v === cond;
  });
}

const ficheDe = (id: string) => ({
  id,
  prenom: "Jeanne",
  nom: "Martin",
  email: `${id.toLowerCase()}@m.fr`,
  statut: "signe",
  denomination: null,
  siren: "123456782",
  adresse: "1 rue des Lilas, 69000 Lyon",
  regimeTva: "assujetti",
  numeroTva: "FR00123456782",
  signeParSocieteAt: new Date("2026-06-01T09:00:00Z"),
  versionLien: 1,
  ...etat.apporteurs[id],
});

const lignes = () => etat.lignes as unknown as Array<Record<string, V>>;
const tableAbsente = () => {
  if (!etat.tables) throw new Error('relation "pieces_autofacture_apporteur" does not exist');
};

export const prisma = {
  apporteurReseauSiret: { findUnique: async () => null },
  apporteurReseau: {
    findUnique: async (a: { where: { id: string } }) => ficheDe(a.where.id),
    findMany: async (a: { where: { id: { in: string[] } } }) =>
      a.where.id.in.map((id) => ficheDe(id)),
    updateMany: async (a: { where: Record<string, V>; data: Record<string, V> }) => {
      const id = String(a.where["id"]);
      const f = ficheDe(id);
      if (a.where["regimeTva"] !== undefined && f.regimeTva !== a.where["regimeTva"])
        return { count: 0 };
      etat.apporteurs[id] = { ...etat.apporteurs[id], ...a.data };
      return { count: 1 };
    },
  },
  commissionApporteur: {
    create: async (a: { data: Record<string, V> }) => {
      const id = `rep-${lignes().length + 1}`;
      etat.lignes.push({
        id,
        apporteurId: "APP1",
        statut: "reprise",
        montantCents: 0,
        autofactureNumero: null,
        autofactureEmiseAt: null,
        avoirNumero: null,
        autofactureAttenteMotif: null,
        autofactureAttenteDepuis: null,
        litigeDepuis: null,
        litigeMotif: null,
        releveMois: null,
        verseeAt: null,
        majAt: new Date(),
        activite: "reprise",
        palier: null,
        parrainage: false,
        prixPublicHtCents: null,
        factureHtCents: 0,
        factureId: `F-${id}`,
        ...(a.data as Partial<Ligne>),
      } as Ligne);
      etat.lignes[etat.lignes.length - 1]!.id = id;
      return { id };
    },
    // La relation `apporteur` (select imbriqué) est jointe comme le ferait Prisma.
    findMany: async (a: { where: Record<string, V> }) =>
      lignes()
        .filter((l) => correspond(l, a.where))
        .map((l) => ({ ...l, apporteur: ficheDe(String(l["apporteurId"])) })),
    findUnique: async (a: { where: { id: string } }) =>
      lignes().find((l) => l["id"] === a.where.id) ?? null,
    count: async (a: { where: Record<string, V> }) =>
      lignes().filter((l) => correspond(l, a.where)).length,
    groupBy: async (a: {
      by: string[];
      where: Record<string, V>;
      _sum?: { montantCents: true };
    }) => {
      const vus = new Map<string, Record<string, V>>();
      for (const l of lignes().filter((x) => correspond(x, a.where))) {
        const cle = a.by.map((b) => String(l[b])).join("|");
        const cur = vus.get(cle) ?? {
          ...Object.fromEntries(a.by.map((b) => [b, l[b]])),
          _sum: { montantCents: 0 },
          _count: { _all: 0 },
        };
        (cur["_sum"] as { montantCents: number }).montantCents +=
          (l["montantCents"] as number) ?? 0;
        (cur["_count"] as { _all: number })._all += 1;
        vus.set(cle, cur);
      }
      return [...vus.values()];
    },
    aggregate: async (a: { where: Record<string, V> }) => ({
      _sum: {
        montantCents: lignes()
          .filter((l) => correspond(l, a.where))
          .reduce((s, l) => s + ((l["montantCents"] as number) ?? 0), 0),
      },
    }),
    updateMany: async (a: { where: Record<string, V>; data: Record<string, V> }) => {
      const cibles = lignes().filter((l) => correspond(l, a.where));
      for (const l of cibles) Object.assign(l, a.data);
      return { count: cibles.length };
    },
  },
  pieceAutofactureApporteur: {
    findFirst: async () => {
      tableAbsente();
      return etat.pieces[0] ?? null;
    },
    findMany: async (a: { where: { numero: { in: string[] } } }) => {
      tableAbsente();
      return etat.pieces.filter((p) => a.where.numero.in.includes(p.numero));
    },
    createMany: async (a: { data: Piece[]; skipDuplicates?: boolean }) => {
      tableAbsente();
      let n = 0;
      for (const p of a.data) {
        if (etat.pieces.some((x) => x.numero === p.numero)) continue;
        etat.pieces.push({ ...p });
        n += 1;
      }
      return { count: n };
    },
  },
  apporteurRegimeTvaChangement: {
    findFirst: async (a: { where: Record<string, V> }) => {
      tableAbsente();
      return (
        etat.changements
          .filter((c) => correspond(c as never, a.where as never))
          .sort(
            (x, y) =>
              y.effetAu.getTime() - x.effetAu.getTime() ||
              y.saisiAt.getTime() - x.saisiAt.getTime(),
          )[0] ?? null
      );
    },
    findMany: async (a: { where: Record<string, V> }) => {
      tableAbsente();
      return etat.changements
        .filter((c) => correspond(c as never, a.where as never))
        .sort(
          (x, y) =>
            x.effetAu.getTime() - y.effetAu.getTime() || x.saisiAt.getTime() - y.saisiAt.getTime(),
        );
    },
    findUnique: async (a: { where: { id: string } }) => {
      tableAbsente();
      return etat.changements.find((c) => c.id === a.where.id) ?? null;
    },
    create: async (a: { data: Omit<Changement, "id" | "saisiAt" | "annuleAt"> }) => {
      tableAbsente();
      const c: Changement = {
        ...a.data,
        id: `chg-${(etat.seq += 1)}`,
        saisiAt: new Date(Date.UTC(2026, 10, 1, 0, 0, etat.seq)),
        annuleAt: null,
      };
      etat.changements.push(c);
      return { id: c.id };
    },
    updateMany: async (a: { where: Record<string, V>; data: Record<string, V> }) => {
      tableAbsente();
      const cibles = etat.changements.filter((c) => correspond(c as never, a.where as never));
      for (const c of cibles) Object.assign(c, a.data);
      return { count: cibles.length };
    },
  },
  pieceApporteur: {
    findMany: async () => [
      {
        type: "vigilance",
        statut: "conforme",
        expireAt: new Date("2027-06-01T00:00:00Z"),
        remplaceeAt: null,
      },
      { type: "immatriculation", statut: "conforme", expireAt: null, remplaceeAt: null },
    ],
  },
  emailLog: {
    count: async (a: { where: { jobId: string } }) => (etat.jobIds.has(a.where.jobId) ? 1 : 0),
  },
  numeroEmis: { findMany: async () => [], count: async () => 0 },
  $executeRaw: async () => 0,
  $queryRaw: async () => [],
  factureFormation: { findMany: async () => [] },
  activityLog: {
    create: async (a: { data: Record<string, unknown> }) => {
      etat.journal.push(a.data);
      return {};
    },
    findMany: async () => [],
  },
  $transaction: async (cb: (tx: unknown) => unknown) => cb(prisma),
};

export const ligne = (
  id: string,
  statut: string,
  montantCents: number,
  surcharge: Partial<Ligne> = {},
): Ligne => ({
  id,
  apporteurId: "APP1",
  statut,
  montantCents,
  autofactureNumero: null,
  autofactureEmiseAt: null,
  avoirNumero: null,
  autofactureAttenteMotif: null,
  autofactureAttenteDepuis: null,
  litigeDepuis: null,
  litigeMotif: null,
  releveMois: null,
  verseeAt: null,
  majAt: new Date("2026-10-01T00:00:00Z"),
  activite: statut === "reprise" ? "reprise" : "audit",
  palier: null,
  parrainage: false,
  prixPublicHtCents: null,
  factureHtCents: 100_000,
  factureId: `F-${id}`,
  ...surcharge,
});
