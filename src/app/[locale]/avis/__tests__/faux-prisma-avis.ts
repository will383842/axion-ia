// Faux `prisma.customerReview` en mémoire pour les tests de la règle automatique
// des avis. Il APPLIQUE les filtres `where` (dont `status`) au lieu de renvoyer
// une valeur fixe : un avis `hidden`, `pending`, `rejected` ou `archived` n'est
// exclu que si le code testé filtre réellement sur `status: "published"`.

type Statut = "published" | "pending" | "hidden" | "rejected" | "archived";

export interface FauxAvis {
  id: string;
  slug: string;
  status: Statut;
  rating: number;
  serviceLine: string | null;
  clientSector: string | null;
  citySlug: string | null;
  cityName: string | null;
  departmentCode: string | null;
  regionSlug: string | null;
  authorFirstName: string;
  authorLastInitial: string;
  companyName: string | null;
  title: string | null;
  comment: string;
  photoKind: string | null;
  photoUrl: string | null;
  photoAlt: string | null;
  replyBody: string | null;
  repliedAt: Date | null;
  isVerified: boolean;
  featured: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

let n = 0;
export function unAvis(partiel: Partial<FauxAvis> = {}): FauxAvis {
  n += 1;
  const date = new Date("2026-10-01T10:00:00Z");
  return {
    id: `avis-${n}`,
    slug: `avis-test-${n}`,
    status: "published",
    rating: 5,
    serviceLine: "audits",
    clientSector: null,
    citySlug: null,
    cityName: null,
    departmentCode: null,
    regionSlug: null,
    authorFirstName: `Prénom${n}`,
    authorLastInitial: "T.",
    companyName: null,
    title: `Titre de l'avis ${n}`,
    comment: `Commentaire unique de l'avis numéro ${n}.`,
    photoKind: null,
    photoUrl: null,
    photoAlt: null,
    replyBody: null,
    repliedAt: null,
    isVerified: false,
    featured: false,
    publishedAt: date,
    createdAt: date,
    updatedAt: date,
    ...partiel,
  };
}

/** Un avis de chaque statut NON publié. */
export function avisNonPublies(): FauxAvis[] {
  return (["pending", "hidden", "rejected", "archived"] as const).map((status) =>
    unAvis({ status, comment: `AVIS-${status.toUpperCase()}-INVISIBLE` }),
  );
}

type Where = Record<string, unknown> | undefined;

function correspond(a: FauxAvis, where: Where): boolean {
  if (!where) return true;
  for (const [cle, attendu] of Object.entries(where)) {
    if (cle === "OR") {
      const ou = attendu as Where[];
      if (!ou.some((w) => correspond(a, w))) return false;
      continue;
    }
    const valeur = (a as unknown as Record<string, unknown>)[cle];
    if (attendu !== null && typeof attendu === "object" && !(attendu instanceof Date)) {
      const op = attendu as Record<string, unknown>;
      if ("not" in op && valeur === op["not"]) return false;
      if ("contains" in op) {
        const aiguille = String(op["contains"]).toLowerCase();
        if (
          !String(valeur ?? "")
            .toLowerCase()
            .includes(aiguille)
        )
          return false;
      }
      continue;
    }
    if (valeur !== attendu) return false;
  }
  return true;
}

export function fauxCustomerReview(base: { avis: FauxAvis[] }) {
  const filtrer = (where: Where) => base.avis.filter((a) => correspond(a, where));
  return {
    count: async ({ where }: { where?: Where } = {}) => filtrer(where).length,
    findMany: async ({
      where,
      skip = 0,
      take,
    }: { where?: Where; skip?: number; take?: number } = {}) => {
      const tous = filtrer(where);
      return tous.slice(skip, take === undefined ? undefined : skip + take);
    },
    findFirst: async ({ where }: { where?: Where } = {}) => filtrer(where)[0] ?? null,
    aggregate: async ({ where }: { where?: Where } = {}) => {
      const tous = filtrer(where);
      const somme = tous.reduce((s, a) => s + a.rating, 0);
      return {
        _count: { _all: tous.length },
        _avg: { rating: tous.length ? somme / tous.length : null },
      };
    },
    groupBy: async ({ by, where }: { by: string[]; where?: Where }) => {
      const champ = by[0]!;
      const groupes = new Map<unknown, number>();
      for (const a of filtrer(where)) {
        const cle = (a as unknown as Record<string, unknown>)[champ];
        groupes.set(cle, (groupes.get(cle) ?? 0) + 1);
      }
      return [...groupes].map(([cle, total]) => ({ [champ]: cle, _count: { _all: total } }));
    },
  };
}
