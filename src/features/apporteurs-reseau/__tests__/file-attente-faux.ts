// Base en mémoire pour les tests de la file d'attente (art. 3.5). Comprend les filtres utilisés par `file-attente.ts`.

type Ligne = Record<string, unknown>;

function egal(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

function valeurOk(v: unknown, f: unknown): boolean {
  if (f && typeof f === "object" && !(f instanceof Date)) {
    const c = f as Record<string, unknown>;
    if ("in" in c) return (c.in as unknown[]).some((x) => egal(x, v));
    if ("not" in c) return !egal(v, c.not);
    if ("gte" in c) return v instanceof Date && v.getTime() >= (c.gte as Date).getTime();
    if ("gt" in c) return v instanceof Date && v.getTime() > (c.gt as Date).getTime();
    if ("lt" in c) return v instanceof Date && v.getTime() < (c.lt as Date).getTime();
  }
  return egal(v, f);
}

export function correspond(l: Ligne, where: Record<string, unknown> = {}): boolean {
  return Object.entries(where).every(([k, f]) => valeurOk(l[k], f));
}

export function creerFaux(init: { file?: Ligne[]; presentations?: Ligne[] } = {}) {
  const etat = {
    file: (init.file ?? []).map((l) => ({ ...l })),
    presentations: (init.presentations ?? []).map((l) => ({ ...l })),
    seq: 0,
  };
  const trier = (l: Ligne[]) =>
    [...l].sort(
      (a, b) =>
        (a.recueAt as Date).getTime() - (b.recueAt as Date).getTime() ||
        String(a.id).localeCompare(String(b.id)),
    );
  const declarationEnAttente = {
    findMany: async (a: { where?: Ligne; take?: number; orderBy?: unknown }) => {
      const r = trier(etat.file.filter((l) => correspond(l, a.where)));
      return a.orderBy && !Array.isArray(a.orderBy) ? r.reverse() : r;
    },
    findUnique: async (a: { where: Ligne }) =>
      etat.file.find((l) => correspond(l, a.where)) ?? null,
    findFirst: async (a: { where: Ligne }) => etat.file.find((l) => correspond(l, a.where)) ?? null,
    count: async (a: { where: Ligne }) => etat.file.filter((l) => correspond(l, a.where)).length,
    create: async (a: { data: Ligne }) => {
      const l = {
        id: `F${++etat.seq}`,
        clotureeAt: null,
        informeeAt: null,
        fenetreFinAt: null,
        ...a.data,
      };
      etat.file.push(l);
      return l;
    },
    updateMany: async (a: { where: Ligne; data: Ligne }) => {
      const ls = etat.file.filter((l) => correspond(l, a.where));
      for (const l of ls) Object.assign(l, a.data);
      return { count: ls.length };
    },
  };
  const presentationEntreprise = {
    findUnique: async (a: { where: { id: string } }) => {
      const p = etat.presentations.find((x) => x.id === a.where.id);
      return p ?? null;
    },
    count: async (a: { where: Ligne }) =>
      etat.presentations.filter((l) => correspond(l, a.where)).length,
  };
  const db = {
    declarationEnAttente,
    presentationEntreprise,
    presentationEtablissement: { findMany: async () => [] },
    apporteurReseau: {},
  };
  return { etat, db: db as never };
}

export const JOUR = 86_400_000;
export const D = (iso: string) => new Date(iso);
export function ligne(o: Partial<Record<string, unknown>> & { id: string }): Ligne {
  return {
    presentationId: `P-${o.id}`,
    apporteurId: `APP-${o.id}`,
    siren: "123456782",
    siret: "12345678200017",
    cleFile: "12345678200017",
    recueAt: D("2026-11-01T10:00:00Z"),
    statut: "en_attente",
    informeeAt: null,
    fenetreFinAt: null,
    clotureeAt: null,
    ...o,
  };
}
export function presentation(id: string, o: Partial<Record<string, unknown>> = {}): Ligne {
  return {
    id,
    siren: "123456782",
    apporteurId: `APP-${id}`,
    recueAt: D("2026-11-01T10:00:00Z"),
    denomination: "Acme",
    statut: "deja_connue",
    apporteur: { prenom: "Ana", nom: "Bel", email: "ana@x.fr" },
    ...o,
  };
}
