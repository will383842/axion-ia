/**
 * Garde — le tirage « à jour » ne porte jamais le numéro d'une feuille ANNULÉE.
 *
 * Ce tirage se présente comme la RÉIMPRESSION de la pièce du registre : il en
 * emprunte le numéro, et le nom du fichier téléchargé est « <numero>-a-jour.pdf ».
 * Emprunter le numéro d'une feuille que le registre déclare sans valeur produit
 * donc un document qui se réclame d'une pièce annulée — la doctrine
 * d'`audit-dossier.ts` dit l'inverse : « une pièce annulée ne se compte NULLE
 * PART ».
 *
 * Le modèle existe dans le même dépôt : `documents-service.ts` filtre
 * `annuleeAt: null` en choisissant la pièce remplacée, « la chaîne de
 * remplacement doit désigner la dernière qui faisait foi ».
 *
 * Retomber sur « — non émise au registre — » n'est pas une régression : c'est
 * exact. Aucune feuille en vigueur ne porte cette session.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const findFirstMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { documentGenere: { findFirst: (...args: unknown[]) => findFirstMock(...args) } },
}));

vi.mock("@/server/qualiopi/documents/render", () => ({
  renderPdfToBuffer: vi.fn(async () => ({ buffer: Buffer.from("%PDF-1.7") })),
}));

const numerosImprimes: string[] = [];
vi.mock("@/server/qualiopi/documents/emargement-tirage", () => ({
  construireTirageEmargement: vi.fn(async () => ({
    ok: true as const,
    element: (numero: string) => {
      // Le numéro IMPRIMÉ sur le PDF, capturé : c'est lui qui fait la fausse
      // affirmation, pas seulement le nom du fichier.
      numerosImprimes.push(numero);
      return null;
    },
  })),
}));

import { GET } from "./route";

const SESSION = "44444444-4444-4444-8444-444444444444";

function requete(): Request {
  return new Request(`https://test.local/api/qualiopi/sessions/${SESSION}/emargement`);
}

beforeEach(() => {
  vi.clearAllMocks();
  numerosImprimes.length = 0;
  authMock.mockResolvedValue({ user: { id: "admin-1", role: "super_admin" } });
  findFirstMock.mockResolvedValue(null);
});

describe("🔴 GET emargement — la feuille annulée ne prête plus son numéro", () => {
  it("écarte les feuilles annulées de la requête", async () => {
    await GET(requete() as never, { params: Promise.resolve({ id: SESSION }) });

    const where = (findFirstMock.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
    expect(where).toMatchObject({ annuleeAt: null });
  });

  it("retombe sur « non émise au registre » quand la seule feuille est annulée", async () => {
    // Avec le filtre, Prisma ne rend plus rien : le tirage doit le DIRE, et non
    // se réclamer d'une pièce sans valeur.
    findFirstMock.mockResolvedValue(null);

    const res = await GET(requete() as never, { params: Promise.resolve({ id: SESSION }) });

    expect(numerosImprimes).toEqual(["— non émise au registre —"]);
    expect(res.headers.get("Content-Disposition")).toContain(`emargement-${SESSION}.pdf`);
  });

  it("porte encore le numéro d'une feuille EN VIGUEUR — la garde ne bloque pas le cas sain", async () => {
    findFirstMock.mockResolvedValue({ numero: "AXI-DOC-2026-011" });

    const res = await GET(requete() as never, { params: Promise.resolve({ id: SESSION }) });

    expect(numerosImprimes).toEqual(["AXI-DOC-2026-011"]);
    expect(res.headers.get("Content-Disposition")).toContain("AXI-DOC-2026-011-a-jour.pdf");
  });
});
