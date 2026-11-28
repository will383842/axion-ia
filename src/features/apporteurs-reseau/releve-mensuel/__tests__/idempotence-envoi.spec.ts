// @vitest-environment node

/**
 * Lot 4a : idempotence de l'envoi. Un seul lot vivant par période ; un enfilage par apporteur
 * malgré deux clics ; `envoye` jamais repris ; « Renvoyer » refusé si l'e-mail est déjà parti ;
 * la ligne qui part porte SA pièce jointe et un jobId déterministe ; rien ne part si les données
 * du mois ont changé ; un échec n'arrête pas les autres ; le lot se ferme toujours.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Statut = "prepare" | "envoi_en_cours" | "envoye" | "echec" | "ecarte";
interface Ligne {
  id: string;
  numero: string;
  apporteurId: string;
  periode: string;
  rang: number;
  statut: Statut;
  contenu: unknown;
  pdfR2Key: string | null;
  erreur: string | null;
  /** Test seulement : la ligne a déjà un rectificatif (`rectificatifs: { some }`). */
  rectifiee?: boolean;
  envoyeAt?: Date;
  envoyePar?: string;
  emailJobId?: string;
  lotId?: string;
  apporteur: { prenom: string; email: string };
}

const s = vi.hoisted(() => ({
  lignes: [] as unknown[],
  lots: [] as Array<{ id: string; finAt: Date | null; abandonneAt: Date | null; maj?: unknown }>,
  envoyer: vi.fn(),
  dejaEnvoye: vi.fn(),
  completude: vi.fn(),
  reprise: vi.fn(),
  abandon: vi.fn(),
  entree: vi.fn(),
  frais: vi.fn(),
  prisesRefusees: new Set<string>(),
}));

const rows = () => s.lignes as Ligne[];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lotReleveMensuel: {
      create: async () => {
        if (s.lots.some((l) => l.finAt === null && l.abandonneAt === null)) {
          throw Object.assign(new Error("unique"), { code: "P2002" });
        }
        const lot = { id: `lot-${s.lots.length + 1}`, finAt: null, abandonneAt: null };
        s.lots.push(lot);
        return { id: lot.id };
      },
      update: async ({ where, data }: { where: { id: string }; data: { finAt: Date } }) => {
        const lot = s.lots.find((l) => l.id === where.id)!;
        lot.finAt = data.finAt;
        lot.maj = data;
        return lot;
      },
    },
    releveMensuelApporteur: {
      findMany: async ({
        where,
        take,
      }: {
        where: {
          periode: string;
          rang: number;
          statut: Statut;
          id?: { notIn: string[] };
          rectificatifs?: { none: object };
        };
        take: number;
      }) =>
        rows()
          .filter(
            (l) =>
              l.periode === where.periode &&
              l.rang === where.rang &&
              l.statut === where.statut &&
              !where.id?.notIn.includes(l.id) &&
              !(where.rectificatifs?.none && l.rectifiee),
          )
          .sort((a, b) => a.numero.localeCompare(b.numero))
          .slice(0, take),
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; statut: Statut | { in: Statut[] } };
        data: Partial<Ligne>;
      }) => {
        const l = rows().find((x) => x.id === where.id);
        const ok = (st: Statut) =>
          typeof where.statut === "string" ? st === where.statut : where.statut.in.includes(st);
        if (
          !l ||
          !ok(l.statut) ||
          (data.statut === "envoi_en_cours" && s.prisesRefusees.has(l.id))
        ) {
          return { count: 0 };
        }
        Object.assign(l, data);
        return { count: 1 };
      },
    },
  },
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string) => v }));
vi.mock("../../envois", () => ({ envoyer: s.envoyer }));
vi.mock("../../commissions", () => ({ dejaEnvoye: s.dejaEnvoye }));
vi.mock("../preparation", () => ({ anomaliesDeCompletude: s.completude }));
vi.mock("../reprise", async (orig) => ({
  ...(await orig<typeof import("../reprise")>()),
  reprendreEnvoisEnCours: s.reprise,
  abandonnerLotsMorts: s.abandon,
}));
vi.mock("../lecture", () => ({ lireEntreeReleve: s.entree }));
vi.mock("../calcul", async (orig) => ({
  ...(await orig<typeof import("../calcul")>()),
  calculerReleve: s.frais,
}));
vi.mock("../../signaler", () => ({ signalerErreurReseau: vi.fn() }));
vi.mock("@/server/queue/queues", () => ({ emailsQueue: null }));

import { envoyerLot } from "../envoi";

// Le VRAI calcul (le module est doublé plus haut pour pouvoir simuler un contenu modifié).
const { calculerReleve: calculerReel } =
  await vi.importActual<typeof import("../calcul")>("../calcul");

const MAINTENANT = new Date("2026-11-03T08:00:00Z");
const PERIODE = "2026-10";
const entreeVide = { periode: PERIODE, preparationAt: MAINTENANT, commissions: [], pieces: [] };
const contenu = calculerReel(entreeVide as never).contenu;

function ligne(n: number, over: Partial<Ligne> = {}): Ligne {
  return {
    id: `id-${n}`,
    numero: `REL-2026-10-000${n}`,
    apporteurId: `a${n}`,
    periode: PERIODE,
    rang: 0,
    statut: "prepare",
    contenu,
    pdfR2Key: `apporteurs/releves/a${n}/REL-2026-10-000${n}-abcd1234.pdf`,
    erreur: null,
    apporteur: { prenom: `Prénom${n}`, email: `apporteur${n}@exemple.invalid` },
    ...over,
  };
}

const lancer = (mode: "tous" | "echecs" = "tous") =>
  envoyerLot({ periode: PERIODE, declenchePar: "console:admin-1", mode, maintenant: MAINTENANT });

beforeEach(() => {
  vi.clearAllMocks();
  s.lignes = [ligne(1), ligne(2), ligne(3)];
  s.lots = [];
  s.prisesRefusees = new Set();
  s.envoyer.mockResolvedValue("envoye");
  s.dejaEnvoye.mockResolvedValue(false);
  s.completude.mockResolvedValue([]);
  s.reprise.mockResolvedValue({ envoyes: 0, echecs: 0 });
  s.abandon.mockResolvedValue(0);
  s.entree.mockResolvedValue(entreeVide);
  s.frais.mockImplementation(() => ({ contenu, anomalies: [] }));
});

describe("un seul lot vivant par période", () => {
  it("un second lot pendant qu'un premier vit est REFUSÉ : rien n'est enfilé", async () => {
    s.lots.push({ id: "lot-0", finAt: null, abandonneAt: null });
    const r = await lancer();
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/déjà en cours/);
    expect(s.envoyer).not.toHaveBeenCalled();
  });

  it("deux clics simultanés : un seul lot passe, les envois ne sont pas doublés", async () => {
    const [a, b] = await Promise.all([lancer(), lancer()]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(s.envoyer).toHaveBeenCalledTimes(3);
  });

  it("le lot se ferme TOUJOURS (finAt) même si un envoi lève", async () => {
    s.envoyer.mockRejectedValueOnce(new Error("boom"));
    await lancer();
    expect(s.lots[0]!.finAt).not.toBeNull();
    s.lots[0]!.finAt = new Date();
    s.lignes = [ligne(1, { statut: "prepare" })];
    s.dejaEnvoye.mockRejectedValueOnce(new Error("journal en panne"));
    // Une ligne en erreur n'arrête pas le lot : comptée en échec, lot fermé.
    expect(await lancer()).toMatchObject({ ok: true, nbEchecs: 1 });
    expect(s.lots[1]!.finAt).not.toBeNull();
  });

  it("la reprise des envois interrompus précède l'insertion du lot", async () => {
    await lancer();
    expect(s.reprise).toHaveBeenCalled();
    expect(s.abandon).toHaveBeenCalled();
  });
});

describe("un enfilage par apporteur", () => {
  it("deux clics successifs : le second n'enfile rien (tout est `envoye`)", async () => {
    const premier = await lancer();
    expect(premier).toMatchObject({ ok: true, nbEnvoyes: 3 });
    const second = await lancer();
    expect(second).toMatchObject({ ok: true, nbCibles: 0, nbEnvoyes: 0 });
    expect(s.envoyer).toHaveBeenCalledTimes(3);
    expect(rows().every((l) => l.statut === "envoye")).toBe(true);
  });

  it("une ligne `envoye` n'est JAMAIS reprise, ni par « tous » ni par « échecs »", async () => {
    s.lignes = [ligne(1, { statut: "envoye" })];
    await lancer("tous");
    s.lots[0]!.finAt = new Date();
    await lancer("echecs");
    expect(s.envoyer).not.toHaveBeenCalled();
  });

  it("seules les lignes d'ORIGINE partent (rang 0) ; un rectificatif préparé ne part pas ici", async () => {
    s.lignes = [ligne(1), ligne(2, { rang: 1, numero: "REL-2026-10-0001-R1" })];
    await lancer();
    expect(s.envoyer).toHaveBeenCalledTimes(1);
  });

  it("une ligne écartée ne part pas", async () => {
    s.lignes = [ligne(1, { statut: "ecarte" }), ligne(2)];
    await lancer();
    expect(s.envoyer).toHaveBeenCalledTimes(1);
  });

  it("la prise est conditionnelle : une ligne déjà prise par un autre n'est pas enfilée", async () => {
    s.prisesRefusees.add("id-1");
    const r = await lancer();
    expect(s.envoyer).toHaveBeenCalledTimes(2);
    expect(r.nbDejaEnvoyes).toBe(1);
  });

  it("l'e-mail déjà parti sous ce jobId est CONSTATÉ, jamais renvoyé", async () => {
    s.dejaEnvoye.mockImplementation(async (j: string) => j.endsWith("a1"));
    const r = await lancer();
    expect(s.envoyer).toHaveBeenCalledTimes(2);
    expect(r).toMatchObject({ nbEnvoyes: 2, nbDejaEnvoyes: 1 });
    expect(rows()[0]!.statut).toBe("envoye");
  });

  it("« Renvoyer les échecs » refusé si l'e-mail est déjà parti : constaté `envoye`, pas renvoyé", async () => {
    s.lignes = [ligne(1, { statut: "echec", erreur: "envoi non parti (indisponible)" })];
    s.dejaEnvoye.mockResolvedValue(true);
    const r = await lancer("echecs");
    expect(s.envoyer).not.toHaveBeenCalled();
    expect(r.nbDejaEnvoyes).toBe(1);
    expect(rows()[0]!.statut).toBe("envoye");
  });

  it("« Renvoyer les échecs » renvoie une ligne en échec dont rien n'est parti", async () => {
    s.lignes = [ligne(1, { statut: "echec", erreur: "envoi non parti (indisponible)" }), ligne(2)];
    const r = await lancer("echecs");
    expect(s.envoyer).toHaveBeenCalledTimes(1);
    expect(r.nbEnvoyes).toBe(1);
    expect(rows()[1]!.statut).toBe("prepare");
  });
});

describe("« Renvoyer les échecs » et les relevés déjà rectifiés", () => {
  it("un relevé `echec` qui a déjà un rectificatif n'est pas renvoyé ; un autre l'est", async () => {
    s.lignes = [
      ligne(1, { statut: "echec", erreur: "envoi non parti (x)", rectifiee: true }),
      ligne(2, { statut: "echec", erreur: "envoi non parti (x)" }),
    ];
    const r = await lancer("echecs");
    expect(s.envoyer).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ nbCibles: 1, nbEnvoyes: 1 });
    expect(rows()[0]!.statut).toBe("echec");
    expect(rows()[1]!.statut).toBe("envoye");
  });
});

describe("ce qui part", () => {
  it("gabarit dédié, jobId déterministe, pièce jointe = le PDF de LA ligne, aucun lien dans la charge", async () => {
    s.lignes = [ligne(1)];
    await lancer();
    const e = s.envoyer.mock.calls[0]![0] as {
      gabarit: string;
      destinataire: string;
      jobId: string;
      entityType: string;
      entityId: string;
      payload: Record<string, unknown>;
      attachments: Array<{ r2Key: string; filename: string }>;
    };
    expect(e.gabarit).toBe("apporteur-releve-mensuel");
    expect(e.jobId).toBe("apporteur-releve-mensuel-2026-10-r0-a1");
    expect(e.destinataire).toBe("apporteur1@exemple.invalid");
    expect(e.entityType).toBe("ApporteurReseau");
    expect(e.entityId).toBe("a1");
    expect(e.attachments).toEqual([
      {
        filename: "REL-2026-10-0001.pdf",
        r2Key: "apporteurs/releves/a1/REL-2026-10-0001-abcd1234.pdf",
        contentType: "application/pdf",
      },
    ]);
    expect(e.payload.pdfR2Key).toBe(e.attachments[0]!.r2Key);
    expect(e.payload.lienEspace).toBeUndefined();
    expect(e.payload.aucunMouvement).toBe(true);
  });

  it("trace : lot, date, auteur du clic et jobId sont écrits sur la ligne", async () => {
    s.lignes = [ligne(1)];
    await lancer();
    expect(rows()[0]).toMatchObject({
      statut: "envoye",
      envoyePar: "console:admin-1",
      emailJobId: "apporteur-releve-mensuel-2026-10-r0-a1",
      envoyeAt: MAINTENANT,
    });
  });

  it("une période non close est refusée avant toute action", async () => {
    await expect(
      envoyerLot({
        periode: "2026-11",
        declenchePar: "console:x",
        mode: "tous",
        maintenant: MAINTENANT,
      }),
    ).rejects.toThrow();
    expect(s.envoyer).not.toHaveBeenCalled();
  });
});

describe("rien ne part de travers", () => {
  it("une cible sans relevé (complétude) bloque TOUT le lot : aucun lot, aucun envoi", async () => {
    s.completude.mockResolvedValue([{ code: "completude", detail: "x" }]);
    const r = await lancer();
    expect(r.ok).toBe(false);
    expect(s.lots).toHaveLength(0);
    expect(s.envoyer).not.toHaveBeenCalled();
  });

  it("données du mois modifiées depuis la vérification : cette ligne ne part pas, les autres partent", async () => {
    let n = 0;
    s.frais.mockImplementation(() => {
      n += 1;
      return n === 2
        ? {
            contenu: { ...contenu, totaux: { ...contenu.totaux, factureHtCents: 1 } },
            anomalies: [],
          }
        : { contenu, anomalies: [] };
    });
    const r = await lancer();
    expect(r).toMatchObject({ nbEnvoyes: 2, nbBloques: 1 });
    expect(rows()[1]!.statut).toBe("prepare");
    expect(rows()[1]!.erreur).toMatch(/^données du mois modifiées/);
  });

  it("le report indicatif (D3) ne bloque pas : seule l'empreinte de contrôle compte", async () => {
    s.frais.mockImplementation(() => ({
      contenu: {
        ...contenu,
        report: { ...contenu.report, indicatif: { auJour: "2026-12-31", lignes: [] } },
      },
      anomalies: [],
    }));
    const r = await lancer();
    expect(r.nbEnvoyes).toBe(3);
  });

  it("adresse e-mail absente : bloqué avec son motif, jamais enfilé", async () => {
    s.lignes = [ligne(1, { apporteur: { prenom: "A", email: "" } }), ligne(2)];
    const r = await lancer();
    expect(r).toMatchObject({ nbEnvoyes: 1, nbBloques: 1 });
    expect(rows()[0]!.erreur).toBe("aucune adresse e-mail");
  });

  it("PDF non stocké : bloqué, jamais enfilé", async () => {
    s.lignes = [ligne(1, { pdfR2Key: null })];
    const r = await lancer();
    expect(r.nbBloques).toBe(1);
    expect(s.envoyer).not.toHaveBeenCalled();
  });

  it("un envoi non parti passe la ligne en `echec` avec son motif ; les autres continuent", async () => {
    s.envoyer.mockResolvedValueOnce("indisponible").mockResolvedValue("envoye");
    const r = await lancer();
    expect(r).toMatchObject({ nbEnvoyes: 2, nbEchecs: 1 });
    expect(rows()[0]).toMatchObject({ statut: "echec", erreur: "envoi non parti (indisponible)" });
  });

  it("une exception d'envoi laisse la ligne `envoi_en_cours` (la reprise tranche), les autres continuent", async () => {
    s.envoyer.mockRejectedValueOnce(new Error("redis")).mockResolvedValue("envoye");
    const r = await lancer();
    expect(r.nbEchecs).toBe(1);
    expect(rows()[0]!.statut).toBe("envoi_en_cours");
    expect(r.nbEnvoyes).toBe(2);
  });
});
