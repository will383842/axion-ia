/**
 * Lot L7c — signer un contrat-cadre v3 par son lien exige le code F17 ;
 * l'envoi du code ne part qu'à l'adresse de la fiche du formateur.
 *
 * 🔑 Un contrat v2 se signe comme avant : sans code, sans lecture du registre.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: { findUnique: vi.fn() },
    documentSignature: { count: vi.fn(), findMany: vi.fn() },
  },
}));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  verifierTokenDocument: vi.fn(),
}));
vi.mock("@/server/qualiopi/documents/signature/document-signature-service", () => ({
  signerDocument: vi.fn(),
}));
vi.mock("@/server/qualiopi/documents/signature/apres-signature", () => ({
  apresSignature: vi.fn(),
}));
vi.mock("@/server/qualiopi/documents/signature/code-signature", () => ({
  CodeSignatureIndisponible: class extends Error {},
  emettreCodeSignature: vi.fn(),
  verifierCodeSignature: vi.fn(),
}));
vi.mock("@/server/qualiopi/documents/signature/contrat-cadre-signature", async (orig) => ({
  ...(await orig<typeof import("@/server/qualiopi/documents/signature/contrat-cadre-signature")>()),
  objectionContratCadre: vi.fn(async () => null),
}));
vi.mock("@/server/qualiopi/formateurs-independants/envois", () => ({ envoyer: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: (_: string): string | null => null })),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("./_guards", () => ({
  requireAdminWrite: vi.fn(),
  logQualiopiActivity: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  emettreCodeSignature,
  verifierCodeSignature,
} from "@/server/qualiopi/documents/signature/code-signature";
import { objectionContratCadre } from "@/server/qualiopi/documents/signature/contrat-cadre-signature";
import { signerDocument } from "@/server/qualiopi/documents/signature/document-signature-service";
import { verifierTokenDocument } from "@/server/qualiopi/documents/signature/token-document";
import { envoyer } from "@/server/qualiopi/formateurs-independants/envois";

import { demanderCodeSignatureAction, signerPieceParJetonAction } from "./piece-signature";

type Mock = ReturnType<typeof vi.fn>;
const findUnique = prisma.documentGenere.findUnique as unknown as Mock;
const mVerif = verifierTokenDocument as unknown as Mock;
const mSigner = signerDocument as unknown as Mock;
const mCode = verifierCodeSignature as unknown as Mock;
const mEmettre = emettreCodeSignature as unknown as Mock;
const mEnvoyer = envoyer as unknown as Mock;
const mObjection = objectionContratCadre as unknown as Mock;
const mLimit = checkRateLimit as unknown as Mock;

const DOC = "11111111-1111-4111-8111-111111111111";
const V3 = { renderData: { gabaritVersion: 3 } };

beforeEach(() => {
  vi.clearAllMocks();
  mLimit.mockResolvedValue({ allowed: true });
  mVerif.mockResolvedValue({
    ok: true,
    tokenId: "tok",
    documentGenereId: DOC,
    partie: "sous_traitant",
    signataireNom: "Alex Durand",
    signataireEmail: "alex@exemple.fr",
    signataireQualite: null,
  });
  findUnique.mockResolvedValue({
    type: "contrat_sous_traitance",
    numero: "AXI-DOC-2026-950",
    metadata: V3,
    trainerId: "t-1",
    trainer: { email: "Alex@exemple.fr", prenom: "Alex" },
  });
  mSigner.mockResolvedValue({
    ok: true,
    signatureId: "s",
    selfHash: "a",
    statutSignature: "partielle",
  });
  mCode.mockResolvedValue({ ok: true });
  mEmettre.mockResolvedValue({ code: "042517", expiresAt: new Date() });
  mEnvoyer.mockResolvedValue("envoye");
  mObjection.mockResolvedValue(null);
});

const signer = (code?: string) =>
  signerPieceParJetonAction({
    token: "jeton",
    methode: "confirmation_accessible",
    ...(code === undefined ? {} : { code }),
  });

describe("signature d'un contrat-cadre v3 par lien", () => {
  it("🔴 sans code : refus, rien n'est signé", async () => {
    const r = await signer();
    expect(r).toMatchObject({ ok: false, raison: "code_requis" });
    expect(mSigner).not.toHaveBeenCalled();
  });

  it("🔴 code refusé : rien n'est signé", async () => {
    mCode.mockResolvedValue({ ok: false, message: "Ce code n'est pas valide." });
    const r = await signer("123456");
    expect(r).toMatchObject({ ok: false, raison: "code_refuse" });
    expect(mSigner).not.toHaveBeenCalled();
  });

  it("code au mauvais format : refus sans consommer d'essai", async () => {
    const r = await signer("12a456");
    expect(r).toMatchObject({ ok: false, raison: "code_refuse" });
    expect(mCode).not.toHaveBeenCalled();
  });

  it("code valide : signé, avec le consentement « code » scellé", async () => {
    const r = await signer("123456");
    expect(r.ok).toBe(true);
    expect(mCode).toHaveBeenCalledWith({
      documentGenereId: DOC,
      partie: "sous_traitant",
      code: "123456",
    });
    expect(mSigner.mock.calls[0]?.[0]).toMatchObject({
      consentementVersion: "doc-consent-code-v1",
    });
  });

  it("une objection du registre arrête AVANT de consommer le code", async () => {
    mObjection.mockResolvedValue({ message: "Votre entreprise n'apparaît pas active." });
    const r = await signer("123456");
    expect(r).toMatchObject({ ok: false, raison: "piece_non_signable_maintenant" });
    expect(mCode).not.toHaveBeenCalled();
  });

  it("🔑 un contrat v2 se signe comme avant : sans code, consentement ordinaire", async () => {
    findUnique.mockResolvedValue({
      type: "contrat_sous_traitance",
      numero: "AXI-DOC-2026-951",
      metadata: { renderData: { gabaritVersion: 2 } },
    });
    const r = await signer();
    expect(r.ok).toBe(true);
    expect(mCode).not.toHaveBeenCalled();
    expect(mSigner.mock.calls[0]?.[0]).not.toHaveProperty("consentementVersion");
  });
});

describe("envoi du code F17", () => {
  it("part à l'adresse de la fiche, sans priorité, et rend l'adresse masquée", async () => {
    const r = await demanderCodeSignatureAction({ token: "jeton" });
    expect(r).toEqual({ ok: true, destinataireMasque: "A***@e***.fr" });
    const envoi = mEnvoyer.mock.calls[0]?.[0];
    expect(envoi).toMatchObject({
      gabarit: "formateur-code-signature",
      destinataire: "Alex@exemple.fr",
      entityType: "Trainer",
      entityId: "t-1",
      payload: { valeurs: { "123456": "042517" } },
    });
    expect(envoi).not.toHaveProperty("priority");
  });

  it("🔴 le code n'est jamais rendu à l'appelant", async () => {
    const r = await demanderCodeSignatureAction({ token: "jeton" });
    expect(JSON.stringify(r)).not.toContain("042517");
  });

  it("🔴 adresse du lien ≠ adresse de la fiche : aucun code émis ni envoyé", async () => {
    mVerif.mockResolvedValue({
      ok: true,
      tokenId: "tok",
      documentGenereId: DOC,
      partie: "sous_traitant",
      signataireNom: "Alex Durand",
      signataireEmail: "intrus@exemple.fr",
      signataireQualite: null,
    });
    const r = await demanderCodeSignatureAction({ token: "jeton" });
    expect(r).toMatchObject({ ok: false, raison: "code_indisponible" });
    expect(mEmettre).not.toHaveBeenCalled();
    expect(mEnvoyer).not.toHaveBeenCalled();
  });

  it("🔴 plus de 3 envois dans l'heure : refus, rien n'est émis", async () => {
    mLimit.mockResolvedValueOnce({ allowed: false });
    const r = await demanderCodeSignatureAction({ token: "jeton" });
    expect(r).toMatchObject({ ok: false, raison: "trop_de_tentatives" });
    expect(mLimit.mock.calls[0]?.[1]).toEqual({ limit: 3, windowSec: 3600 });
    expect(mEmettre).not.toHaveBeenCalled();
  });

  it("une pièce qui se signe sans code ne déclenche aucun envoi", async () => {
    findUnique.mockResolvedValue({
      type: "contrat_sous_traitance",
      metadata: { renderData: { gabaritVersion: 2 } },
      trainerId: "t-1",
      trainer: { email: "alex@exemple.fr", prenom: "Alex" },
    });
    const r = await demanderCodeSignatureAction({ token: "jeton" });
    expect(r.ok).toBe(false);
    expect(mEmettre).not.toHaveBeenCalled();
  });

  it("texte F17 non validé (rien ne part) : la personne en est informée", async () => {
    mEnvoyer.mockResolvedValue("texte-non-valide");
    const r = await demanderCodeSignatureAction({ token: "jeton" });
    expect(r).toMatchObject({ ok: false, raison: "code_indisponible" });
  });
});
