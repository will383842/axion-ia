import { beforeEach, describe, expect, it, vi } from "vitest";

// Contrat 2.3, art. 4.5 bis : un manquement ou une fraude prive l'affaire de toute commission ;
// celles déjà versées sont reprises ; celles facturées non versées sont RETENUES et neutralisées
// par un avoir ; l'apporteur reçoit les faits et peut contester (30 jours) ; le parrain, un avis.

interface Ligne {
  id: string;
  apporteurId: string;
  presentationId: string | null;
  factureId: string;
  parrainage: boolean;
  statut: string;
  montantCents: number | null;
  autofactureNumero: string | null;
  autofactureEmiseAt: Date | null;
  avoirNumero: string | null;
  verseeAt: Date | null;
  palier: string | null;
}

const etat = vi.hoisted(() => ({
  lignes: [] as Ligne[],
  presentation: { id: "P1", apporteurId: "APP1", statut: "confirmee" } as Record<string, unknown>,
  reprises: [] as Array<Record<string, unknown>>,
  envoyes: [] as Array<Record<string, unknown>>,
  journal: [] as Array<Record<string, unknown>>,
  pdfs: [] as Array<Record<string, unknown>>,
  alertes: [] as Array<Record<string, unknown>>,
  r2Present: true,
  pdfEchoue: false,
}));

vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: unknown) => v }));
vi.mock("../signaler", () => ({ signalerErreurReseau: vi.fn() }));
vi.mock("@/lib/destinataires-internes", () => ({
  destinataireAlertesInternes: () => "alertes@exemple.fr",
}));
vi.mock("@/lib/r2-storage", () => ({ existsInR2: vi.fn(async () => etat.r2Present) }));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: vi.fn(async (_g: string, _d: string, _l: string, p: Record<string, unknown>) => {
    etat.alertes.push(p);
    return { enqueued: true };
  }),
}));
vi.mock("../envois", () => ({
  envoyer: vi.fn(async (e: Record<string, unknown>) => {
    etat.envoyes.push(e);
    return "envoye";
  }),
}));
vi.mock("../commissions", () => ({
  ACTIVITE_NEUTRALISATION: "neutralisation",
  dejaEnvoye: vi.fn(async () => false),
  verrouillerSerieAutofacture: vi.fn(async () => undefined),
  moisParis: () => "2026-10",
  allouerNumerosAutofacture: vi.fn(async () => ["AXI-APP-2026-0099"]),
  genererPdfAutofacture: vi.fn(async (e: Record<string, unknown>) => {
    if (etat.pdfEchoue) return null;
    etat.pdfs.push(e);
    return {
      r2Key: `k/${String(e["numero"])}`,
      filename: `${String(e["numero"])}.pdf`,
      totalTtcCents: 0,
    };
  }),
}));
vi.mock("../resiliation", () => ({
  PREFIXE_PALIER_REPRISE: "reprise-de:",
  enregistrerReprise: vi.fn(async (e: Record<string, unknown>) => {
    etat.reprises.push(e);
    return { ok: true, message: "ok" };
  }),
}));

function correspond(l: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([k, c]) => {
    const v = l[k];
    if (c === null) return v === null;
    if (typeof c === "object" && c !== null && "in" in c) return (c.in as unknown[]).includes(v);
    if (typeof c === "object" && c !== null && "not" in c)
      return c.not === null ? v !== null && v !== undefined : v !== c.not;
    return v === c;
  });
}

vi.mock("@/lib/prisma", () => {
  const commissionApporteur = {
    findMany: vi.fn(async (a: { where: Record<string, unknown> }) =>
      etat.lignes.filter((l) => correspond(l as never, a.where)).map((l) => ({ ...l })),
    ),
    updateMany: vi.fn(
      async (a: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const ls = etat.lignes.filter((l) => correspond(l as never, a.where));
        for (const l of ls) Object.assign(l, a.data);
        return { count: ls.length };
      },
    ),
    count: vi.fn(
      async (a: { where: { OR: Array<Record<string, { in: string[] }>> } }) =>
        etat.lignes.filter((l) =>
          a.where.OR.some((w) =>
            Object.entries(w).some(([k, c]) => c.in.includes(String(l[k as keyof Ligne]))),
          ),
        ).length,
    ),
    create: vi.fn(async (a: { data: Record<string, unknown> }) => {
      const id = `rep-${etat.lignes.length + 1}`;
      etat.lignes.push({ ...(a.data as unknown as Ligne), id, presentationId: null });
      return { id };
    }),
  };
  const prisma = {
    presentationEntreprise: {
      findUnique: vi.fn(async () => ({ ...etat.presentation })),
      updateMany: vi.fn(
        async (a: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
          if (!correspond(etat.presentation, a.where)) return { count: 0 };
          Object.assign(etat.presentation, a.data);
          return { count: 1 };
        },
      ),
    },
    commissionApporteur,
    apporteurReseau: {
      findUnique: vi.fn(async (a: { where: { id: string } }) => ({
        prenom: a.where.id === "APP2" ? "Paul" : "Claire",
        email: `${a.where.id.toLowerCase()}@exemple.fr`,
      })),
    },
    activityLog: {
      findFirst: vi.fn(
        async (a: { where: Record<string, unknown> }) =>
          etat.journal.find((j) => correspond(j, a.where)) ?? null,
      ),
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        etat.journal.push({
          ...a.data,
          targetType: a.data["targetType"],
          targetId: a.data["targetId"],
        });
        return {};
      }),
    },
    $transaction: async (cb: (tx: unknown) => unknown) =>
      cb({
        commissionApporteur,
        $executeRaw: vi.fn(async () => 0),
        numeroEmis: { count: vi.fn(async () => 0) },
      }),
  };
  return { prisma };
});

import { constaterManquement, regenererAvoirsSansPiece } from "../manquement";

const MAINTENANT = new Date("2026-10-08T09:00:00Z");
const FAITS = "L'entreprise a versé une rétrocession à l'apporteur, non déclarée (art. 8.4).";
const ligne = (id: string, statut: string, extra: Partial<Ligne> = {}): Ligne => ({
  id,
  apporteurId: "APP1",
  presentationId: "P1",
  factureId: `F-${id}`,
  parrainage: false,
  statut,
  montantCents: 40_000,
  autofactureNumero: null,
  autofactureEmiseAt: null,
  avoirNumero: null,
  verseeAt: null,
  palier: null,
  ...extra,
});
const part = (id: string, factureId: string, statut: string, extra: Partial<Ligne> = {}) =>
  ligne(id, statut, {
    apporteurId: "APP2",
    parrainage: true,
    presentationId: null,
    factureId,
    montantCents: 4_000,
    ...extra,
  });
const constater = (faits = FAITS) =>
  constaterManquement({ presentationId: "P1", faits, acteurId: "admin-1", maintenant: MAINTENANT });

beforeEach(() => {
  etat.lignes = [];
  etat.presentation = { id: "P1", apporteurId: "APP1", statut: "confirmee" };
  etat.reprises = [];
  etat.envoyes = [];
  etat.journal = [];
  etat.pdfs = [];
  etat.alertes = [];
  etat.r2Present = true;
  etat.pdfEchoue = false;
});

describe("manquement ou fraude (art. 4.5 bis)", () => {
  it("les faits sont obligatoires : sans eux, rien ne bouge", async () => {
    etat.lignes = [ligne("c1", "due")];
    expect(await constater("court")).toMatchObject({ ok: false });
    expect(etat.lignes[0]!.statut).toBe("due");
    expect(etat.envoyes).toHaveLength(0);
  });

  it("chaque ligne de l'affaire, PART DU PARRAIN COMPRISE, selon son état", async () => {
    etat.lignes = [
      ligne("a", "due"),
      part("pa", "F-a", "due"),
      ligne("b", "due", { autofactureNumero: "AXI-APP-2026-0001" }),
      part("pb", "F-b", "due", { autofactureNumero: "AXI-APP-2026-0002" }),
      ligne("v", "versee"),
      part("pv", "F-v", "versee"),
    ];
    const r = await constater();
    expect(r).toMatchObject({ ok: true, bilan: { annulees: 2, retenues: 2, reprises: 2 } });
    const st = (id: string) => etat.lignes.find((l) => l.id === id)!.statut;
    expect([st("a"), st("pa")]).toEqual(["annulee", "annulee"]);
    expect([st("b"), st("pb")]).toEqual(["retenue", "retenue"]);
    expect(etat.reprises.map((x) => x["commissionId"])).toEqual(["v", "pv"]);
  });

  it("retenue : un AVOIR soldé, rattaché à l'autofacture, neutralise la ligne (jamais déduit ailleurs)", async () => {
    etat.lignes = [ligne("b", "due", { autofactureNumero: "AXI-APP-2026-0001" })];
    await constater();
    const avoir = etat.lignes.find((l) => l.statut === "reprise")!;
    expect(avoir).toMatchObject({
      montantCents: -40_000,
      autofactureNumero: "AXI-APP-2026-0001",
      avoirNumero: "AXI-APP-2026-0099",
      palier: "reprise-de:b",
    });
    expect(avoir.verseeAt).toEqual(MAINTENANT);
    expect(etat.pdfs[0]).toMatchObject({
      numero: "AXI-APP-2026-0099",
      totalCents: 40_000,
      avoir: { factureInitiale: "AXI-APP-2026-0001" },
    });
    // L'avoir est joint à la notification.
    expect(etat.envoyes[0]).toMatchObject({
      attachments: [{ filename: "AXI-APP-2026-0099.pdf" }],
    });
  });

  it("présentation TERMINÉE : marquée démentie aussi (le passage quotidien n'y crée plus rien)", async () => {
    etat.presentation = { id: "P1", apporteurId: "APP1", statut: "terminee" };
    await constater();
    expect(etat.presentation["statut"]).toBe("dementie");
  });

  it("UNE notification avec les faits (clé stable) ; un second constat est refusé", async () => {
    etat.lignes = [ligne("a", "due")];
    await constater();
    expect(etat.envoyes).toHaveLength(1);
    expect(etat.envoyes[0]).toMatchObject({
      gabarit: "apporteur-manquement",
      destinataire: "app1@exemple.fr",
      payload: { faits: FAITS },
      jobId: "apporteur-manquement-P1",
    });
    expect(await constater()).toMatchObject({ ok: false });
    expect(etat.envoyes).toHaveLength(1);
  });

  it("le parrain dont la part est retirée reçoit un simple avis, SANS les faits", async () => {
    etat.lignes = [ligne("a", "due"), part("pa", "F-a", "due")];
    await constater();
    const auParrain = etat.envoyes.find((x) => x["destinataire"] === "app2@exemple.fr")!;
    expect(auParrain["payload"]).toMatchObject({ parrain: true });
    expect(auParrain["payload"]).not.toHaveProperty("faits");
  });

  it("le geste est tracé au journal (qui, faits, statut d'avant, bilan)", async () => {
    etat.lignes = [ligne("a", "due")];
    await constater();
    expect(
      etat.journal.find((j) => j["action"] === "presentation_entreprise.manquement"),
    ).toMatchObject({
      adminUserId: "admin-1",
      targetId: "P1",
      changes: { faits: FAITS, statutAvant: "confirmee", annulees: 1 },
    });
  });
});

describe("relecture de la PR 1371 (a1) : avoir de neutralisation", () => {
  it("l'avoir porte la marque « neutralisation » (exclue de la DAS2)", async () => {
    etat.lignes = [ligne("b", "due", { autofactureNumero: "AXI-APP-2026-0001" })];
    await constater();
    expect(etat.lignes.find((l) => l.statut === "reprise")).toMatchObject({
      activite: "neutralisation",
    });
  });

  it("PDF en échec : la ligne est retenue, puis le passage horaire régénère la pièce et l'envoie", async () => {
    etat.pdfEchoue = true;
    etat.lignes = [ligne("b", "due", { autofactureNumero: "AXI-APP-2026-0001" })];
    const r = await constater();
    expect((r as { message: string }).message).toContain("à régénérer");
    // Encore en échec : une alerte à Williams.
    etat.r2Present = false;
    expect(await regenererAvoirsSansPiece(MAINTENANT)).toBe(0);
    expect(etat.alertes.map((a) => a["code"])).toEqual(["apporteur_avoir_sans_piece"]);
    // Le stockage répond : régénéré et envoyé avec la pièce.
    etat.pdfEchoue = false;
    expect(await regenererAvoirsSansPiece(MAINTENANT)).toBe(1);
    const envoi = etat.envoyes.find((e) => (e["payload"] as { avoirSeul?: boolean }).avoirSeul);
    expect(envoi).toMatchObject({
      jobId: "apporteur-manquement-avoir-AXI-APP-2026-0099",
      attachments: [{ filename: "AXI-APP-2026-0099.pdf" }],
    });
  });

  it("reprise imputée sur une autofacture dont la seule ligne due est retenue : libérée pour réimputation", async () => {
    etat.lignes = [
      ligne("b", "due", { autofactureNumero: "AXI-APP-2026-0001" }),
      ligne("r", "reprise", {
        presentationId: null,
        factureId: "F-r",
        montantCents: -10_000,
        autofactureNumero: "AXI-APP-2026-0001",
        avoirNumero: "AXI-APP-2026-0002",
      }),
    ];
    await constater();
    expect(etat.lignes.find((l) => l.id === "r")!).toMatchObject({
      autofactureNumero: null,
      avoirNumero: null,
      verseeAt: null,
    });
    expect(etat.journal.some((j) => j["action"] === "commission_apporteur.reprise_liberee")).toBe(
      true,
    );
  });
});
