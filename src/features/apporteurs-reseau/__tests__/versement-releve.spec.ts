import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  statutApporteur: "signe" as string,
  aRegler: [] as Array<{ id: string; statut: string; montantCents: number }>,
  maj: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
  stockage: "ok" as "ok" | "ko",
  envoyes: [] as Array<Record<string, unknown>>,
  enAttente: [] as Array<Record<string, unknown>>,
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
      updateMany: vi.fn(
        async (a: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
          etat.maj.push(a);
          const ids = (a.where.id as { in: string[] }).in;
          return { count: ids.length };
        },
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
});
