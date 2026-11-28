/* eslint-disable @typescript-eslint/no-explicit-any -- double de base en mémoire */
/**
 * Base en mémoire pour les tests des annulations de rendez-vous : l'état est réel (unicité,
 * écritures conditionnelles, retour arrière d'une transaction), pas une suite de mocks.
 */
export type Ligne = Record<string, any>;

export const bd = {
  pres: [] as Ligne[],
  res: [] as Ligne[],
  props: [] as Ligne[],
  annulations: [] as Ligne[],
  calendly: [] as Ligne[],
  rencontres: [] as Ligne[],
  alertes: [] as Array<{ gabarit: string; payload: Record<string, any>; jobId: string }>,
  jobIds: new Set<string>(),
};

export function vider(): void {
  for (const k of [
    "pres",
    "res",
    "props",
    "annulations",
    "calendly",
    "rencontres",
    "alertes",
  ] as const)
    bd[k].length = 0;
  bd.jobIds.clear();
}

export function ok(row: Ligne, where: Ligne): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (k === "OR") return (v as Ligne[]).some((w) => ok(row, w));
    if (k === "AND") return (v as Ligne[]).every((w) => ok(row, w));
    // Logique SQL : `NOT (col = x)` est INCONNU (donc exclu) quand `col` vaut NULL.
    if (k === "NOT")
      return Object.entries(v as Ligne).every(
        ([c, w]) => row[c] !== null && row[c] !== undefined && !ok(row, { [c]: w }),
      );
    const x = row[k];
    if (v === null) return x === null || x === undefined;
    if (v instanceof Date) return x instanceof Date && x.getTime() === v.getTime();
    if (typeof v === "object") {
      const o = v as Ligne;
      if ("in" in o && !o.in.includes(x)) return false;
      const t = (d: unknown) => (d instanceof Date ? d.getTime() : Number.NaN);
      if ("lte" in o && !(t(x) <= t(o.lte))) return false;
      if ("lt" in o && !(t(x) < t(o.lt))) return false;
      if ("gte" in o && !(t(x) >= t(o.gte))) return false;
      if ("gt" in o && !(t(x) > t(o.gt))) return false;
      return true;
    }
    return x === v;
  });
}

const copie = (l: Ligne) => ({ ...l });
let compteur = 0;

function table(lignes: Ligne[]) {
  return {
    findMany: async (a: { where?: Ligne }) =>
      lignes.filter((l) => !a.where || ok(l, a.where)).map(copie),
    findFirst: async (a: { where?: Ligne }) => {
      const l = lignes.find((x) => !a.where || ok(x, a.where));
      return l ? copie(l) : null;
    },
    updateMany: async (a: { where: Ligne; data: Ligne }) => {
      const l = lignes.filter((x) => ok(x, a.where));
      for (const x of l) Object.assign(x, a.data);
      return { count: l.length };
    },
  };
}

export const fake: Ligne = {
  presentationEntreprise: table(bd.pres),
  presentationReservation: {
    ...table(bd.res),
    findUnique: async (a: { where: { presentationId: string } }) => {
      const r = bd.res.find((x) => x.presentationId === a.where.presentationId);
      return r ? copie(r) : null;
    },
  },
  propositionRendezVousPresentation: table(bd.props),
  annulationRendezVousPresentation: {
    ...table(bd.annulations),
    findUnique: async (a: { where: { id: string } }) => {
      const r = bd.annulations.find((x) => x.id === a.where.id);
      return r ? copie(r) : null;
    },
    createMany: async (a: { data: Ligne[]; skipDuplicates?: boolean }) => {
      let count = 0;
      for (const d of a.data) {
        const double = bd.annulations.some(
          (x) => x.presentationId === d.presentationId && x.rendezVousCle === d.rendezVousCle,
        );
        if (double) {
          if (a.skipDuplicates) continue;
          throw Object.assign(new Error("unique"), { code: "P2002" });
        }
        bd.annulations.push({
          id: `A${++compteur}`,
          auteur: null,
          qualifieeAt: null,
          qualifieePar: null,
          motif: null,
          reportCle: null,
          reportLieAt: null,
          validationFaiteAt: null,
          ...d,
        });
        count += 1;
      }
      return { count };
    },
  },
  calendlyEvent: {
    findUnique: async (a: { where: { id: string } }) => {
      const e = bd.calendly.find((x) => x.id === a.where.id);
      return e ? { rencontre: null, inviteeUri: null, ...e } : null;
    },
  },
  rencontre: {
    ...table(bd.rencontres),
    findUnique: async (a: { where: { id: string } }) => {
      const r = bd.rencontres.find((x) => x.id === a.where.id);
      return r ? copie(r) : null;
    },
  },
  activityLog: { create: async () => ({}) },
  $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
    const avant = { pres: bd.pres.map(copie), res: bd.res.map(copie) };
    try {
      return await fn(fake);
    } catch (e) {
      bd.pres.splice(0, bd.pres.length, ...avant.pres);
      bd.res.splice(0, bd.res.length, ...avant.res);
      throw e;
    }
  },
};

/** Remplace `enqueueEmail` : enregistre chaque envoi (gabarit, charge, jobId). */
export async function enqueueEmailFictif(
  gabarit: string,
  _to: unknown,
  _l: string,
  payload: Record<string, any>,
  opts: { jobId: string },
) {
  bd.alertes.push({ gabarit, payload, jobId: opts.jobId });
  bd.jobIds.add(opts.jobId);
  return { enqueued: true };
}
