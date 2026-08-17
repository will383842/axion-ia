/**
 * Lot 1 §1.4 — les échéances, toutes sessions confondues.
 *
 * Le critère d'acceptation du plan, mot pour mot : *« une convention non signée
 * à J-3 apparaît dans "À traiter" sans ouvrir aucune session »*. C'est le
 * premier test de ce fichier, et il porte le nom du critère.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findMany: vi.fn() },
    documentSignature: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { compterEcheancesDepassees, prochainesEcheances } from "./echeances-service";

const sessionFindMany = prisma.trainingSession.findMany as unknown as ReturnType<typeof vi.fn>;
const signatureFindMany = prisma.documentSignature.findMany as unknown as ReturnType<typeof vi.fn>;

const d = (iso: string): Date => new Date(iso);
const MAINTENANT = d("2026-09-07T09:00:00.000Z");

/** Une session avec sa convention générée mais non signée, qui démarre à J-3. */
function sessionAJ3(patch: Record<string, unknown> = {}) {
  return {
    id: "s1",
    numero: "AXI-SESS-2026-011",
    titreSession: "Prompt engineering",
    statut: "planifiee",
    dateDebut: d("2026-09-10T09:00:00.000Z"),
    dateFin: d("2026-09-11T17:00:00.000Z"),
    formateurPrincipalId: "f1",
    financementType: "direct",
    documents: [
      {
        id: "conv",
        type: "convention",
        numero: "AXI-DOC-2026-030",
        createdAt: d("2026-08-20T00:00:00.000Z"),
        annuleeAt: null,
        traineeId: null,
      },
    ],
    enrollments: [
      {
        id: "e1",
        statut: "planifiee",
        emargementSigneAt: null,
        convocationEnvoyeeAt: d("2026-09-05T00:00:00.000Z"),
        questionnaires: [],
        evaluations: [],
        emargementTokens: [],
        presences: [{ id: "c1" }],
        trainee: { portailAcces: [{ id: "p1" }] },
      },
    ],
    ...patch,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env["DATABASE_URL"];
  signatureFindMany.mockResolvedValue([]);
});

describe("🔴 une convention non signée à J-3 apparaît SANS ouvrir aucune session", () => {
  it("remonte l'étape, nommée, avec sa session", async () => {
    sessionFindMany.mockResolvedValue([sessionAJ3()]);

    const { echeances } = await prochainesEcheances({ maintenant: MAINTENANT });
    const conv = echeances.find((e) => e.etape.cle === "convention_signee");

    expect(
      conv,
      "La page « À traiter » existait et IGNORAIT les sessions : il fallait " +
        "ouvrir chaque dossier pour découvrir une convention non signée.",
    ).toBeDefined();
    expect(conv!.numero).toBe("AXI-SESS-2026-011");
    expect(conv!.titre).toBe("Prompt engineering");
    // ⚠️ À J-3 PILE, l'échéance vient tout juste d'être atteinte et l'étape est
    // encore « à faire » — la comparaison est stricte à l'échéance, sans quoi
    // une pièce déposée pile à l'heure annoncée rougirait. Ce que le critère du
    // plan demande, c'est qu'elle APPARAISSE : c'est le cas.
    expect(conv!.etape.etat).toBe("a_faire");
  });

  it("le lendemain, elle bascule en RATTRAPABLE — pas en « c'est foutu »", () => {
    // Le cas du 15/08 : encore sauvable, et l'écran doit le dire.
    sessionFindMany.mockResolvedValue([sessionAJ3()]);
    return prochainesEcheances({ maintenant: d("2026-09-08T09:00:00.000Z") }).then(
      ({ echeances }) => {
        const conv = echeances.find((e) => e.etape.cle === "convention_signee")!;
        expect(conv.etape.etat).toBe("rattrapable");
        expect(conv.etape.mention).toContain("rattrapable");
      },
    );
  });

  it("le périmètre couvre l'avant ET l'après-séance", async () => {
    sessionFindMany.mockResolvedValue([]);
    await prochainesEcheances({ maintenant: MAINTENANT });
    const where = (sessionFindMany.mock.calls[0]![0] as { where: { OR: unknown[] } }).where;
    // 🔴 Sans la branche `realisee`, le suivi à froid (J+30) — l'obligation la
    // plus oubliée — ne serait jamais listé nulle part.
    expect(JSON.stringify(where)).toContain("realisee");
    expect(JSON.stringify(where)).toContain("planifiee");
  });
});

describe("🔴 le tri met devant ce qu'il faut faire en premier", () => {
  it("hors délai passe devant rattrapable, et rattrapable devant à faire", async () => {
    sessionFindMany.mockResolvedValue([
      // Session lointaine, tout en règle sauf des étapes « à faire ».
      sessionAJ3({
        id: "s2",
        numero: "AXI-SESS-2026-020",
        dateDebut: d("2026-12-01T09:00:00.000Z"),
        dateFin: d("2026-12-02T17:00:00.000Z"),
      }),
      // Session d'hier : hors délai.
      sessionAJ3({
        id: "s3",
        numero: "AXI-SESS-2026-005",
        statut: "en_cours",
        dateDebut: d("2026-09-05T09:00:00.000Z"),
        dateFin: d("2026-09-06T17:00:00.000Z"),
      }),
    ]);

    const { echeances } = await prochainesEcheances({ maintenant: MAINTENANT });

    // Un tri par DATE seule remonterait la session de décembre avant celle de
    // la semaine dernière dès lors qu'elle est listée en premier.
    expect(echeances[0]!.etape.etat).toBe("hors_delai");
    const rangs = echeances.map((e) => e.etape.etat);
    expect(rangs.indexOf("hors_delai")).toBeLessThan(rangs.indexOf("a_faire"));
  });
});

describe("🔴 la pastille descend à zéro", () => {
  it("ne compte QUE les échéances dépassées, jamais le volume", async () => {
    sessionFindMany.mockResolvedValue([sessionAJ3()]);
    const { echeances } = await prochainesEcheances({ maintenant: MAINTENANT });
    const n = await compterEcheancesDepassees({ maintenant: MAINTENANT });

    // 🔴 Compter aussi les `a_faire` ferait une pastille qui ne descend JAMAIS
    // à zéro : toute session à venir a des étapes en attente, par construction.
    // Un compteur de volume finit par être ignoré.
    expect(n).toBeLessThan(echeances.length);
    expect(n).toBe(
      echeances.filter((e) => e.etape.etat === "hors_delai" || e.etape.etat === "rattrapable")
        .length,
    );
  });

  it("un dossier entièrement en règle ne fait pas de pastille", async () => {
    // Session à venir de loin, avec sa convention signée des deux côtés :
    // toutes les étapes sont soit faites, soit dans les temps.
    sessionFindMany.mockResolvedValue([
      sessionAJ3({
        dateDebut: d("2026-12-01T09:00:00.000Z"),
        dateFin: d("2026-12-02T17:00:00.000Z"),
      }),
    ]);
    signatureFindMany.mockResolvedValue([
      { documentGenereId: "conv", partie: "client" },
      { documentGenereId: "conv", partie: "axionia" },
    ]);
    expect(await compterEcheancesDepassees({ maintenant: MAINTENANT })).toBe(0);
  });
});

describe("🔴 une seule passe de signatures, pas une par session", () => {
  it("un seul findMany de signatures, quel que soit le nombre de sessions", async () => {
    sessionFindMany.mockResolvedValue([
      sessionAJ3({ id: "a" }),
      sessionAJ3({ id: "b" }),
      sessionAJ3({ id: "c" }),
    ]);
    await prochainesEcheances({ maintenant: MAINTENANT });
    // Le patron « une requête par élément » vient d'être retiré du moteur
    // d'alertes (T3a). Le réintroduire ici le ferait revenir par la fenêtre.
    expect(signatureFindMany).toHaveBeenCalledTimes(1);
  });

  it("aucune pièce : aucune requête de signature", async () => {
    sessionFindMany.mockResolvedValue([sessionAJ3({ documents: [] })]);
    await prochainesEcheances({ maintenant: MAINTENANT });
    expect(signatureFindMany).not.toHaveBeenCalled();
  });
});

describe("🔴 la troncature est DÉCLARÉE, jamais silencieuse", () => {
  it("sous le plafond, aucune troncature annoncée", async () => {
    sessionFindMany.mockResolvedValue([sessionAJ3()]);
    const r = await prochainesEcheances({ maintenant: MAINTENANT });
    expect(r.troncature).toBeNull();
  });

  it("au-dessus du plafond, la troncature est rendue", async () => {
    // 🔴 Une liste tronquée en silence se lit comme une liste complète : elle
    // fabrique la certitude qu'il n'y a rien d'autre. Leçon T3a, même domaine.
    sessionFindMany.mockResolvedValue(
      Array.from({ length: 301 }, (_, i) => sessionAJ3({ id: `s${i}` })),
    );
    const r = await prochainesEcheances({ maintenant: MAINTENANT });
    expect(r.troncature).not.toBeNull();
    expect(r.troncature!.examinees).toBe(300);
  });

  it("la requête demande une ligne DE PLUS que le plafond", async () => {
    // C'est la seule façon de savoir qu'on a mordu sans rapporter la ligne.
    sessionFindMany.mockResolvedValue([]);
    await prochainesEcheances({ maintenant: MAINTENANT });
    expect((sessionFindMany.mock.calls[0]![0] as { take: number }).take).toBe(301);
  });
});

describe("🔴 la colonne « Dossier » de la liste sort du MÊME calcul", () => {
  it("rend le pire état et l'avancement par session", async () => {
    sessionFindMany.mockResolvedValue([sessionAJ3()]);
    const { parSession } = await prochainesEcheances({ maintenant: MAINTENANT });
    const s = parSession.get("s1")!;
    expect(s.pire).toBe("rattrapable");
    expect(s.total).toBeGreaterThan(0);
    expect(s.fait).toBeLessThanOrEqual(s.total);
  });
});

describe("le stub de build ne touche pas Prisma", () => {
  it("early-exit propre", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    const r = await prochainesEcheances({ maintenant: MAINTENANT });
    expect(r.echeances).toEqual([]);
    expect(sessionFindMany).not.toHaveBeenCalled();
  });
});

describe("🔴 le balayage ciblé — ce qui rend la colonne « Dossier » possible", () => {
  it("restreint la requête aux sessions demandées", async () => {
    sessionFindMany.mockResolvedValue([sessionAJ3()]);
    await prochainesEcheances({ maintenant: MAINTENANT, sessionIds: ["s1", "s2"] });
    const where = (sessionFindMany.mock.calls[0]![0] as { where: Record<string, unknown> }).where;
    // 🔴 Sans ce chemin, la liste des sessions balaierait 300 dossiers pour en
    // afficher 25 : la sonde `sessions_liste` (10 ms mesurés, 450 ms de budget)
    // exploserait. Le Lot 0 existe pour qu'on ne le découvre pas en production.
    expect(where).toEqual({ id: { in: ["s1", "s2"] } });
    expect(JSON.stringify(where)).not.toContain("realisee");
  });

  it("une page vide ne déclenche AUCUNE requête", async () => {
    await prochainesEcheances({ maintenant: MAINTENANT, sessionIds: [] });
    expect(sessionFindMany).not.toHaveBeenCalled();
  });

  it("sans `sessionIds`, le périmètre complet reprend la main", async () => {
    sessionFindMany.mockResolvedValue([]);
    await prochainesEcheances({ maintenant: MAINTENANT });
    const where = (sessionFindMany.mock.calls[0]![0] as { where: Record<string, unknown> }).where;
    expect(JSON.stringify(where)).toContain("realisee");
  });
});
