/**
 * Fausse base À ÉTAT pour les specs de la facture du lendemain.
 *
 * Elle ne simule que ce que lisent `facture-auto-regles.ts` et
 * `facture-auto-session.ts`, et elle HONORE les filtres qu'ils posent (`in`,
 * `OR`, `sessionId: null`, bornes de date) : une fausse base qui rendrait tout
 * laisserait passer une requête fausse en vert.
 */

import { vi } from "vitest";

export type FactureFausse = {
  id: string;
  numero: string;
  sessionId: string | null;
  clientId: string | null;
  devisId: string | null;
  dossierFinancementId: string | null;
  destinataireNom: string;
  destinataire: string;
  activite: string | null;
  statut: string;
  montantHtCents: number;
  documentId: string | null;
  avoirDeId: string | null;
  emiseAt: Date | null;
  createdAt: Date;
  avoirs: Array<{ statut: string; montantHtCents: number }>;
};

export type JournalFaux = {
  action: string;
  targetType: string | null;
  targetId: string | null;
  createdAt: Date;
  changes?: unknown;
};

export interface EtatFaux {
  sessions: Array<Record<string, unknown>>;
  factures: FactureFausse[];
  journaux: JournalFaux[];
  outbox: Array<{ template: string; entityId: string | null; payload: unknown; createdAt: Date }>;
  logsEmail: Array<{ template: string; entityId: string | null }>;
  reglages: Map<string, unknown>;
  verrous: Set<string>;
}

export function etatVide(): EtatFaux {
  return {
    sessions: [],
    factures: [],
    journaux: [],
    outbox: [],
    logsEmail: [],
    reglages: new Map(),
    verrous: new Set(),
  };
}

type Where = Record<string, unknown>;

function dansIn(valeur: unknown, filtre: unknown): boolean {
  if (filtre === undefined) return true;
  if (filtre === null) return valeur === null;
  if (typeof filtre === "object" && filtre !== null) {
    const f = filtre as Record<string, unknown>;
    if (Array.isArray(f["in"])) return (f["in"] as unknown[]).includes(valeur);
    if (Array.isArray(f["notIn"])) return !(f["notIn"] as unknown[]).includes(valeur);
    if ("not" in f) return valeur !== f["not"];
    if ("equals" in f) return valeur === f["equals"];
    if (valeur instanceof Date || valeur === null) {
      const t = valeur === null ? null : (valeur as Date).getTime();
      if (f["gte"] instanceof Date && (t === null || t < (f["gte"] as Date).getTime()))
        return false;
      if (f["lte"] instanceof Date && (t === null || t > (f["lte"] as Date).getTime()))
        return false;
      return true;
    }
  }
  return valeur === filtre;
}

function correspond(ligne: Record<string, unknown>, where: Where | undefined): boolean {
  if (where === undefined) return true;
  for (const [cle, filtre] of Object.entries(where)) {
    if (cle === "OR") {
      if (!(filtre as Where[]).some((w) => correspond(ligne, w))) return false;
      continue;
    }
    if (cle === "AND") {
      if (!(filtre as Where[]).every((w) => correspond(ligne, w))) return false;
      continue;
    }
    if (!dansIn(ligne[cle], filtre)) return false;
  }
  return true;
}

function vueSession(etat: EtatFaux, s: Record<string, unknown>) {
  return {
    ...s,
    facturesFormation: etat.factures
      .filter((f) => f.sessionId === s["id"] && f.avoirDeId === null)
      .map((f) => ({ ...f })),
  };
}

/** Le client Prisma simulé, à passer à `vi.mock("@/lib/prisma", …)`. */
export function faussePrisma(etat: EtatFaux, journal: ReturnType<typeof vi.fn>) {
  return {
    trainingSession: {
      findMany: vi.fn(async (args?: { where?: Where }) =>
        etat.sessions
          .filter((s) => {
            const w = args?.where ?? {};
            return dansIn(s["statut"], w["statut"]) && dansIn(s["dateFin"], w["dateFin"]);
          })
          .map((s) => vueSession(etat, s)),
      ),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const s = etat.sessions.find((x) => x["id"] === where.id);
        return s ? vueSession(etat, s) : null;
      }),
    },
    factureFormation: {
      findMany: vi.fn(async (args?: { where?: Where }) =>
        etat.factures
          .filter((f) => correspond(f as unknown as Record<string, unknown>, args?.where))
          .map((f) => ({ ...f })),
      ),
    },
    activityLog: {
      findMany: vi.fn(async (args?: { where?: Where }) =>
        etat.journaux.filter((j) =>
          correspond(j as unknown as Record<string, unknown>, args?.where),
        ),
      ),
      create: vi.fn(async (args: { data: JournalFaux }) => {
        etat.journaux.push({ ...args.data, createdAt: new Date() });
        return journal(args);
      }),
    },
    emailOutbox: {
      findMany: vi.fn(async (args?: { where?: Where }) =>
        etat.outbox.filter((o) => correspond(o as unknown as Record<string, unknown>, args?.where)),
      ),
    },
    emailLog: {
      findMany: vi.fn(async (args?: { where?: Where }) =>
        etat.logsEmail.filter((o) =>
          correspond(o as unknown as Record<string, unknown>, args?.where),
        ),
      ),
    },
    siteSetting: {
      findUnique: vi.fn(async ({ where }: { where: { key: string } }) =>
        etat.reglages.has(where.key) ? { value: etat.reglages.get(where.key) } : null,
      ),
      upsert: vi.fn(async (args: { where: { key: string }; update: { value: unknown } }) => {
        etat.reglages.set(args.where.key, args.update.value);
        return {};
      }),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tenues: string[] = [];
      const tx = {
        $queryRaw: async (_s: TemplateStringsArray, ...valeurs: unknown[]) => {
          const cle = String(valeurs[0]);
          if (etat.verrous.has(cle)) return [{ acquis: false }];
          etat.verrous.add(cle);
          tenues.push(cle);
          return [{ acquis: true }];
        },
      };
      try {
        return await fn(tx);
      } finally {
        for (const c of tenues) etat.verrous.delete(c);
      }
    }),
  };
}

/** Session directe, fiche complète — éligible à l'automate. */
export function sessionEligible(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    numero: `AXI-SESS-2026-${id}`,
    titreSession: "Formation test",
    statut: "realisee",
    dateDebut: new Date("2026-10-05T07:00:00.000Z"),
    dateFin: new Date("2026-10-05T14:00:00.000Z"),
    montantHtCents: 150000,
    interEntreprises: false,
    financementType: "direct",
    opcoSubrogation: false,
    clientId: "client-1",
    devisId: null,
    client: {
      type: "entreprise",
      raisonSociale: "Acme",
      siret: "12345678900011",
      adresse: "1 rue de l'Exemple, 00000 Ville",
      adresseRue: null,
      adresseCodePostal: null,
      adresseVille: null,
      tvaIntracom: null,
      opcoIdentifie: null,
      contactEmail: "compta@acme.test",
    },
    dossiersFinancement: [],
    ...over,
  };
}

export function factureFausse(over: Partial<FactureFausse> = {}): FactureFausse {
  return {
    id: "f-1",
    numero: "AXI-FACT-2026-070",
    sessionId: "s-1",
    clientId: "client-1",
    devisId: null,
    dossierFinancementId: null,
    destinataireNom: "Acme",
    destinataire: "entreprise",
    activite: "formation",
    statut: "emise",
    montantHtCents: 150000,
    documentId: "doc-1",
    avoirDeId: null,
    emiseAt: new Date("2026-10-06T07:30:00.000Z"),
    createdAt: new Date("2026-10-06T07:30:00.000Z"),
    avoirs: [],
    ...over,
  };
}
