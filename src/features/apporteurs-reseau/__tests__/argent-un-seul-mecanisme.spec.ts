import { beforeEach, describe, expect, it, vi } from "vitest";

// Décision du 25/11 : la commission suit l'argent GARDÉ, par UN SEUL mécanisme. Simulation de bout
// en bout sur une base EN MÉMOIRE : le passage (étape « commissions » puis « avoirs-clients ») et
// la reprise après avoir tournent pour de vrai (avoir-client, ajustement, enregistrerReprise),
// dans un ordre quelconque. Cas de base : devis 2 000 € HT, intégration 15 % = 300 €, parrain 30 €.
//
// Invariant (propriété) : après CHAQUE passage, la somme vivante de chaque apporteur (montants −
// reprises + compléments, lignes annulées ou retenues écartées) ne dépasse jamais la cible de
// l'état de la commande ; et jamais deux apporteurs payés pour la même commande.

type Row = Record<string, unknown>;

const s = vi.hoisted(() => ({
  factures: [] as Row[],
  commissions: [] as Row[],
  presentations: [] as Row[],
  horloge: new Date("2026-09-01T08:00:00Z"),
  n: 0,
  alertes: [] as Array<{ code: string | undefined; jobId: string | undefined }>,
}));

const OPS = ["in", "notIn", "not", "gt", "gte", "lt", "lte", "startsWith", "equals"];
function matchVal(v: unknown, cond: unknown): boolean {
  if (cond === undefined) return true;
  if (cond === null) return v === null || v === undefined;
  if (cond instanceof Date) return v instanceof Date && v.getTime() === cond.getTime();
  if (typeof cond !== "object") return v === cond;
  const c = cond as Record<string, unknown>;
  if (Object.keys(c).some((k) => OPS.includes(k))) {
    if ("in" in c && !(c.in as unknown[]).includes(v)) return false;
    if ("notIn" in c && (c.notIn as unknown[]).includes(v)) return false;
    if ("not" in c) {
      if (c.not === null) {
        if (v === null || v === undefined) return false;
      } else if (typeof c.not === "object" && !(c.not instanceof Date)) {
        if (matchVal(v, c.not)) return false;
      } else if (v === c.not) return false;
    }
    if ("equals" in c && v !== c.equals) return false;
    if ("gt" in c && !((v as number) > (c.gt as number))) return false;
    if ("gte" in c && !((v as number) >= (c.gte as number))) return false;
    if ("lt" in c && !((v as number) < (c.lt as number))) return false;
    if ("lte" in c && !((v as number) <= (c.lte as number))) return false;
    if ("startsWith" in c && !(typeof v === "string" && v.startsWith(c.startsWith as string)))
      return false;
    return true;
  }
  return v !== null && typeof v === "object" && match(v as Row, c);
}
function match(o: Row, where: Row | undefined): boolean {
  for (const [k, cond] of Object.entries(where ?? {})) {
    if (k === "OR") {
      if (!(cond as Row[]).some((w) => match(o, w))) return false;
    } else if (k === "AND") {
      if (!(cond as Row[]).every((w) => match(o, w))) return false;
    } else if (k === "NOT") {
      continue; // factures d'essai : aucune dans la simulation
    } else if (!matchVal(o[k], cond)) return false;
  }
  return true;
}

vi.mock("@/lib/prisma", () => {
  const copie = (r: Row) => ({ ...r });
  const commissionApporteur = {
    findMany: vi.fn(async (a?: { where?: Row }) =>
      s.commissions.filter((c) => match(c, a?.where)).map(copie),
    ),
    findFirst: vi.fn(async (a?: { where?: Row }) => {
      const c = s.commissions.find((x) => match(x, a?.where));
      return c ? copie(c) : null;
    }),
    findUnique: vi.fn(async (a: { where: { id: string } }) => {
      const c = s.commissions.find((x) => x.id === a.where.id);
      return c ? copie(c) : null;
    }),
    create: vi.fn(async (a: { data: Row }) => {
      const d = a.data;
      if (
        !String(d.palier ?? "").includes(":") &&
        s.commissions.some(
          (c) =>
            c.factureId === d.factureId &&
            c.apporteurId === d.apporteurId &&
            !!c.parrainage === !!d.parrainage,
        )
      )
        throw Object.assign(new Error("unique"), { code: "P2002" });
      s.n += 1;
      const row: Row = {
        id: `L${s.n}`,
        presentationId: null,
        parrainage: false,
        palier: null,
        prixPublicHtCents: null,
        factureHtCents: 0,
        montantCents: null,
        autofactureNumero: null,
        autofactureEmiseAt: null,
        verseeAt: null,
        litigeDepuis: null,
        litigeMotif: null,
        creeAt: new Date(s.horloge),
        ...d,
      };
      s.commissions.push(row);
      return copie(row);
    }),
    updateMany: vi.fn(async (a: { where: Row; data: Row }) => {
      let count = 0;
      for (const c of s.commissions) {
        if (match(c, a.where)) {
          Object.assign(c, a.data);
          count += 1;
        }
      }
      return { count };
    }),
    update: vi.fn(async (a: { where: { id: string }; data: Row }) => {
      const c = s.commissions.find((x) => x.id === a.where.id)!;
      Object.assign(c, a.data);
      return copie(c);
    }),
    groupBy: vi.fn(async () => []),
    count: vi.fn(async () => 0),
  };
  const prisma = {
    presentationEntreprise: {
      findMany: vi.fn(async () => s.presentations),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    presentationReservation: { findMany: vi.fn(async () => []) },
    factureFormation: {
      findMany: vi.fn(async (a: { where: Row }) =>
        s.factures.filter((f) => match(f, a.where)).map(copie),
      ),
      findUnique: vi.fn(async (a: { where: { id: string } }) => {
        const f = s.factures.find((x) => x.id === a.where.id);
        return f ? copie(f) : null;
      }),
    },
    commissionApporteur,
    activityLog: { create: vi.fn(async () => ({})) },
    apporteurReseau: {
      findUnique: vi.fn(async () => ({ noteInterne: null, prenom: "E", email: "e@x.fr" })),
      update: vi.fn(async () => ({})),
      findMany: vi.fn(async () => []),
    },
    pieceApporteur: { findMany: vi.fn(async () => []) },
    devis: { findMany: vi.fn(async () => []) },
    $executeRaw: vi.fn(async () => 1),
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  };
  return { prisma };
});

vi.mock("../etablissement-presentation", async (orig) => {
  const vrai = await orig<typeof import("../etablissement-presentation")>();
  return {
    ...vrai,
    lireEtablissements: async (ids: readonly string[]) =>
      new Map(ids.map((id) => [id, vrai.AVANT_2_6] as const)),
    lireSiretsDevis: async () => new Map(),
    lireDecisionsAAttribuer: async () => new Map(),
    lireAAttribuerEnAttente: async () => [],
    ouvrirAAttribuer: vi.fn(async () => true),
  };
});
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: unknown) => v }));
vi.mock("@/lib/destinataires-internes", () => ({ destinataireAlertesInternes: () => "w@x.fr" }));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: vi.fn(async (_g: string, _d: string, _l: string, p: { code?: string }, o) => {
    s.alertes.push({ code: p?.code, jobId: (o as { jobId?: string })?.jobId });
    return { enqueued: true };
  }),
}));
vi.mock("../envois", () => ({ envoyer: vi.fn(async () => "envoye") }));
vi.mock("../jeton", () => ({ urlDossier: () => null }));
vi.mock("../alerte-vigilance", () => ({ alerterPiecesVigilanceDeposees: vi.fn(async () => 0) }));
vi.mock("../facturation", () => ({
  facturerCommissionsDues: vi.fn(async () => ({
    autofactures: 0,
    commissions: 0,
    ecartees: 0,
    erreurs: 0,
  })),
}));
vi.mock("../litige", () => ({ litigeDisponible: async () => true }));
vi.mock("../signaler", () => ({ signalerErreurReseau: vi.fn() }));
vi.mock("../commissions", () => ({
  libererSiPiecesValides: vi.fn(async () => 0),
  relancerVigilance: vi.fn(async () => false),
  demanderVigilance: vi.fn(async () => "deja"),
  dejaEnvoye: vi.fn(async (jobId: string) => s.alertes.some((a) => a.jobId === jobId)),
  piecesVigilanceValides: vi.fn(async () => true),
  statutApresVigilance: vi.fn(async () => ({ statut: "due", demander: false })),
}));
vi.mock("../manquement", () => ({
  regenererAvoirsSansPiece: vi.fn(async () => undefined),
  retenir: vi.fn(async (l: { id: string }) => {
    const c = s.commissions.find((x) => x.id === l.id)!;
    c.statut = "retenue";
    return { ok: true, numero: `AV-${l.id}` };
  }),
}));

import { reprendreApresAvoirsClients } from "../avoir-client";
import { passerFacturationApporteurs } from "../passage-quotidien";

// ── Le monde ─────────────────────────────────────────────────────────────

const presentation = (id: string, apporteurId: string, parrainId: string | null = null) => ({
  id,
  apporteurId,
  siren: "123456782",
  denomination: "Acme",
  statut: "confirmee",
  recueAt: new Date("2026-08-01T00:00:00Z"),
  confirmeeAt: new Date("2026-08-05T00:00:00Z"),
  protegeeJusquAt: new Date("2027-02-05T00:00:00Z"),
  apporteur: {
    prenom: "A",
    nom: "B",
    email: "a@b.fr",
    parrainId,
    signeParSocieteAt: parrainId ? new Date("2026-06-01T00:00:00Z") : null,
    // Contrat 2.8 : grille v3 (décision du 27/11, la version signée choisit la grille).
    signatureApporteur: { version: "2.8" },
  },
});

const avancer = () => {
  s.horloge = new Date(s.horloge.getTime() + 24 * 3_600_000);
};
const facture = (id: string, cents: number, statut = "payee", devisId: string | null = "D1") => {
  avancer();
  s.factures.push({
    id,
    devisId,
    statut,
    avoirDeId: null,
    activite: "implementation",
    montantHtCents: cents,
    emiseAt: new Date(s.horloge),
    createdAt: new Date(s.horloge),
    planRecurrentId: null,
    devis: devisId
      ? { acceptedAt: new Date("2026-08-20T00:00:00Z"), montantTotalHtCents: 200_000 }
      : null,
    client: { siren: "123456782", siret: null },
  });
};
const payer = (id: string) => {
  avancer();
  s.factures.find((f) => f.id === id)!.statut = "payee";
};
const avoir = (id: string, de: string, cents: number) => {
  avancer();
  const d = s.factures.find((f) => f.id === de)!;
  s.factures.push({
    id,
    devisId: d.devisId,
    statut: "emise",
    avoirDeId: de,
    activite: "implementation",
    montantHtCents: -cents,
    emiseAt: new Date(s.horloge),
    createdAt: new Date(s.horloge),
    planRecurrentId: null,
    devis: d.devis,
    client: d.client,
  });
};
const annulerAvoir = (id: string) => {
  avancer();
  s.factures.find((f) => f.id === id)!.statut = "annulee";
};
/** L'autofacture puis le virement de toutes les lignes positives encore dues. */
const toutVerser = () => {
  avancer();
  for (const c of s.commissions) {
    if (c.statut === "due" && (c.montantCents as number) > 0 && !c.litigeDepuis) {
      c.autofactureNumero ??= `AF-${c.id as string}`;
      c.autofactureEmiseAt ??= new Date(s.horloge);
      c.statut = "versee";
      c.verseeAt = new Date(s.horloge);
    }
  }
};

const VIVANTS = (c: Row) => c.statut !== "annulee" && c.statut !== "retenue";
const vivant = (apporteurId: string) =>
  s.commissions
    .filter((c) => c.apporteurId === apporteurId && VIVANTS(c))
    .reduce((x, c) => x + ((c.montantCents as number | null) ?? 0), 0);

/** La cible de l'état de la commande : 15 % de min(base, net payé), parrain 10 % de la cible. */
function cible(): number {
  const membres = s.factures.filter(
    (f) => f.avoirDeId === null && f.statut !== "annulee" && f.statut !== "brouillon",
  );
  const payees = membres.filter((f) => f.statut === "payee");
  const ids = new Set(payees.map((f) => f.id));
  const net =
    payees.reduce((x, f) => x + (f.montantHtCents as number), 0) +
    s.factures
      .filter(
        (a) =>
          a.avoirDeId !== null &&
          ids.has(a.avoirDeId as string) &&
          a.statut !== "annulee" &&
          a.statut !== "brouillon",
      )
      .reduce((x, a) => x + (a.montantHtCents as number), 0);
  return Math.round((Math.max(0, Math.min(200_000, net)) * 1500) / 10_000);
}

type Ordre = "P" | "AP" | "PP";
async function passage(o: Ordre) {
  if (o === "AP") await reprendreApresAvoirsClients(new Date(s.horloge));
  await passerFacturationApporteurs(new Date(s.horloge));
  if (o === "PP") await passerFacturationApporteurs(new Date(s.horloge));
}

function invariant(filleuls: readonly string[], parrain: string | null) {
  const c = cible();
  const payes = filleuls.filter((a) => vivant(a) > 0);
  expect(payes.length, "jamais deux apporteurs payés").toBeLessThanOrEqual(1);
  for (const a of filleuls) expect(vivant(a), `vivant de ${a} ≤ cible`).toBeLessThanOrEqual(c);
  if (parrain)
    expect(vivant(parrain), "parrain ≤ 10 % de la cible").toBeLessThanOrEqual(Math.round(c / 10));
}

function rng(seed: number) {
  let x = seed;
  return () => {
    x = (x * 1_103_515_245 + 12_345) % 2_147_483_648;
    return x / 2_147_483_648;
  };
}
const ORDRES: Ordre[] = ["P", "AP", "PP"];

interface Scenario {
  nom: string;
  presentations: () => Row[];
  filleuls: string[];
  parrain: string | null;
  /** Chaque étape est un geste du monde ; un passage suit chaque étape. */
  etapes: Array<() => void>;
  attendu: Record<string, number>;
}

const P1 = () => [presentation("P1", "A1", "PAR")];

const SCENARIOS: Scenario[] = [
  {
    nom: "défaut 1 : facture unique, versée, avoir total, refaite payée → 300/30 (et non 600/60)",
    presentations: P1,
    filleuls: ["A1"],
    parrain: "PAR",
    etapes: [
      () => facture("F1", 200_000),
      toutVerser,
      () => avoir("AV1", "F1", 200_000),
      () => facture("SR", 200_000, "emise"),
      () => payer("SR"),
      toutVerser,
    ],
    attendu: { A1: 30_000, PAR: 3_000 },
  },
  {
    nom: "défaut 1 : acompte + solde versés, avoirs totaux, acompte seul refait payé → 90 (et non 180)",
    presentations: P1,
    filleuls: ["A1"],
    parrain: "PAR",
    etapes: [
      () => facture("AC", 60_000),
      () => facture("SO", 140_000),
      toutVerser,
      () => avoir("AVA", "AC", 60_000),
      () => avoir("AVS", "SO", 140_000),
      () => facture("R", 60_000),
      toutVerser,
    ],
    attendu: { A1: 9_000, PAR: 900 },
  },
  {
    nom: "défaut 3 : avoir sur le solde, refaite émise puis avoir total sur la refaite → 90, suspension levée",
    presentations: () => [presentation("P1", "A1")],
    filleuls: ["A1"],
    parrain: null,
    etapes: [
      () => facture("AC", 60_000),
      () => facture("SO", 140_000),
      () => avoir("AVS", "SO", 140_000),
      () => facture("SR", 140_000, "emise"),
      () => avoir("AVR", "SR", 140_000),
    ],
    attendu: { A1: 9_000 },
  },
  {
    nom: "défaut 4 : 90 versé + complément 210 versé, puis avoir total sur la refaite → 90",
    presentations: () => [presentation("P1", "A1")],
    filleuls: ["A1"],
    parrain: null,
    etapes: [
      () => facture("AC", 60_000),
      () => facture("SO", 140_000),
      () => avoir("AVS", "SO", 140_000),
      toutVerser,
      () => facture("SR", 140_000),
      toutVerser,
      () => avoir("AVR", "SR", 140_000),
    ],
    attendu: { A1: 9_000 },
  },
  {
    nom: "défaut 4 : 300 versé, reprise 210, complément 210 versé, puis avoir → 90",
    presentations: () => [presentation("P1", "A1")],
    filleuls: ["A1"],
    parrain: null,
    etapes: [
      () => facture("AC", 60_000),
      () => facture("SO", 140_000),
      toutVerser,
      () => avoir("AVS", "SO", 140_000),
      () => facture("SR", 140_000),
      toutVerser,
      () => avoir("AVR", "SR", 140_000),
    ],
    attendu: { A1: 9_000 },
  },
  {
    nom: "défaut 5 : avoir partiel repris, puis avoir ANNULÉ → la reprise est compensée (300)",
    presentations: () => [presentation("P1", "A1")],
    filleuls: ["A1"],
    parrain: null,
    etapes: [
      () => facture("F1", 200_000),
      toutVerser,
      () => avoir("AV1", "F1", 40_000),
      () => annulerAvoir("AV1"),
      toutVerser,
    ],
    attendu: { A1: 30_000 },
  },
];

beforeEach(() => {
  s.factures = [];
  s.commissions = [];
  s.alertes = [];
  s.n = 0;
  s.horloge = new Date("2026-09-01T08:00:00Z");
});

describe("un seul mécanisme : la somme vivante ne dépasse jamais la cible, quel que soit l'ordre", () => {
  for (const sc of SCENARIOS) {
    it(sc.nom, async () => {
      const hasard = rng(sc.nom.length * 7_919);
      // Ordre « P » partout, puis 12 ordres tirés au hasard (avoir avant/après, passage doublé).
      for (let essai = 0; essai < 13; essai += 1) {
        s.factures = [];
        s.commissions = [];
        s.alertes = [];
        s.n = 0;
        s.horloge = new Date("2026-09-01T08:00:00Z");
        s.presentations = sc.presentations();
        for (const geste of sc.etapes) {
          geste();
          const o = essai === 0 ? "P" : ORDRES[Math.floor(hasard() * ORDRES.length)]!;
          await passage(o);
          invariant(sc.filleuls, sc.parrain);
        }
        for (const [a, cents] of Object.entries(sc.attendu))
          expect(vivant(a), `${a} (essai ${essai})`).toBe(cents);
      }
    });
  }

  it("défaut 3 : la suspension automatique est levée quand la refaite est annulée par son avoir", async () => {
    s.presentations = [presentation("P1", "A1")];
    facture("AC", 60_000);
    facture("SO", 140_000);
    await passage("P");
    avoir("AVS", "SO", 140_000);
    await passage("P");
    facture("SR", 140_000, "emise");
    await passage("P");
    const c1 = s.commissions.find((c) => c.apporteurId === "A1" && !c.palier)!;
    expect(c1.litigeDepuis).not.toBeNull();
    avoir("AVR", "SR", 140_000);
    await passage("P");
    expect(c1.litigeDepuis).toBeNull();
    expect(c1.montantCents).toBe(9_000);
  });

  it("défaut 2 : A1 repris en totalité, A2 couvre la refaite → seul A2 est payé", async () => {
    for (const o of ORDRES) {
      s.factures = [];
      s.commissions = [];
      s.n = 0;
      s.presentations = [presentation("P1", "A1")];
      facture("F1", 200_000);
      await passage(o);
      toutVerser();
      avoir("AV1", "F1", 200_000);
      await passage(o);
      expect(vivant("A1")).toBe(0);
      s.presentations = [presentation("P2", "A2")];
      facture("SR", 200_000);
      await passage(o);
      toutVerser();
      await passage(o);
      expect(vivant("A2")).toBe(30_000);
      expect(vivant("A1")).toBe(0);
    }
  });

  it("défaut 7 : un complément hérite de la contestation saisie à la main sur sa ligne d'origine", async () => {
    s.presentations = [presentation("P1", "A1")];
    facture("AC", 60_000);
    facture("SO", 140_000);
    await passage("P");
    toutVerser();
    avoir("AVS", "SO", 140_000);
    await passage("P");
    const c1 = s.commissions.find((c) => c.apporteurId === "A1" && !c.palier)!;
    c1.litigeDepuis = new Date(s.horloge);
    c1.litigeMotif = "Contestation de l'entreprise (saisie par Williams).";
    facture("SR", 140_000);
    await passage("P");
    const complement = s.commissions.find((c) => String(c.palier ?? "").startsWith("complement"));
    expect(complement).toBeDefined();
    expect(complement!.litigeMotif).toBe("Contestation de l'entreprise (saisie par Williams).");
    expect(complement!.litigeDepuis).not.toBeNull();
  });

  it("défaut 6 : la part du parrain suit l'état final même si le filleul a remonté à un passage précédent", async () => {
    s.presentations = P1();
    facture("AC", 60_000);
    facture("SO", 140_000);
    await passage("P");
    avoir("AVS", "SO", 140_000);
    await passage("P");
    expect(vivant("A1")).toBe(9_000);
    expect(vivant("PAR")).toBe(900);
    facture("SR", 140_000);
    await passage("P");
    // Le filleul est remonté, mais la part du parrain est restée en arrière (passage interrompu).
    const part = s.commissions.find((c) => c.apporteurId === "PAR")!;
    part.montantCents = 900;
    await passage("P");
    expect(vivant("A1")).toBe(30_000);
    expect(vivant("PAR")).toBe(3_000);
  });
});
