// Faux Prisma en mémoire pour les tests du constat des primes de challenge (lot I, #2464). Valeurs fictives.
export interface Etat {
  challenges: Array<Record<string, unknown>>;
  commissions: Array<Record<string, unknown>>;
  factures: Array<Record<string, unknown>>;
  devis: Array<Record<string, unknown>>;
  paiements: Map<string, Date | null>;
  primes: Array<Record<string, unknown>>;
  alertes: string[];
  refuserCreation: boolean;
}

export const CH = "5b0c7e0e-6f0e-4d57-9a64-0d9d6b1f4a10";
export const A1 = "a1000000-0000-4000-8000-000000000001";
export const A2 = "a2000000-0000-4000-8000-000000000002";
export const A3 = "a3000000-0000-4000-8000-000000000003";

export function neuf(): Etat {
  return {
    challenges: [challenge()],
    commissions: [],
    factures: [],
    devis: [],
    paiements: new Map(),
    primes: [],
    alertes: [],
    refuserCreation: false,
  };
}

export function challenge(o: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: CH,
    titre: "Challenge de décembre",
    debutLe: new Date("2026-12-01T00:00:00Z"),
    finLe: new Date("2026-12-31T00:00:00Z"),
    paiementJusquAu: new Date("2027-03-31T00:00:00Z"),
    produit: "journee-ia",
    seuil: 10,
    primeHtCents: 200_000,
    statut: "publie",
    ...o,
  };
}

let n = 0;
/** Une commande de `journees` Journées IA, facturée à `emiseAt`, payée en entier à `payeLe`. */
export function commande(
  e: Etat,
  o: {
    apporteurId: string;
    journees: number;
    emiseAt?: string;
    payeLe?: string | null;
    montantHtCents?: number;
    avoirHtCents?: number;
    parrainage?: boolean;
    statut?: string;
    journeeIa?: boolean;
  },
): string {
  n += 1;
  const id = `f${String(n).padStart(7, "0")}-0000-4000-8000-000000000000`;
  const devisId = `d${String(n).padStart(7, "0")}-0000-4000-8000-000000000000`;
  const emiseAt = new Date(o.emiseAt ?? "2026-12-10T10:00:00Z");
  e.devis.push({
    id: devisId,
    journeeIa: o.journeeIa ?? true,
    lignes: [{ offreCode: "journee-ia", designation: "Journée IA", quantite: o.journees }],
  });
  e.factures.push({
    id,
    devisId,
    numero: `FA-${n}`,
    statut: "payee",
    avoirDeId: null,
    montantHtCents: o.montantHtCents ?? 150_000 * o.journees,
    emiseAt,
    paidAt: new Date(o.payeLe === undefined ? "2026-12-20T10:00:00Z" : (o.payeLe ?? "x")),
  });
  if (o.avoirHtCents)
    e.factures.push({
      id: `${id}-avoir`,
      devisId,
      numero: `AV-${n}`,
      statut: "payee",
      avoirDeId: id,
      montantHtCents: -o.avoirHtCents,
      emiseAt,
      paidAt: emiseAt,
    });
  e.paiements.set(id, o.payeLe === null ? null : new Date(o.payeLe ?? "2026-12-20T10:00:00Z"));
  e.commissions.push({
    id: `c${id}`,
    apporteurId: o.apporteurId,
    factureId: id,
    parrainage: o.parrainage ?? false,
    activite: "formation",
    statut: o.statut ?? "due",
  });
  return id;
}

const ok = (v: unknown, c: unknown): boolean => {
  if (c && typeof c === "object") {
    const o = c as { in?: unknown[]; notIn?: unknown[]; not?: unknown };
    if (o.in) return o.in.includes(v);
    if (o.notIn) return !o.notIn.includes(v);
    if ("not" in o) return v !== o.not;
  }
  return v === c;
};
const filtre = (rows: Array<Record<string, unknown>>, w: Record<string, unknown> = {}) =>
  rows.filter((r) => Object.entries(w).every(([k, c]) => k === "OR" || ok(r[k], c)));

export function creerPrisma(e: Etat) {
  return {
    challengeApporteur: {
      findMany: async (a: { where?: Record<string, unknown> }) => filtre(e.challenges, a.where),
    },
    commissionApporteur: {
      findMany: async (a: { where?: Record<string, unknown> }) => filtre(e.commissions, a.where),
    },
    factureFormation: {
      findMany: async (a: {
        where: { OR?: Array<Record<string, { in: string[] }>> } & Record<string, unknown>;
      }) => {
        const ors = a.where.OR ?? [];
        return e.factures.filter((f) =>
          ors.some((c) => Object.entries(c).some(([k, v]) => v.in.includes(f[k] as string))),
        );
      },
    },
    devis: { findMany: async (a: { where?: Record<string, unknown> }) => filtre(e.devis, a.where) },
    challengePrime: {
      findMany: async (a: { where?: Record<string, unknown> }) => filtre(e.primes, a.where),
      create: async (a: { data: Record<string, unknown> }) => {
        if (e.refuserCreation) throw new Error("une seule prime par période");
        if (
          e.primes.some(
            (p) =>
              p["challengeId"] === a.data["challengeId"] &&
              p["apporteurId"] === a.data["apporteurId"],
          )
        )
          throw new Error("unique");
        const p = { id: `p${e.primes.length + 1}`, statut: "a_valider", ...a.data };
        e.primes.push(p);
        return p;
      },
      update: async (a: { where: { id: string }; data: Record<string, unknown> }) => {
        const p = e.primes.find((x) => x["id"] === a.where.id)!;
        Object.assign(p, a.data);
        return p;
      },
    },
  };
}
