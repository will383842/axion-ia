/**
 * Tests — liste des sessions : fenêtre, pagination, moyenne de présence.
 *
 * Deux niveaux :
 *  - les règles PURES de `sessions-liste.ts` (fenêtre, bornes, arrondi) ;
 *  - l'orchestration de `listSessionsForAdmin`, avec un faux Prisma qui
 *    APPLIQUE réellement le `where`, le `skip`/`take` et l'agrégat. Un mock qui
 *    rendrait toujours le même tableau ne prouverait rien : c'est justement
 *    l'absence de filtre et de plafond qui est le défaut corrigé.
 *
 * Le faux `enrollment.groupBy` reproduit la sémantique d'`AVG` en Postgres :
 * les NULL ne comptent NI au numérateur NI au dénominateur, et un groupe sans
 * ligne n'existe pas du tout dans le résultat.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: {
      count: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    enrollment: {
      groupBy: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { listSessionsForAdmin } from "./queries";
import {
  arrondirTauxMoyen,
  bornesPagination,
  debutFenetreSessions,
  FENETRE_SESSIONS_MOIS,
  PAGE_SIZE_SESSIONS,
  parsePageParam,
} from "./sessions-liste";

// ─────────────────────────────────────────────────────────────────────────────
// Faux Prisma
// ─────────────────────────────────────────────────────────────────────────────

const mockPrisma = prisma as unknown as {
  trainingSession: {
    count: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  enrollment: { groupBy: ReturnType<typeof vi.fn> };
};

interface WhereSession {
  dateDebut?: { gte?: Date; lt?: Date };
}

interface ArgsFindMany {
  where?: WhereSession;
  skip?: number;
  take?: number;
  include?: unknown;
  select?: Record<string, unknown>;
}

interface ArgsAggregat {
  by?: ReadonlyArray<string>;
  where?: { sessionId?: { in?: string[] }; statut?: { notIn?: string[] } };
  _avg?: Record<string, boolean>;
}

interface FauxSession {
  id: string;
  dateDebut: Date;
  statut: string;
  nbInscrits: number;
}

interface FauxEnrollment {
  sessionId: string;
  statut: string;
  tauxPresencePct: number | null;
}

const MAINTENANT = new Date("2026-08-16T10:00:00.000Z");
const JOUR_MS = 24 * 60 * 60 * 1000;

function session(id: string, dateDebut: string, extra: Partial<FauxSession> = {}): FauxSession {
  return {
    id,
    dateDebut: new Date(dateDebut),
    statut: extra.statut ?? "realisee",
    nbInscrits: extra.nbInscrits ?? 0,
  };
}

/** `n` sessions consécutives (une par jour) à partir de `depuis`. */
function serie(prefixe: string, n: number, statut: string, depuis: Date): FauxSession[] {
  const out: FauxSession[] = [];
  for (let i = 0; i < n; i += 1) {
    const id = `${prefixe}${String(i).padStart(2, "0")}`;
    out.push({ id, dateDebut: new Date(depuis.getTime() + i * JOUR_MS), statut, nbInscrits: 0 });
  }
  return out;
}

function installerBase(sessions: FauxSession[], inscriptions: FauxEnrollment[] = []): void {
  const filtrer = (where?: WhereSession): FauxSession[] =>
    sessions.filter((s) => {
      const borne = where?.dateDebut;
      if (borne?.gte !== undefined && s.dateDebut.getTime() < borne.gte.getTime()) return false;
      if (borne?.lt !== undefined && s.dateDebut.getTime() >= borne.lt.getTime()) return false;
      return true;
    });

  mockPrisma.trainingSession.count.mockImplementation((args?: { where?: WhereSession }) =>
    Promise.resolve(filtrer(args?.where).length),
  );

  mockPrisma.trainingSession.groupBy.mockImplementation((args?: { where?: WhereSession }) => {
    const parStatut = new Map<string, number>();
    for (const s of filtrer(args?.where)) {
      parStatut.set(s.statut, (parStatut.get(s.statut) ?? 0) + 1);
    }
    const groupes = [...parStatut].map(([statut, n]) => ({ statut, _count: { _all: n } }));
    return Promise.resolve(groupes);
  });

  mockPrisma.trainingSession.findMany.mockImplementation((args?: ArgsFindMany) => {
    const triees = filtrer(args?.where).sort(
      (a, b) => b.dateDebut.getTime() - a.dateDebut.getTime() || (a.id < b.id ? 1 : -1),
    );
    const debut = args?.skip ?? 0;
    const fin = args?.take === undefined ? triees.length : debut + args.take;
    const page = triees.slice(debut, fin).map((s) => ({
      id: s.id,
      numero: `AXI-SESS-${s.id}`,
      titreSession: `Session ${s.id}`,
      formationId: `form-${s.id}`,
      dateDebut: s.dateDebut,
      dateFin: s.dateDebut,
      modalite: "presentiel",
      statut: s.statut,
      _count: { enrollments: s.nbInscrits },
      formation: { numero: "AXI-FORM-2026-001", titre: "IA générative" },
    }));
    return Promise.resolve(page);
  });

  mockPrisma.enrollment.groupBy.mockImplementation((args?: ArgsAggregat) => {
    const ids = args?.where?.sessionId?.in ?? [];
    const exclus = args?.where?.statut?.notIn ?? [];
    const parSession = new Map<string, Array<number | null>>();
    for (const e of inscriptions) {
      if (!ids.includes(e.sessionId)) continue;
      if (exclus.includes(e.statut)) continue;
      const valeurs = parSession.get(e.sessionId) ?? [];
      valeurs.push(e.tauxPresencePct);
      parSession.set(e.sessionId, valeurs);
    }
    const groupes = [...parSession].map(([sessionId, valeurs]) => {
      const mesures = valeurs.filter((v): v is number => v !== null);
      const somme = mesures.reduce((a, b) => a + b, 0);
      const moyenne = mesures.length === 0 ? null : somme / mesures.length;
      return { sessionId, _avg: { tauxPresencePct: moyenne } };
    });
    return Promise.resolve(groupes);
  });
}

function argsFindMany(): ArgsFindMany | undefined {
  return mockPrisma.trainingSession.findMany.mock.calls[0]?.[0] as ArgsFindMany | undefined;
}

function argsAggregat(): ArgsAggregat | undefined {
  return mockPrisma.enrollment.groupBy.mock.calls[0]?.[0] as ArgsAggregat | undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// Règles pures
// ─────────────────────────────────────────────────────────────────────────────

describe("debutFenetreSessions", () => {
  it("recule de douze mois exactement", () => {
    expect(debutFenetreSessions(MAINTENANT).toISOString()).toBe("2025-08-16T10:00:00.000Z");
  });

  it("ne modifie pas la date reçue", () => {
    const avant = MAINTENANT.toISOString();
    debutFenetreSessions(MAINTENANT);
    expect(MAINTENANT.toISOString()).toBe(avant);
  });

  it("annonce une fenêtre de douze mois", () => {
    expect(FENETRE_SESSIONS_MOIS).toBe(12);
  });
});

describe("bornesPagination", () => {
  it("borne la première page à un skip nul et au plafond de page", () => {
    const bornes = bornesPagination(1, 60);
    expect(bornes).toEqual({ page: 1, skip: 0, take: PAGE_SIZE_SESSIONS, totalPages: 3 });
  });

  it("décale le skip d'une page entière", () => {
    expect(bornesPagination(2, 60).skip).toBe(PAGE_SIZE_SESSIONS);
  });

  it("recadre une page au-delà du total sur la dernière page", () => {
    const bornes = bornesPagination(999, 60);
    expect(bornes.page).toBe(3);
    expect(bornes.skip).toBe(2 * PAGE_SIZE_SESSIONS);
  });

  it("recadre une page nulle ou négative sur la première", () => {
    expect(bornesPagination(0, 60).page).toBe(1);
    expect(bornesPagination(-4, 60).page).toBe(1);
  });

  it("rend « page 1 / 1 » sur une liste vide, jamais « page 1 / 0 »", () => {
    const bornes = bornesPagination(1, 0);
    expect(bornes).toEqual({ page: 1, skip: 0, take: PAGE_SIZE_SESSIONS, totalPages: 1 });
  });
});

describe("parsePageParam", () => {
  it("retombe sur la première page pour tout paramètre inexploitable", () => {
    expect(parsePageParam(undefined)).toBe(1);
    expect(parsePageParam(["2", "3"])).toBe(1);
    expect(parsePageParam("abc")).toBe(1);
    expect(parsePageParam("0")).toBe(1);
    expect(parsePageParam("-3")).toBe(1);
  });

  it("lit un entier valide", () => {
    expect(parsePageParam("7")).toBe(7);
  });
});

describe("arrondirTauxMoyen", () => {
  it("garde null quand rien n'est mesuré — un taux absent n'est pas un taux de zéro", () => {
    expect(arrondirTauxMoyen(null)).toBeNull();
    expect(arrondirTauxMoyen(undefined)).toBeNull();
  });

  it("conserve un zéro RÉELLEMENT mesuré", () => {
    expect(arrondirTauxMoyen(0)).toBe(0);
  });

  it("arrondit à l'entier", () => {
    expect(arrondirTauxMoyen(79.6)).toBe(80);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Moyenne de présence — calculée par SQL
// ─────────────────────────────────────────────────────────────────────────────

describe("listSessionsForAdmin — moyenne de présence", () => {
  it("demande la moyenne à Postgres et ne rapatrie AUCUNE ligne d'inscription", async () => {
    installerBase(
      [session("s1", "2026-06-01T08:00:00.000Z", { nbInscrits: 3 })],
      [
        { sessionId: "s1", statut: "presente", tauxPresencePct: 100 },
        { sessionId: "s1", statut: "presente", tauxPresencePct: 60 },
      ],
    );

    const liste = await listSessionsForAdmin({ maintenant: MAINTENANT });

    // 🔴 LE test du défaut D1 : la moyenne vient d'un agrégat SQL. Revenir au
    // calcul JavaScript exigerait les lignes d'inscription — c'est cela qui est
    // interdit ici, pas seulement le résultat affiché.
    expect(argsFindMany()?.include).toBeUndefined();
    expect(argsFindMany()?.select?.["enrollments"]).toBeUndefined();

    expect(argsAggregat()?.by).toEqual(["sessionId"]);
    expect(argsAggregat()?._avg).toEqual({ tauxPresencePct: true });
    // L'agrégat est borné aux sessions de la PAGE, jamais à toute la table.
    expect(argsAggregat()?.where?.sessionId?.in).toEqual(["s1"]);

    expect(liste.rows[0]?.tauxPresenceMoyen).toBe(80);
  });

  it("ignore les taux NON RENSEIGNÉS au lieu de les compter pour zéro", async () => {
    installerBase(
      [session("s1", "2026-06-01T08:00:00.000Z", { nbInscrits: 3 })],
      [
        { sessionId: "s1", statut: "presente", tauxPresencePct: 100 },
        { sessionId: "s1", statut: "presente", tauxPresencePct: 80 },
        { sessionId: "s1", statut: "planifiee", tauxPresencePct: null },
      ],
    );

    const liste = await listSessionsForAdmin({ maintenant: MAINTENANT });

    // Moyenne des DEUX taux mesurés (90), pas des trois inscrits (60).
    expect(liste.rows[0]?.tauxPresenceMoyen).toBe(90);
  });

  it("exclut les abandons et les exclusions de la moyenne", async () => {
    installerBase(
      [session("s1", "2026-06-01T08:00:00.000Z", { nbInscrits: 3 })],
      [
        { sessionId: "s1", statut: "presente", tauxPresencePct: 100 },
        { sessionId: "s1", statut: "abandon", tauxPresencePct: 10 },
        { sessionId: "s1", statut: "exclu", tauxPresencePct: 0 },
      ],
    );

    const liste = await listSessionsForAdmin({ maintenant: MAINTENANT });

    expect(argsAggregat()?.where?.statut?.notIn).toEqual(["abandon", "exclu"]);
    expect(liste.rows[0]?.tauxPresenceMoyen).toBe(100);
  });

  it("rend une moyenne NULLE — et non zéro — pour une session sans inscrit", async () => {
    installerBase([session("s1", "2026-06-01T08:00:00.000Z", { nbInscrits: 0 })], []);

    const liste = await listSessionsForAdmin({ maintenant: MAINTENANT });

    expect(liste.rows[0]?.nbInscrits).toBe(0);
    expect(liste.rows[0]?.tauxPresenceMoyen).toBeNull();
    expect(liste.rows[0]?.tauxPresenceMoyen).not.toBe(0);
  });

  it("rend une moyenne NULLE quand aucun inscrit n'a encore de taux", async () => {
    installerBase(
      [session("s1", "2026-06-01T08:00:00.000Z", { nbInscrits: 2 })],
      [
        { sessionId: "s1", statut: "planifiee", tauxPresencePct: null },
        { sessionId: "s1", statut: "planifiee", tauxPresencePct: null },
      ],
    );

    const liste = await listSessionsForAdmin({ maintenant: MAINTENANT });

    expect(liste.rows[0]?.tauxPresenceMoyen).toBeNull();
  });

  it("n'interroge pas l'agrégat quand la page est vide", async () => {
    installerBase([], []);

    await listSessionsForAdmin({ maintenant: MAINTENANT });

    expect(mockPrisma.enrollment.groupBy).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────────────────────────────────────

describe("listSessionsForAdmin — pagination", () => {
  /** 60 sessions échelonnées à partir du 1er juillet 2026 (dans la fenêtre). */
  function soixante(): FauxSession[] {
    return serie("s", 60, "realisee", new Date("2026-07-01T08:00:00.000Z"));
  }

  it("plafonne la lecture à une page et annonce le total réel", async () => {
    installerBase(soixante());

    const liste = await listSessionsForAdmin({ page: 1, maintenant: MAINTENANT });

    // 🔴 Sans `take`, la requête rapatriait la table entière : ce plafond est ce
    // qui empêche l'écran de s'allonger indéfiniment avec l'historique.
    expect(argsFindMany()?.take).toBe(PAGE_SIZE_SESSIONS);
    expect(argsFindMany()?.skip).toBe(0);
    expect(liste.rows).toHaveLength(PAGE_SIZE_SESSIONS);
    expect(liste.total).toBe(60);
    expect(liste.totalPages).toBe(3);
    expect(liste.page).toBe(1);
  });

  it("décale la page suivante sans recouvrement", async () => {
    installerBase(soixante());

    const page1 = await listSessionsForAdmin({ page: 1, maintenant: MAINTENANT });
    const page2 = await listSessionsForAdmin({ page: 2, maintenant: MAINTENANT });

    const ids1 = page1.rows.map((r) => r.id);
    const ids2 = page2.rows.map((r) => r.id);
    expect(ids2).toHaveLength(PAGE_SIZE_SESSIONS);
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
  });

  it("sert la dernière page — jamais un écran vide — quand la page demandée dépasse", async () => {
    installerBase(soixante());

    const liste = await listSessionsForAdmin({ page: 999, maintenant: MAINTENANT });

    expect(liste.page).toBe(3);
    expect(liste.rows).toHaveLength(10);
  });

  it("compte les statuts sur la FENÊTRE entière, pas sur la page affichée", async () => {
    const debut = new Date("2026-07-01T08:00:00.000Z");
    installerBase([
      ...serie("e", 30, "en_cours", debut),
      session("p1", "2026-06-05T08:00:00.000Z", { statut: "planifiee" }),
    ]);

    const liste = await listSessionsForAdmin({ page: 1, maintenant: MAINTENANT });

    expect(liste.rows).toHaveLength(PAGE_SIZE_SESSIONS);
    // 30 « en cours » alors que la page n'en montre que 25 : le compteur
    // interroge la base, il ne compte pas les lignes rendues.
    expect(liste.compteurs.enCours).toBe(30);
    expect(liste.compteurs.planifiees).toBe(1);
    expect(liste.compteurs.realisees).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fenêtre de douze mois et archives
// ─────────────────────────────────────────────────────────────────────────────

describe("listSessionsForAdmin — fenêtre de douze mois", () => {
  const base = (): FauxSession[] => [
    session("recente", "2026-06-01T08:00:00.000Z"),
    session("future", "2027-03-01T08:00:00.000Z", { statut: "planifiee" }),
    session("ancienne", "2024-01-15T08:00:00.000Z"),
  ];

  it("exclut par défaut ce qui précède la fenêtre, et le signale", async () => {
    installerBase(base());

    const liste = await listSessionsForAdmin({ maintenant: MAINTENANT });

    expect(liste.rows.map((r) => r.id)).not.toContain("ancienne");
    expect(liste.total).toBe(2);
    // L'ancienne n'est pas perdue : l'écran sait combien d'archives proposer.
    expect(liste.nbArchives).toBe(1);
    expect(liste.avecArchives).toBe(false);
    expect(liste.depuis?.toISOString()).toBe("2025-08-16T10:00:00.000Z");
  });

  it("applique la borne basse dans la requête, pas après coup", async () => {
    installerBase(base());

    await listSessionsForAdmin({ maintenant: MAINTENANT });

    // 🔴 Sans ce `where`, la page empire linéairement avec l'historique : le
    // filtre doit être posé en base, jamais sur le tableau rendu.
    const borne = argsFindMany()?.where?.dateDebut?.gte;
    expect(borne?.toISOString()).toBe("2025-08-16T10:00:00.000Z");
  });

  it("ne borne JAMAIS le futur — une session à venir reste visible", async () => {
    installerBase(base());

    const liste = await listSessionsForAdmin({ maintenant: MAINTENANT });

    expect(liste.rows.map((r) => r.id)).toContain("future");
    expect(argsFindMany()?.where?.dateDebut?.lt).toBeUndefined();
  });

  it("retrouve l'ancienne session en mode archives", async () => {
    installerBase(base());

    const liste = await listSessionsForAdmin({ avecArchives: true, maintenant: MAINTENANT });

    expect(liste.rows.map((r) => r.id)).toContain("ancienne");
    expect(liste.total).toBe(3);
    expect(liste.avecArchives).toBe(true);
    expect(liste.depuis).toBeNull();
    // Plus rien n'est hors vue : le compteur d'archives n'a plus de sens.
    expect(liste.nbArchives).toBe(0);
  });

  it("reste paginée en mode archives — ouvrir l'historique ne lève pas le plafond", async () => {
    installerBase(serie("a", 40, "realisee", new Date("2020-01-01T08:00:00.000Z")));

    const liste = await listSessionsForAdmin({ avecArchives: true, maintenant: MAINTENANT });

    expect(argsFindMany()?.take).toBe(PAGE_SIZE_SESSIONS);
    expect(liste.rows).toHaveLength(PAGE_SIZE_SESSIONS);
    expect(liste.totalPages).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Stub-safe (build GH Actions sans DB, ADR 0026)
// ─────────────────────────────────────────────────────────────────────────────

describe("listSessionsForAdmin — stub-safe", () => {
  it("rend une page vide, jamais une exception, si la base est injoignable", async () => {
    const panne = (): Promise<never> => Promise.reject(new Error("DB injoignable"));
    mockPrisma.trainingSession.count.mockImplementation(panne);
    mockPrisma.trainingSession.groupBy.mockImplementation(panne);
    mockPrisma.trainingSession.findMany.mockImplementation(panne);

    const liste = await listSessionsForAdmin({ page: 4, maintenant: MAINTENANT });

    expect(liste.rows).toEqual([]);
    expect(liste.total).toBe(0);
    expect(liste.page).toBe(1);
    expect(liste.totalPages).toBe(1);
    expect(liste.compteurs).toEqual({ enCours: 0, planifiees: 0, realisees: 0 });
  });
});
