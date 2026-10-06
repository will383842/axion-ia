import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  statutApporteur: "signe" as string,
  aRegler: [] as Array<{ id: string; statut: string; montantCents: number }>,
  maj: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
  stockage: "ok" as "ok" | "ko",
  envoyes: [] as Array<Record<string, unknown>>,
  enAttente: [] as Array<Record<string, unknown>>,
  /** Cumul de vigilance (due + versée + en attente) et pièces valides pour ce test. */
  cumulCents: 0,
  piecesValides: true,
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: unknown) => v }));
vi.mock("../jeton", () => ({ urlDossier: () => null }));
vi.mock("../envois", () => ({
  envoyer: vi.fn(async (e: Record<string, unknown>) => {
    etat.envoyes.push(e);
    return "envoye";
  }),
}));
vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: async () => ({ raisonSociale: "Axion IA" }),
}));
vi.mock("@/server/qualiopi/documents/render", () => ({
  renderPdfToBuffer: async () => ({ buffer: Buffer.from("pdf") }),
  storeAndSignPdf: vi.fn(async () => (etat.stockage === "ok" ? "https://signe" : null)),
}));
vi.mock("@/server/qualiopi/documents/templates/autofacture-honoraires", () => ({
  AutofactureHonorairesPdf: () => null,
}));
vi.mock("@/lib/prisma", () => {
  const prisma = {
    apporteurReseau: {
      findUnique: vi.fn(async () => ({
        id: "APP1",
        prenom: "Jeanne",
        nom: "Martin",
        email: "j@m.fr",
        statut: etat.statutApporteur,
        denomination: null,
        siren: "123456782",
        adresse: "1 rue des Lilas, 69000 Lyon",
        regimeTva: "franchise_293b",
        numeroTva: null,
      })),
    },
    commissionApporteur: {
      findMany: vi.fn(async (a: { where: Record<string, unknown> }) => {
        if ("autofactureNumero" in a.where) return [];
        if ("id" in a.where)
          return etat.aRegler.map((c) => ({
            ...c,
            activite: c.statut === "reprise" ? "reprise" : "audit",
            palier: null,
            parrainage: false,
            prixPublicHtCents: null,
            factureHtCents: 100_000,
          }));
        return etat.aRegler;
      }),
      aggregate: vi.fn(async () => ({ _sum: { montantCents: etat.cumulCents } })),
      updateMany: vi.fn(
        async (a: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
          etat.maj.push(a);
          const ids = (a.where.id as { in: string[] }).in;
          return { count: ids.length };
        },
      ),
    },
    // Cumul de vigilance et pièces : par défaut sous le seuil, pièces valides.
    pieceApporteur: {
      findMany: vi.fn(async () =>
        etat.piecesValides
          ? [
              {
                type: "vigilance",
                statut: "conforme",
                expireAt: new Date("2027-06-01T00:00:00Z"),
                remplaceeAt: null,
              },
              { type: "immatriculation", statut: "conforme", expireAt: null, remplaceeAt: null },
            ]
          : [
              {
                type: "vigilance",
                statut: "conforme",
                expireAt: new Date("2026-09-30T00:00:00Z"),
                remplaceeAt: null,
              },
              { type: "immatriculation", statut: "conforme", expireAt: null, remplaceeAt: null },
            ],
      ),
    },
    numeroEmis: { findMany: vi.fn(async () => []) },
    $transaction: async (cb: (tx: unknown) => unknown) => cb(prisma),
  };
  return { prisma };
});

import { marquerVerse } from "../commissions";

const OCTOBRE = new Date("2026-10-15T10:00:00Z");
const JANVIER = new Date("2026-01-15T10:00:00Z");
const ligne = (id: string, statut: string, montantCents: number) => ({ id, statut, montantCents });

beforeEach(() => {
  etat.statutApporteur = "signe";
  etat.aRegler = [];
  etat.maj = [];
  etat.stockage = "ok";
  etat.envoyes = [];
  etat.cumulCents = 0;
  etat.piecesValides = true;
});

describe("versement du relevé : jamais sans pièce, reprises déduites", () => {
  it("relevé sous le seuil de 50 € hors janvier : rien n'est versé, rien n'est écrit", async () => {
    etat.aRegler = [ligne("c1", "due", 3_000)];
    const r = await marquerVerse("APP1", OCTOBRE);
    expect(r.ok).toBe(false);
    expect(etat.maj).toEqual([]);
  });

  it("au-dessus du seuil : versé, autofacture jointe à l'e-mail", async () => {
    etat.aRegler = [ligne("c1", "due", 40_000), ligne("c2", "due", 10_000)];
    const r = await marquerVerse("APP1", OCTOBRE);
    expect(r).toMatchObject({ ok: true, totalCents: 50_000 });
    expect(etat.maj[0]!.data).toMatchObject({ statut: "versee", releveMois: "2026-10" });
    expect(etat.envoyes[0]!.attachments).toHaveLength(1);
  });

  it("le PDF échoue : AUCUNE commission n'est marquée versée, aucun e-mail ne part", async () => {
    etat.stockage = "ko";
    etat.aRegler = [ligne("c1", "due", 40_000)];
    const r = await marquerVerse("APP1", OCTOBRE);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("rien n'a été marqué versé");
    expect(etat.maj).toEqual([]);
    expect(etat.envoyes).toEqual([]);
  });

  it("le PDF réussit à la reprise de l'opération : le même bouton rejoue", async () => {
    etat.stockage = "ko";
    etat.aRegler = [ligne("c1", "due", 40_000)];
    expect((await marquerVerse("APP1", OCTOBRE)).ok).toBe(false);
    etat.stockage = "ok";
    expect((await marquerVerse("APP1", OCTOBRE)).ok).toBe(true);
    expect(etat.maj).not.toEqual([]);
  });

  it("une reprise est déduite du relevé et imputée à ce même numéro", async () => {
    etat.aRegler = [ligne("c1", "due", 40_000), ligne("r1", "reprise", -15_000)];
    const r = await marquerVerse("APP1", OCTOBRE);
    expect(r).toMatchObject({ ok: true, totalCents: 25_000 });
    const [dues, reprises] = etat.maj;
    expect(dues!.data.statut).toBe("versee");
    expect(reprises!.data.statut).toBeUndefined();
    expect(reprises!.data.autofactureNumero).toBe(dues!.data.autofactureNumero);
  });

  it("reprise plus grosse que les commissions dues : solde négatif, pas de relevé, la reprise reste à imputer", async () => {
    etat.aRegler = [ligne("c1", "due", 10_000), ligne("r1", "reprise", -15_000)];
    const r = await marquerVerse("APP1", OCTOBRE);
    expect(r.ok).toBe(false);
    expect(etat.maj).toEqual([]);
  });

  it("dernier relevé d'un contrat résilié : aucun seuil minimal (art. 12.2)", async () => {
    etat.statutApporteur = "resilie";
    etat.aRegler = [ligne("c1", "due", 3_000)];
    const r = await marquerVerse("APP1", OCTOBRE);
    expect(r).toMatchObject({ ok: true, totalCents: 3_000 });
  });

  it("janvier : le seuil ne s'applique pas (art. 5.3)", async () => {
    etat.aRegler = [ligne("c1", "due", 3_000)];
    expect((await marquerVerse("APP1", JANVIER)).ok).toBe(true);
  });

  it("attestation périmée et cumul au-delà de 5 000 € : rien n'est versé, les commissions repassent en attente de vigilance", async () => {
    etat.aRegler = [ligne("c1", "due", 40_000), ligne("r1", "reprise", -5_000)];
    etat.cumulCents = 600_000;
    etat.piecesValides = false;
    const r = await marquerVerse("APP1", OCTOBRE);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("vigilance");
    expect(etat.envoyes).toEqual([]);
    expect(etat.maj).toHaveLength(1);
    expect(etat.maj[0]!.data).toEqual({ statut: "en_attente_vigilance" });
    // Seules les commissions dues sont remises en attente, pas la reprise.
    expect((etat.maj[0]!.where.id as { in: string[] }).in).toEqual(["c1"]);
  });

  it("attestation périmée mais cumul sous le seuil de vigilance : le versement part", async () => {
    etat.aRegler = [ligne("c1", "due", 40_000)];
    etat.cumulCents = 100_000;
    etat.piecesValides = false;
    expect((await marquerVerse("APP1", OCTOBRE)).ok).toBe(true);
  });

  it("cumul au-delà de 5 000 € avec pièces valides : le versement part", async () => {
    etat.aRegler = [ligne("c1", "due", 40_000)];
    etat.cumulCents = 600_000;
    expect((await marquerVerse("APP1", OCTOBRE)).ok).toBe(true);
  });
});
