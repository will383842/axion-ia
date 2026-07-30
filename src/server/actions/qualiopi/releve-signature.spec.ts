/**
 * Tests — releve-signature.ts (phase 2, canal B)
 *
 * Les invariants qui comptent ici sont ceux de la COUCHE ACTION, pas ceux du
 * service (déjà couverts par `document-signature-service.spec.ts`) :
 *
 *  1. **Un formateur ne signe que le relevé d'une session qu'il anime.**
 *  2. **La pièce visée est bien un relevé de connexion** — et pas n'importe
 *     quelle pièce dont on aurait deviné l'identifiant.
 *  3. **Les deux parties requises sont déclarées au même endroit** : sans cela,
 *     une pièce passerait `signee` à une signature sur deux.
 *  4. **Une panne de stockage REFUSE la signature**, elle ne la simule pas.
 *  5. **`editor` ne vise pas** : viser engage l'organisme.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: { findUnique: vi.fn() },
    trainingSession: { findUnique: vi.fn() },
  },
}));
vi.mock("@/server/formateur/guard", () => ({ requireFormateurAction: vi.fn() }));
vi.mock("./_guards", () => ({ requireAdminWrite: vi.fn(), logQualiopiActivity: vi.fn() }));
vi.mock("@/server/qualiopi/documents/signature/document-signature-service", () => ({
  signerDocument: vi.fn(),
}));
// ⚠️ Un `Map` NE convient PAS : `Map.get` rend `undefined` là où `Headers.get`
// rend `null`. Le mock doit être fidèle, sinon il fait échouer du code correct —
// ou, plus grave, il fait passer du code qui ne gère pas le vrai contrat.
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { requireFormateurAction } from "@/server/formateur/guard";
import { requireAdminWrite } from "./_guards";
import { signerDocument } from "@/server/qualiopi/documents/signature/document-signature-service";
import { SignatureStockageError } from "@/server/qualiopi/emargement/storage";
import {
  signerReleveFormateurAction,
  viserReleveResponsablePedagogiqueAction,
} from "./releve-signature";

type Mock = ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  documentGenere: { findUnique: Mock };
  trainingSession: { findUnique: Mock };
};
const mockFormateur = requireFormateurAction as unknown as Mock;
const mockAdmin = requireAdminWrite as unknown as Mock;
const mockSigner = signerDocument as unknown as Mock;

const DOC = "11111111-1111-4111-8111-111111111111";
const SESSION = "22222222-2222-4222-8222-222222222222";
const TRAINER = "33333333-3333-4333-8333-333333333333";
const ADMIN = "44444444-4444-4444-8444-444444444444";
const IMAGE = "data:image/png;base64,AAAA";

const ENTREE = { documentGenereId: DOC, methode: "trace" as const, imageDataUrl: IMAGE };

beforeEach(() => {
  vi.clearAllMocks();
  mockFormateur.mockResolvedValue({
    trainerId: TRAINER,
    nom: "Jullin",
    prenom: "Williams",
    email: "w@axion.test",
  });
  mockAdmin.mockResolvedValue({ userId: ADMIN, role: "super_admin" });
  mockPrisma.documentGenere.findUnique.mockResolvedValue({
    type: "releve_connexion",
    numero: "AXI-RC-2026-0007",
    sessionId: SESSION,
  });
  mockPrisma.trainingSession.findUnique.mockResolvedValue({
    formateurPrincipalId: TRAINER,
    sessionFormateurs: [],
  });
  mockSigner.mockResolvedValue({
    ok: true,
    signatureId: "sig-1",
    selfHash: "a".repeat(64),
    statutSignature: "partielle",
  });
});

/** Entrée réellement passée au service, pour inspecter ce qui a été demandé. */
function appelService(): Record<string, unknown> {
  return mockSigner.mock.calls[0]?.[0] as Record<string, unknown>;
}

describe("🔴 signature du formateur", () => {
  it("refuse un formateur qui n'anime PAS la session", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue({
      formateurPrincipalId: "99999999-9999-4999-8999-999999999999",
      sessionFormateurs: [],
    });
    const res = await signerReleveFormateurAction(ENTREE);
    expect(res).toMatchObject({ ok: false, raison: "non_membre" });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("🔴 refuse une pièce qui n'est PAS un relevé de connexion", async () => {
    // Sans ce contrôle, un formateur de session pourrait apposer sa signature
    // « formateur » sur la convention ou la facture de la même session.
    mockPrisma.documentGenere.findUnique.mockResolvedValue({
      type: "convention",
      numero: "AXI-CONV-2026-0042",
      sessionId: SESSION,
    });
    const res = await signerReleveFormateurAction(ENTREE);
    expect(res).toMatchObject({ ok: false, raison: "piece_introuvable" });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("refuse un relevé qui n'est rattaché à aucune session", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue({
      type: "releve_connexion",
      numero: "AXI-RC-2026-0007",
      sessionId: null,
    });
    const res = await signerReleveFormateurAction(ENTREE);
    expect(res).toMatchObject({ ok: false, raison: "non_membre" });
  });

  it("refuse une entrée mal formée sans jamais atteindre le service", async () => {
    // `methode` entre dans le tuple HACHÉ : une valeur hors énumération y serait
    // scellée définitivement.
    const res = await signerReleveFormateurAction({
      ...ENTREE,
      methode: "canvas" as unknown as "trace",
    });
    expect(res).toMatchObject({ ok: false, raison: "requete_invalide" });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("signe au titre de FORMATEUR, jamais d'une autre partie", async () => {
    const res = await signerReleveFormateurAction(ENTREE);
    expect(res).toMatchObject({ ok: true, statutSignature: "partielle" });
    expect(appelService()["porteur"]).toStrictEqual({
      type: "formateur_authentifie",
      trainerId: TRAINER,
      partie: "formateur",
    });
  });

  it("🔴 déclare les DEUX parties requises — sinon la pièce passerait `signee` à 1 sur 2", async () => {
    await signerReleveFormateurAction(ENTREE);
    expect(appelService()["partiesRequises"]).toStrictEqual([
      "formateur",
      "responsable_pedagogique",
    ]);
  });

  it("🔴 une panne de stockage REFUSE la signature, elle ne la simule pas", async () => {
    // Une signature dont l'image n'a pas été écrite est une preuve qui n'existe
    // pas : le formateur aurait vu « signé », le contrôle ne trouverait rien.
    mockSigner.mockRejectedValue(
      new SignatureStockageError("r2_absent", "Stockage R2 non configuré."),
    );
    const res = await signerReleveFormateurAction(ENTREE);
    expect(res).toMatchObject({ ok: false, raison: "stockage" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/papier/);
  });

  it("laisse remonter une erreur qui n'est PAS une panne de stockage", async () => {
    // L'avaler transformerait une panne de base en « signature refusée », et on
    // chercherait le problème du mauvais côté.
    mockSigner.mockRejectedValue(new Error("base indisponible"));
    await expect(signerReleveFormateurAction(ENTREE)).rejects.toThrow("base indisponible");
  });

  it("relaie tel quel un refus typé du service", async () => {
    mockSigner.mockResolvedValue({
      ok: false,
      raison: "piece_specimen",
      message: "Cette pièce est un SPÉCIMEN.",
    });
    const res = await signerReleveFormateurAction(ENTREE);
    expect(res).toMatchObject({ ok: false, raison: "piece_specimen" });
  });
});

describe("🔴 visa du responsable pédagogique", () => {
  it("🔴 un `editor` ne vise PAS — viser engage l'organisme", async () => {
    // `requireAdminWrite` admet `editor` ; le service ne l'admet pas. On refuse
    // ici avec un message qui dit pourquoi, plutôt que de laisser remonter un
    // `identite_non_resolvable` que personne ne saurait interpréter.
    mockAdmin.mockResolvedValue({ userId: ADMIN, role: "editor" });
    const res = await viserReleveResponsablePedagogiqueAction(ENTREE);
    expect(res).toMatchObject({ ok: false, raison: "role_insuffisant" });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("vise au titre de RESPONSABLE PÉDAGOGIQUE, avec l'identité du serveur", async () => {
    const res = await viserReleveResponsablePedagogiqueAction(ENTREE);
    expect(res).toMatchObject({ ok: true });
    expect(appelService()["porteur"]).toStrictEqual({
      type: "organisme_authentifie",
      adminId: ADMIN,
      partie: "responsable_pedagogique",
    });
  });

  it("passe la pièce à `signee` quand le service le dit", async () => {
    mockSigner.mockResolvedValue({
      ok: true,
      signatureId: "sig-2",
      selfHash: "b".repeat(64),
      statutSignature: "signee",
    });
    const res = await viserReleveResponsablePedagogiqueAction(ENTREE);
    expect(res).toMatchObject({ ok: true, statutSignature: "signee" });
  });

  it("refuse une pièce qui n'est pas un relevé", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue({
      type: "facture",
      numero: "AXI-F-2026-0001",
      sessionId: SESSION,
    });
    const res = await viserReleveResponsablePedagogiqueAction(ENTREE);
    expect(res).toMatchObject({ ok: false, raison: "piece_introuvable" });
    expect(mockSigner).not.toHaveBeenCalled();
  });
});
