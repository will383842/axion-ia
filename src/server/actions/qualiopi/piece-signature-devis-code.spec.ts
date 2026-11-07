/**
 * Tests — « Recevoir mon code » pour signer un devis à formules (lot 4 bis), côté action.
 *
 * L'e-mail est transactionnel : il part UNIQUEMENT sur ce clic, à l'adresse figée sur le lien.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: { findUnique: vi.fn() },
    devis: { findFirst: vi.fn() },
    documentSignature: { count: vi.fn() },
  },
}));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  verifierTokenDocument: vi.fn(),
}));
const envoi = vi.hoisted(() => ({ envoyerCodeDevis: vi.fn() }));
vi.mock("@/server/qualiopi/devis/code-signature-devis", () => envoi);
const interrupteur = vi.hoisted(() => ({ formulesActives: vi.fn() }));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => interrupteur);
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: (_: string): string | null => null })),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("./_guards", () => ({
  requireAdminWrite: vi.fn(),
  requireHabilitation: vi.fn(),
  logQualiopiActivity: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifierTokenDocument } from "@/server/qualiopi/documents/signature/token-document";
import { demanderCodeDevisAction } from "./piece-signature";

type Mock = ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  documentGenere: { findUnique: Mock };
  devis: { findFirst: Mock };
  documentSignature: { count: Mock };
};
const mockVerif = verifierTokenDocument as unknown as Mock;
const mockLimit = checkRateLimit as unknown as Mock;

const DOC = "11111111-1111-4111-8111-111111111111";
const TOKEN_ID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  mockLimit.mockResolvedValue({ allowed: true });
  interrupteur.formulesActives.mockResolvedValue(true);
  envoi.envoyerCodeDevis.mockResolvedValue({ ok: true });
  mockVerif.mockResolvedValue({
    ok: true,
    tokenId: TOKEN_ID,
    documentGenereId: DOC,
    partie: "client",
    signataireNom: "Camille Durand",
    signataireEmail: "camille@client.test",
    signataireQualite: "Gérante",
  });
  mockPrisma.documentGenere.findUnique.mockResolvedValue({ type: "devis", metadata: {} });
  mockPrisma.documentSignature.count.mockResolvedValue(0);
  mockPrisma.devis.findFirst.mockImplementation(
    async (args: { select: Record<string, boolean> }) =>
      args.select["statut"] === true
        ? { statut: "envoye" }
        : {
            numero: "AXI-DEV-2026-004",
            offre: { v: 1 },
            offreSha256: "a".repeat(64),
            dateValidite: new Date(Date.now() + 86_400_000),
          },
  );
});

describe("demanderCodeDevisAction", () => {
  it("envoie le code à l'adresse FIGÉE sur le lien et rend l'adresse masquée", async () => {
    const res = await demanderCodeDevisAction({ token: "jeton" });
    expect(res).toMatchObject({ ok: true });
    expect((res as { destinataireMasque: string }).destinataireMasque).not.toContain("camille@");
    expect(envoi.envoyerCodeDevis).toHaveBeenCalledWith({
      documentGenereId: DOC,
      jetonId: TOKEN_ID,
      destinataire: "camille@client.test",
      numeroDevis: "AXI-DEV-2026-004",
    });
  });

  it("🔴 n'accepte aucune adresse venue de la requête", async () => {
    await demanderCodeDevisAction({ token: "jeton", email: "pirate@evil.test" } as never);
    expect(envoi.envoyerCodeDevis.mock.calls[0]![0]).toMatchObject({
      destinataire: "camille@client.test",
    });
  });

  it("🔴 lien expiré ou révoqué : aucun code ne part", async () => {
    mockVerif.mockResolvedValue({ ok: false, raison: "expire" });
    expect(await demanderCodeDevisAction({ token: "jeton" })).toMatchObject({
      raison: "lien_expire",
    });
    mockVerif.mockResolvedValue({ ok: false, raison: "revoque" });
    expect(await demanderCodeDevisAction({ token: "jeton" })).toMatchObject({
      raison: "lien_revoque",
    });
    mockVerif.mockResolvedValue({ ok: false, raison: "inconnu" });
    expect(await demanderCodeDevisAction({ token: "jeton" })).toMatchObject({
      raison: "lien_invalide",
    });
    expect(envoi.envoyerCodeDevis).not.toHaveBeenCalled();
  });

  it("🔴 devis refusé, retiré ou remplacé : aucun code ne part", async () => {
    mockPrisma.devis.findFirst.mockImplementation(
      async (args: { select: Record<string, boolean> }) =>
        args.select["statut"] === true ? { statut: "refuse" } : null,
    );
    expect(await demanderCodeDevisAction({ token: "jeton" })).toMatchObject({
      ok: false,
      raison: "piece_non_signable_maintenant",
    });
    expect(envoi.envoyerCodeDevis).not.toHaveBeenCalled();
  });

  it("🔴 devis expiré (date de validité passée) : aucun code ne part", async () => {
    mockPrisma.devis.findFirst.mockImplementation(
      async (args: { select: Record<string, boolean> }) =>
        args.select["statut"] === true
          ? { statut: "envoye" }
          : {
              numero: "AXI-DEV-2026-004",
              offre: { v: 1 },
              offreSha256: "a".repeat(64),
              dateValidite: new Date(Date.now() - 1000),
            },
    );
    expect(await demanderCodeDevisAction({ token: "jeton" })).toMatchObject({
      raison: "devis_expire",
    });
    expect(envoi.envoyerCodeDevis).not.toHaveBeenCalled();
  });

  it("interrupteur `devis_formules` éteint : aucun code ne part", async () => {
    interrupteur.formulesActives.mockResolvedValue(false);
    expect(await demanderCodeDevisAction({ token: "jeton" })).toMatchObject({
      raison: "piece_non_signable_maintenant",
    });
    expect(envoi.envoyerCodeDevis).not.toHaveBeenCalled();
  });

  it("devis sans formules, ou pièce qui n'est pas un devis : pas de code", async () => {
    mockPrisma.devis.findFirst.mockImplementation(
      async (args: { select: Record<string, boolean> }) =>
        args.select["statut"] === true
          ? { statut: "envoye" }
          : {
              numero: "N",
              offre: null,
              offreSha256: null,
              dateValidite: new Date(Date.now() + 1000),
            },
    );
    expect(await demanderCodeDevisAction({ token: "jeton" })).toMatchObject({
      raison: "piece_non_signable",
    });
    mockPrisma.documentGenere.findUnique.mockResolvedValue({ type: "convention", metadata: {} });
    expect(await demanderCodeDevisAction({ token: "jeton" })).toMatchObject({
      raison: "piece_non_signable",
    });
    expect(envoi.envoyerCodeDevis).not.toHaveBeenCalled();
  });

  it("pièce déjà signée : pas de nouveau code", async () => {
    mockPrisma.documentSignature.count.mockResolvedValue(1);
    expect(await demanderCodeDevisAction({ token: "jeton" })).toMatchObject({
      raison: "deja_signe",
    });
    expect(envoi.envoyerCodeDevis).not.toHaveBeenCalled();
  });

  it("lien d'une autre partie que le client : pas de code", async () => {
    mockVerif.mockResolvedValue({
      ok: true,
      tokenId: TOKEN_ID,
      documentGenereId: DOC,
      partie: "financeur",
      signataireEmail: "x@y.test",
    });
    expect(await demanderCodeDevisAction({ token: "jeton" })).toMatchObject({ ok: false });
    expect(envoi.envoyerCodeDevis).not.toHaveBeenCalled();
  });

  it("lien sans adresse : pas de code, jamais d'adresse de repli", async () => {
    mockVerif.mockResolvedValue({
      ok: true,
      tokenId: TOKEN_ID,
      documentGenereId: DOC,
      partie: "client",
      signataireEmail: null,
    });
    expect(await demanderCodeDevisAction({ token: "jeton" })).toMatchObject({
      raison: "code_indisponible",
    });
    expect(envoi.envoyerCodeDevis).not.toHaveBeenCalled();
  });

  it("les plafonds de l'envoi remontent : trop tôt / trop de codes → `trop_de_tentatives`, blocage → `code_bloque`", async () => {
    envoi.envoyerCodeDevis.mockResolvedValue({ ok: false, raison: "trop_tot", message: "m" });
    expect(await demanderCodeDevisAction({ token: "jeton" })).toMatchObject({
      raison: "trop_de_tentatives",
    });
    envoi.envoyerCodeDevis.mockResolvedValue({ ok: false, raison: "trop_de_codes", message: "m" });
    expect(await demanderCodeDevisAction({ token: "jeton" })).toMatchObject({
      raison: "trop_de_tentatives",
    });
    envoi.envoyerCodeDevis.mockResolvedValue({ ok: false, raison: "bloque", message: "m" });
    expect(await demanderCodeDevisAction({ token: "jeton" })).toMatchObject({
      raison: "code_bloque",
    });
    envoi.envoyerCodeDevis.mockResolvedValue({
      ok: false,
      raison: "envoi_impossible",
      message: "m",
    });
    expect(await demanderCodeDevisAction({ token: "jeton" })).toMatchObject({
      raison: "code_indisponible",
    });
  });

  it("martèlement du lien : le frein par jeton refuse avant toute lecture", async () => {
    mockLimit.mockResolvedValue({ allowed: false });
    expect(await demanderCodeDevisAction({ token: "jeton" })).toMatchObject({
      raison: "trop_de_tentatives",
    });
    expect(mockVerif).not.toHaveBeenCalled();
  });

  it("jeton absent ou démesuré : requête invalide", async () => {
    expect(await demanderCodeDevisAction({ token: "" })).toMatchObject({
      raison: "requete_invalide",
    });
    expect(await demanderCodeDevisAction({ token: "x".repeat(4001) })).toMatchObject({
      raison: "requete_invalide",
    });
    expect(await demanderCodeDevisAction(undefined as never)).toMatchObject({
      raison: "requete_invalide",
    });
  });
});
