/**
 * Vérification 1, lot 2 — V1-A-8 : un changement d'adresse fait en console invalide,
 * dans la MÊME écriture que l'adresse, les codes de signature encore valables. Avant
 * la correction, le code reçu à l'ANCIENNE adresse signait encore le contrat.
 *
 * Et l'adresse remplacée est gardée, datée (V1-C-6, V1-D-1).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const d = {
    trainer: { findUnique: vi.fn(), update: vi.fn() },
    documentGenere: { findMany: vi.fn() },
    documentSignatureCode: { updateMany: vi.fn() },
    formateurMagicLink: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  };
  return d;
});
const envoyer = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/qualiopi/formateurs-independants/envois", () => ({ envoyer }));

import {
  ecrireFicheAvecChangementEmail,
  type ChangementEmailIndependant,
} from "@/server/qualiopi/formateurs-independants/changement-email-console";

const ID = "3f2a9c1e-0b7d-4c55-9e21-6a8f0d4b7c13";
const CONTRAT = "9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d";
const MAINTENANT = new Date("2026-10-15T10:00:00Z");
const CHANGEMENT: ChangementEmailIndependant = {
  ancienneAdresse: "ancienne@example.test",
  prenom: "Basile",
};

/** Le client de la transaction est un objet DISTINCT : on voit ce qui passe par lui. */
const tx = {
  trainer: { update: vi.fn() },
  documentGenere: { findMany: vi.fn() },
  documentSignatureCode: { updateMany: vi.fn() },
  documentSignatureToken: { updateMany: vi.fn() },
};

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx));
  tx.documentGenere.findMany.mockResolvedValue([{ id: CONTRAT }]);
  tx.documentSignatureCode.updateMany.mockResolvedValue({ count: 1 });
  tx.documentSignatureToken.updateMany.mockResolvedValue({ count: 0 });
  tx.trainer.update.mockResolvedValue({ id: ID });
  db.trainer.update.mockResolvedValue({ id: ID });
});

describe("V1-A-8 — changement d'adresse : les codes de signature tombent avec elle", () => {
  it("adresse changée : codes vivants invalidés DANS la transaction de l'adresse", async () => {
    await ecrireFicheAvecChangementEmail({
      trainerId: ID,
      data: { email: "nouvelle@example.test" },
      changement: CHANGEMENT,
      maintenant: MAINTENANT,
    });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    // Rien n'est écrit hors de la transaction.
    expect(db.trainer.update).not.toHaveBeenCalled();
    expect(tx.trainer.update).toHaveBeenCalledWith({
      where: { id: ID },
      data: {
        email: "nouvelle@example.test",
        accesVersion: { increment: 1 },
        emailRemplace: "ancienne@example.test",
        emailRemplaceAt: MAINTENANT,
      },
    });
    expect(tx.documentGenere.findMany).toHaveBeenCalledWith({
      where: { trainerId: ID },
      select: { id: true },
    });
    expect(tx.documentSignatureCode.updateMany).toHaveBeenCalledWith({
      where: {
        documentGenereId: { in: [CONTRAT] },
        partie: "sous_traitant",
        utiliseAt: null,
        invalideAt: null,
      },
      data: { invalideAt: MAINTENANT },
    });
  });

  it("l'invalidation échoue : l'écriture entière échoue (rien n'est changé à moitié)", async () => {
    tx.documentSignatureCode.updateMany.mockRejectedValue(new Error("panne"));
    await expect(
      ecrireFicheAvecChangementEmail({
        trainerId: ID,
        data: { email: "nouvelle@example.test" },
        changement: CHANGEMENT,
        maintenant: MAINTENANT,
      }),
    ).rejects.toThrow("panne");
  });

  it("sans changement d'adresse d'un indépendant : écriture simple, aucun code touché", async () => {
    await ecrireFicheAvecChangementEmail({
      trainerId: ID,
      data: { nom: "Durand" },
      changement: null,
      maintenant: MAINTENANT,
    });
    expect(db.trainer.update).toHaveBeenCalledWith({ where: { id: ID }, data: { nom: "Durand" } });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(tx.documentSignatureCode.updateMany).not.toHaveBeenCalled();
  });
});

describe("V2-S-3 — changement d'adresse : les liens de signature tombent avec elle", () => {
  const LETTRE = "5c6d7e8f-9a0b-4c1d-8e2f-3a4b5c6d7e8f";
  const SIGNEE = "1b2c3d4e-5f6a-4b7c-9d8e-0f1a2b3c4d5e";

  it("liens vivants révoqués DANS la transaction de l'adresse ; non signées à renvoyer", async () => {
    tx.documentGenere.findMany.mockImplementation(async (q: { where: object }) =>
      "signatureTokens" in q.where
        ? [
            { id: LETTRE, annuleeAt: null, signatures: [] },
            { id: CONTRAT, annuleeAt: null, signatures: [] },
            { id: SIGNEE, annuleeAt: null, signatures: [{ id: "s" }] },
          ]
        : [{ id: CONTRAT }],
    );
    const r = await ecrireFicheAvecChangementEmail({
      trainerId: ID,
      data: { email: "nouvelle@example.test" },
      changement: CHANGEMENT,
      maintenant: MAINTENANT,
      parAdminId: "admin-1",
    });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.documentSignatureToken.updateMany).toHaveBeenCalledWith({
      where: {
        documentGenereId: { in: [LETTRE, CONTRAT, SIGNEE] },
        partie: { in: ["formateur", "sous_traitant"] },
        revokedAt: null,
      },
      data: {
        revokedAt: MAINTENANT,
        revokedMotif: expect.stringContaining("à renvoyer"),
        revokedById: "admin-1",
      },
    });
    // Les codes de la partie « formateur » (lettres de mission) tombent aussi.
    expect(tx.documentSignatureCode.updateMany).toHaveBeenCalledWith({
      where: {
        documentGenereId: { in: [LETTRE, CONTRAT, SIGNEE] },
        partie: "formateur",
        utiliseAt: null,
        invalideAt: null,
      },
      data: { invalideAt: MAINTENANT },
    });
    expect(r).toEqual({ piecesARenvoyer: 2 });
  });

  it("la révocation échoue : l'écriture entière échoue (l'adresse ne change pas seule)", async () => {
    tx.documentGenere.findMany.mockResolvedValue([{ id: LETTRE, annuleeAt: null, signatures: [] }]);
    tx.documentSignatureToken.updateMany.mockRejectedValue(new Error("panne"));
    await expect(
      ecrireFicheAvecChangementEmail({
        trainerId: ID,
        data: { email: "nouvelle@example.test" },
        changement: CHANGEMENT,
        maintenant: MAINTENANT,
      }),
    ).rejects.toThrow("panne");
  });

  it("sans changement d'adresse : aucun lien touché", async () => {
    const r = await ecrireFicheAvecChangementEmail({
      trainerId: ID,
      data: { nom: "Durand" },
      changement: null,
      maintenant: MAINTENANT,
    });
    expect(tx.documentSignatureToken.updateMany).not.toHaveBeenCalled();
    expect(r).toEqual({ piecesARenvoyer: 0 });
  });
});
