// @vitest-environment node

/**
 * Envoi : noms chiffrés, écarter / rétablir, rectificatif par ligne, une ligne en erreur n'arrête pas le lot.
 *
 * La « base » factice ci-dessous n'est qu'un décor : la VÉRITÉ des règles du trigger et des CHECK est
 * dans `tests/sql/releve-mensuel-comportement.sql`, exécuté sur un vrai Postgres par Gate D. Ici on ne
 * prouve que le comportement du code (ce qu'il écrit, ce qu'il compte). Les noms sont réellement
 * chiffrés (`encryptPii`) : un « enc:v1:… » dans l'e-mail ou le PDF échoue.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Statut = "prepare" | "envoi_en_cours" | "envoye" | "echec" | "ecarte";
interface Row {
  id: string;
  numero: string;
  apporteurId: string;
  periode: string;
  rang: number;
  statut: Statut;
  contenu: unknown;
  pdfR2Key: string | null;
  erreur: string | null;
  prisAt: Date | null;
  emailJobId: string | null;
  envoyeAt: Date | null;
  envoyePar: string | null;
  lotId: string | null;
  motifEcart: string | null;
  apporteur: { prenom: string; nom: string; denomination: string | null; email: string };
}

const s = vi.hoisted(() => ({
  rows: [] as unknown[],
  lots: [] as Array<{ id: string; finAt: Date | null; abandonneAt: Date | null }>,
  envoyer: vi.fn(),
  dejaEnvoye: vi.fn(),
  entree: vi.fn(),
  frais: vi.fn(),
  panne: new Set<string>(),
}));
const rows = () => s.rows as Row[];

const REFUS_FIGE = "un relevé qui n'est plus « prepare » est figé (rectificatif requis)";

/** Reproduction fidèle du trigger BEFORE UPDATE puis des CHECK, sur les colonnes que le code écrit. */
function appliquer(old: Row, data: Partial<Row>): Row {
  const neuf: Row = { ...old, ...data };
  const meme = (a: Date | string | null, b: Date | string | null) =>
    (a instanceof Date ? a.getTime() : a) === (b instanceof Date ? b.getTime() : b);
  if (
    (old.statut !== "prepare" || old.prisAt !== null || old.emailJobId !== null) &&
    ((old.prisAt !== null && !meme(neuf.prisAt, old.prisAt)) ||
      (old.emailJobId !== null && neuf.emailJobId !== old.emailJobId))
  ) {
    throw new Error(REFUS_FIGE);
  }
  if (old.statut === "envoye" && neuf.statut !== "envoye")
    throw new Error("un relevé envoyé ne change plus de statut");
  if (old.statut === "ecarte" && neuf.statut === "envoi_en_cours")
    throw new Error("un relevé écarté n'est pas pris pour envoi");
  if (["envoi_en_cours", "echec", "envoye"].includes(old.statut) && neuf.statut === "prepare") {
    throw new Error("un relevé pris pour envoi ne revient jamais à « prepare »");
  }
  if (old.statut === "envoi_en_cours" && neuf.statut === "ecarte")
    throw new Error("un relevé en cours d'envoi ne s'écarte pas");
  if (
    neuf.statut === "prepare" &&
    old.statut !== "prepare" &&
    (old.prisAt !== null || old.emailJobId !== null)
  ) {
    throw new Error("un relevé déjà pris pour envoi ne revient jamais à « prepare »");
  }
  // CHECK
  if (["envoi_en_cours", "echec", "envoye"].includes(neuf.statut) && neuf.prisAt === null) {
    throw new Error('violates check constraint "releves_mensuels_apporteur_prise_tracee"');
  }
  if (neuf.statut === "envoye" && (neuf.envoyeAt === null || neuf.emailJobId === null)) {
    throw new Error("violates check constraint (envoye sans envoye_at / email_job_id)");
  }
  return neuf;
}

type Cond = string | { in?: unknown[]; notIn?: unknown[]; gt?: number } | null | undefined | number;
const ok = (v: unknown, c: Cond): boolean => {
  if (c === undefined) return true;
  if (c === null || typeof c === "string" || typeof c === "number") return v === c;
  if (c.in) return c.in.includes(v);
  if (c.notIn) return !c.notIn.includes(v);
  if (c.gt !== undefined) return (v as number) > c.gt;
  return true;
};
const filtre = (w: Record<string, Cond>) => (r: Row) =>
  (["id", "periode", "rang", "statut", "prisAt"] as const).every((k) => ok(r[k], w[k]));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apporteurReseau: {
      findUnique: async () => rows()[0]!.apporteur,
    },
    lotReleveMensuel: {
      create: async () => {
        const lot = { id: `lot-${s.lots.length + 1}`, finAt: null, abandonneAt: null };
        s.lots.push(lot);
        return { id: lot.id };
      },
      update: async ({ where, data }: { where: { id: string }; data: { finAt: Date } }) => {
        s.lots.find((l) => l.id === where.id)!.finAt = data.finAt;
      },
    },
    releveMensuelApporteur: {
      findMany: async ({ where, take }: { where: Record<string, Cond>; take: number }) =>
        rows()
          .filter(filtre(where))
          .sort((a, b) => a.numero.localeCompare(b.numero))
          .slice(0, take),
      updateMany: async ({ where, data }: { where: Record<string, Cond>; data: Partial<Row> }) => {
        const cibles = rows().filter(filtre(where));
        for (const l of cibles) {
          if (s.panne.has(l.id) && data.statut === "envoi_en_cours") throw new Error("panne base");
          Object.assign(l, appliquer(l, data));
        }
        return { count: cibles.length };
      },
    },
  },
}));
vi.mock("@/server/queue/queues", () => ({ emailsQueue: null }));
vi.mock("../../envois", () => ({ envoyer: s.envoyer }));
vi.mock("../../commissions", () => ({ dejaEnvoye: s.dejaEnvoye }));
vi.mock("../preparation", async (orig) => ({
  ...(await orig<typeof import("../preparation")>()),
  anomaliesDeCompletude: async () => [],
}));
vi.mock("../reprise", async (orig) => ({
  ...(await orig<typeof import("../reprise")>()),
  reprendreEnvoisEnCours: vi.fn(),
  abandonnerLotsMorts: vi.fn(),
}));
vi.mock("../lecture", () => ({ lireEntreeReleve: s.entree }));
vi.mock("../calcul", async (orig) => ({
  ...(await orig<typeof import("../calcul")>()),
  calculerReleve: s.frais,
}));
vi.mock("../../signaler", () => ({ signalerErreurReseau: vi.fn() }));

import { encryptPii } from "@/lib/pii-crypto";

import { envoyerLot } from "../envoi";

const { calculerReleve: calculerReel } =
  await vi.importActual<typeof import("../calcul")>("../calcul");
const { entetePdf, ecarterReleve, retablirReleve } =
  await vi.importActual<typeof import("../preparation")>("../preparation");

const MAINTENANT = new Date("2026-11-03T08:00:00Z");
const PRIS = new Date("2026-11-02T08:00:00Z");
const PERIODE = "2026-10";
const contenu = calculerReel({
  periode: PERIODE,
  preparationAt: MAINTENANT,
  commissions: [],
  pieces: [],
} as never).contenu;

function ligne(n: number, over: Partial<Row> = {}): Row {
  return {
    id: `id-${n}`,
    numero: `REL-2026-10-000${n}`,
    apporteurId: `a${n}`,
    periode: PERIODE,
    rang: 0,
    statut: "prepare",
    contenu,
    pdfR2Key: `apporteurs/releves/a${n}/x.pdf`,
    erreur: null,
    prisAt: null,
    emailJobId: null,
    envoyeAt: null,
    envoyePar: null,
    lotId: null,
    motifEcart: null,
    apporteur: {
      prenom: encryptPii("Camille"),
      nom: encryptPii("Dupont"),
      denomination: null,
      email: `apporteur${n}@exemple.invalid`,
    },
    ...over,
  };
}
const echec = (n: number, over: Partial<Row> = {}) =>
  ligne(n, { statut: "echec", prisAt: PRIS, erreur: "envoi non parti (x)", ...over });

const lancer = (mode: "tous" | "echecs" | "rectificatif" = "tous", releveId?: string) =>
  envoyerLot({
    periode: PERIODE,
    declenchePar: "console:admin-1",
    mode,
    ...(releveId ? { releveId } : {}),
    maintenant: MAINTENANT,
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("PII_ENCRYPTION_KEY", "ab".repeat(32));
  s.rows = [];
  s.lots = [];
  s.panne = new Set();
  s.envoyer.mockResolvedValue("envoye");
  s.dejaEnvoye.mockResolvedValue(false);
  s.entree.mockResolvedValue({});
  s.frais.mockImplementation(() => ({ contenu, anomalies: [] }));
});

describe("1. « Renvoyer les échecs » marche, et une ligne en erreur n'arrête pas le lot", () => {
  it("une ligne `echec` repart SANS réécrire pris_at", async () => {
    s.rows = [echec(1)];
    const r = await lancer("echecs");
    expect(r).toMatchObject({ ok: true, nbEnvoyes: 1, nbEchecs: 0 });
    expect(rows()[0]).toMatchObject({ statut: "envoye", prisAt: PRIS });
  });

  it("une ligne `prepare` est prise avec pris_at", async () => {
    s.rows = [ligne(1)];
    await lancer();
    expect(rows()[0]).toMatchObject({ statut: "envoye", prisAt: MAINTENANT });
  });

  it("une exception sur une ligne (refus de la base) est comptée ; les autres partent ; lot fermé", async () => {
    s.rows = [ligne(1), ligne(2), ligne(3)];
    s.panne = new Set(["id-1"]);
    const r = await lancer();
    expect(r).toMatchObject({ ok: true, nbCibles: 3, nbEnvoyes: 2, nbEchecs: 1 });
    expect(rows().map((l) => l.statut)).toEqual(["prepare", "envoye", "envoye"]);
    expect(s.lots[0]!.finAt).not.toBeNull();
  });
});

describe("2. déjà envoyé sur une ligne `prepare`", () => {
  it("remplit pris_at dans la même écriture (CHECK prise_tracee)", async () => {
    s.rows = [ligne(1)];
    s.dejaEnvoye.mockResolvedValue(true);
    const r = await lancer();
    expect(r).toMatchObject({ nbDejaEnvoyes: 1, nbEchecs: 0 });
    expect(rows()[0]).toMatchObject({ statut: "envoye", prisAt: MAINTENANT });
    expect(s.envoyer).not.toHaveBeenCalled();
  });

  it("sur une ligne `echec` : pris_at conservé", async () => {
    s.rows = [echec(1)];
    s.dejaEnvoye.mockResolvedValue(true);
    await lancer("echecs");
    expect(rows()[0]).toMatchObject({ statut: "envoye", prisAt: PRIS });
  });
});

describe("3. prénom et nom chiffrés", () => {
  it("l'e-mail dit « Camille », jamais « enc:… »", async () => {
    s.rows = [ligne(1)];
    await lancer();
    const arg = s.envoyer.mock.calls[0]![0] as { payload: { contactName: string } };
    expect(arg.payload.contactName).toBe("Camille");
  });

  it("le PDF (et le rectificatif) porte le destinataire déchiffré", async () => {
    s.rows = [ligne(1)];
    const e = await entetePdf("a1", "REL-2026-10-0001");
    expect(e.destinataire).toBe("Camille Dupont");
    expect(JSON.stringify(e)).not.toMatch(/enc:/);
  });
});

describe("4. écarter / rétablir : seulement les lignes jamais prises", () => {
  it("une ligne `prepare` jamais prise s'écarte puis se rétablit", async () => {
    s.rows = [ligne(1)];
    expect(await ecarterReleve("id-1", "Mois sans activité")).toBe("ecarte");
    expect(await retablirReleve("id-1")).toBe(true);
    expect(rows()[0]!.statut).toBe("prepare");
  });

  it("une ligne `echec` ne s'écarte pas ; une écartée déjà prise ne se rétablit pas", async () => {
    s.rows = [echec(1), ligne(2, { statut: "ecarte", motifEcart: "x", prisAt: PRIS })];
    expect(await ecarterReleve("id-1", "Motif valable")).toBe("refuse");
    expect(await retablirReleve("id-2")).toBe(false);
    expect(rows().map((l) => l.statut)).toEqual(["echec", "ecarte"]);
  });
});

describe("5. rectificatif : un bouton PAR LIGNE, jamais dans le lot global", () => {
  it("le lot global ignore le rectificatif ; le mode `rectificatif` n'envoie que SA ligne", async () => {
    s.rows = [
      ligne(1, { statut: "envoye", prisAt: PRIS, emailJobId: "j1", envoyeAt: PRIS }),
      ligne(1, { id: "id-r1", numero: "REL-2026-10-0001-R1", rang: 1, apporteurId: "a1" }),
      ligne(2, { id: "id-r2", numero: "REL-2026-10-0002-R1", rang: 1, apporteurId: "a2" }),
    ];
    await lancer("tous");
    expect(s.envoyer).not.toHaveBeenCalled();
    const r = await lancer("rectificatif", "id-r1");
    expect(r).toMatchObject({ nbCibles: 1, nbEnvoyes: 1 });
    expect(s.envoyer).toHaveBeenCalledTimes(1);
    expect(rows().find((l) => l.id === "id-r1")!.statut).toBe("envoye");
    expect(rows().find((l) => l.id === "id-r2")!.statut).toBe("prepare");
  });

  it("un rectificatif en `echec` repart sans réécrire pris_at ; le mode refuse un relevé d'origine", async () => {
    s.rows = [echec(1, { id: "id-r1", numero: "REL-2026-10-0001-R1", rang: 1 }), ligne(2)];
    expect(await lancer("rectificatif", "id-2")).toMatchObject({ nbCibles: 0, nbEnvoyes: 0 });
    expect(await lancer("rectificatif", "id-r1")).toMatchObject({ nbEnvoyes: 1 });
    expect(rows()[0]).toMatchObject({ statut: "envoye", prisAt: PRIS });
  });
});
