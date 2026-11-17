/**
 * B1 — deux envois SIMULTANÉS du même brouillon : un seul passe « envoye » (Gate D, Postgres réel :
 * étape « Devis : tests d'intégration (expiration, envoi concurrent) » de `.github/workflows/ci.yml`,
 * `pnpm test:integration tests/integration/devis`).
 *
 * C'est le verrou consultatif `pg_try_advisory_xact_lock` + l'écriture gardée
 * (`updateMany … statut: "brouillon"`) de `sendDevisAction` qui sont éprouvés ici, sur la vraie
 * base. Tout ce qui sort de la base est simulé : PDF, lien de signature, file d'e-mails.
 * Le test écrit ses propres lignes (client, pièce, devis) et les supprime en fin de test.
 *
 * Sans `DATABASE_URL`, ce fichier ÉCHOUE — il ne se saute pas.
 */
import { afterAll, describe, expect, it, vi } from "vitest";

import { PrismaClient } from "../../../prisma/generated/client";

const h = vi.hoisted(() => ({
  pieceId: "" as string,
  enqueueEmail: vi.fn(),
  generateDocument: vi.fn(),
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(async () => ({ userId: "adm-test", role: "super_admin" })),
  requireHabilitation: vi.fn(async () => ({ userId: "adm-test", role: "super_admin" })),
  logQualiopiActivity: vi.fn(async () => undefined),
}));
vi.mock("@/server/actions/qualiopi/documents", () => ({ genererConventionAction: vi.fn() }));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => ({
  formulesActives: async () => false,
}));
vi.mock("@/server/qualiopi/documents/donnees-pdf-devis", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/qualiopi/documents/donnees-pdf-devis")>()),
  lireContextePdfDevis: vi.fn(async () => ({})),
  donneesPdfDevis: vi.fn(() => ({ identite: {}, formules: undefined })),
}));
vi.mock("@/server/qualiopi/documents/documents-service", () => ({
  generateDocument: (...a: unknown[]) => h.generateDocument(...a),
}));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  creerTokenDocument: vi.fn(async () => ({ token: "tok" })),
  revoquerTokensDocument: vi.fn(async () => 0),
  TokenDocumentError: class extends Error {},
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => h.enqueueEmail(...a),
}));
vi.mock("@/server/partners-sync/producteurs/devis", () => ({
  emettreDevisEmis: vi.fn(async () => null),
  emettreDevisSigne: vi.fn(),
  transactionDevisSigne: vi.fn(),
  devisConcernesPourEmission: vi.fn(async () => []),
}));
vi.mock("@/lib/telegram", () => ({ sendTelegram: vi.fn(async () => undefined) }));

import { sendDevisAction } from "../../../src/server/actions/qualiopi/devis";

const db = new PrismaClient();
const HASH = "b".repeat(64);
const dansUnAn = new Date(Date.now() + 365 * 86_400_000);
const creees: { devis: string[]; pieces: string[]; clients: string[] } = {
  devis: [],
  pieces: [],
  clients: [],
};

afterAll(async () => {
  try {
    await db.devis.deleteMany({ where: { id: { in: creees.devis } } });
    await db.documentGenere.deleteMany({ where: { id: { in: creees.pieces } } });
    await db.client.deleteMany({ where: { id: { in: creees.clients } } });
  } catch (e) {
    // Nettoyage au mieux : la base de CI est jetable.
    console.warn("[envoi-concurrent] nettoyage incomplet", e);
  } finally {
    await db.$disconnect();
  }
});

describe("envoi simultané du même brouillon, Postgres réel (B1)", () => {
  it("Promise.all de deux envois : un seul « envoye », un seul courriel, un seul PDF", async () => {
    const client = await db.client.create({
      data: {
        numero: "TEST-CLI-B1",
        raisonSociale: "Client test B1",
        contactEmail: "client-b1@example.test",
      },
    });
    creees.clients.push(client.id);
    const piece = await db.documentGenere.create({
      data: {
        type: "devis",
        numero: "TEST-DOC-B1",
        hashSha256: HASH,
        suppressionPrevueAt: dansUnAn,
      },
    });
    creees.pieces.push(piece.id);
    const devis = await db.devis.create({
      data: {
        numero: "TEST-DEV-B1",
        clientId: client.id,
        lignes: [],
        montantTotalHtCents: 100000,
        mentionTva: "TVA 20 %",
        statut: "brouillon",
        dateValidite: dansUnAn,
      },
    });
    creees.devis.push(devis.id);

    // Le PDF « dure » : les deux appels se chevauchent pendant sa génération.
    h.generateDocument.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 400));
      return { id: piece.id, numero: piece.numero };
    });
    h.enqueueEmail.mockResolvedValue({ enqueued: true });

    const [a, b] = await Promise.all([sendDevisAction(devis.id), sendDevisAction(devis.id)]);

    const succes = [a, b].filter((r) => "data" in r);
    const refus = [a, b].filter((r) => "error" in r);
    expect(succes).toHaveLength(1);
    expect(refus).toHaveLength(1);
    expect((refus[0] as { error: string }).error).toMatch(/déjà en cours|déjà été envoyé/);
    expect(h.generateDocument).toHaveBeenCalledTimes(1);
    expect(h.enqueueEmail).toHaveBeenCalledTimes(1);

    const apres = await db.devis.findUniqueOrThrow({
      where: { id: devis.id },
      select: { statut: true, sentAt: true, documentGenereId: true },
    });
    expect(apres.statut).toBe("envoye");
    expect(apres.sentAt).not.toBeNull();
    expect(apres.documentGenereId).toBe(piece.id);
  });

  it("brouillon enregistré pendant le PDF : l'envoi échoue, le devis reste brouillon", async () => {
    h.generateDocument.mockReset();
    h.enqueueEmail.mockReset();
    const client = await db.client.create({
      data: {
        numero: "TEST-CLI-B1B",
        raisonSociale: "Client test B1b",
        contactEmail: "client-b1b@example.test",
      },
    });
    creees.clients.push(client.id);
    const piece = await db.documentGenere.create({
      data: {
        type: "devis",
        numero: "TEST-DOC-B1B",
        hashSha256: HASH,
        suppressionPrevueAt: dansUnAn,
      },
    });
    creees.pieces.push(piece.id);
    const devis = await db.devis.create({
      data: {
        numero: "TEST-DEV-B1B",
        clientId: client.id,
        lignes: [],
        montantTotalHtCents: 100000,
        mentionTva: "TVA 20 %",
        statut: "brouillon",
        dateValidite: dansUnAn,
      },
    });
    creees.devis.push(devis.id);

    // Pendant la génération du PDF, l'écran de modification enregistre le brouillon.
    h.generateDocument.mockImplementation(async () => {
      await db.devis.update({ where: { id: devis.id }, data: { montantTotalHtCents: 200000 } });
      return { id: piece.id, numero: piece.numero };
    });
    h.enqueueEmail.mockResolvedValue({ enqueued: true });

    const r = await sendDevisAction(devis.id);
    expect("error" in r).toBe(true);

    const apres = await db.devis.findUniqueOrThrow({
      where: { id: devis.id },
      select: { statut: true, sentAt: true },
    });
    expect(apres.statut).toBe("brouillon");
    expect(apres.sentAt).toBeNull();
  });
});
