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
  mode: "auto" as "auto" | "validation",
  enqueueEmail: vi.fn(),
  creerToken: vi.fn(async (..._a: unknown[]) => ({ token: "tok" })),
  generateDocument: vi.fn(),
}));

// B2, PR 3 : le mode d'envoi est imposé (sans lui, la règle par défaut de `devis-envoi` est
// « validation » et les deux premiers scénarios ne passeraient plus par le chemin « auto »).
vi.mock("@/server/email/outbox-service", () => ({ resoudreMode: async () => h.mode }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(async () => ({
    userId: "00000000-0000-4000-8000-0000000000aa",
    role: "super_admin",
  })),
  requireHabilitation: vi.fn(async () => ({
    userId: "00000000-0000-4000-8000-0000000000aa",
    role: "super_admin",
  })),
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
  creerTokenDocument: (...a: unknown[]) => h.creerToken(...a),
  revoquerTokensDocument: vi.fn(async () => 0),
  TokenDocumentError: class extends Error {},
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => h.enqueueEmail(...a),
  // OUT-1 : sonde « l'envoi est-il déjà fait ? » appelée sous le verrou ; ici, jamais rien en file.
  sonderEnvoiOutbox: async () => "a_faire",
}));
vi.mock("@/server/partners-sync/producteurs/devis", () => ({
  emettreDevisEmis: vi.fn(async () => null),
  emettreDevisSigne: vi.fn(),
  transactionDevisSigne: vi.fn(),
  devisConcernesPourEmission: vi.fn(async () => []),
}));
vi.mock("@/lib/telegram", () => ({ sendTelegram: vi.fn(async () => undefined) }));

import { sendDevisAction } from "../../../src/server/actions/qualiopi/devis";
import { approuverEmailAction } from "../../../src/server/actions/qualiopi/email-outbox";

const db = new PrismaClient();
const HASH = "b".repeat(64);
const dansUnAn = new Date(Date.now() + 365 * 86_400_000);
const creees: { devis: string[]; pieces: string[]; clients: string[]; outbox: string[] } = {
  devis: [],
  pieces: [],
  clients: [],
  outbox: [],
};

afterAll(async () => {
  try {
    await db.emailOutbox.deleteMany({ where: { id: { in: creees.outbox } } });
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
  it("clic en validation, puis DEUX approbations simultanées : brouillon et sans jeton jusqu'à l'approbation, un seul « envoye », un seul jeton, un seul courriel", async () => {
    h.generateDocument.mockReset();
    h.enqueueEmail.mockReset();
    h.creerToken.mockClear();
    h.mode = "validation";
    try {
      const client = await db.client.create({
        data: {
          numero: "TEST-CLI-B2",
          raisonSociale: "Client test B2",
          contactEmail: "client-b2@example.test",
        },
      });
      creees.clients.push(client.id);
      const piece = await db.documentGenere.create({
        data: {
          type: "devis",
          numero: "TEST-DOC-B2",
          // Le module de l'approbation exige que la pièce soit celle de CE client.
          clientId: client.id,
          hashSha256: HASH,
          suppressionPrevueAt: dansUnAn,
        },
      });
      creees.pieces.push(piece.id);
      const devis = await db.devis.create({
        data: {
          numero: "TEST-DEV-B2",
          clientId: client.id,
          lignes: [],
          montantTotalHtCents: 100000,
          mentionTva: "TVA 20 %",
          statut: "brouillon",
          dateValidite: dansUnAn,
        },
      });
      creees.devis.push(devis.id);
      h.generateDocument.mockResolvedValue({ id: piece.id, numero: piece.numero });
      // Garé : la vraie ligne de corbeille est écrite ; approuvé (bypass) : « parti ».
      h.enqueueEmail.mockImplementation(
        async (
          template: string,
          to: string,
          _locale: string,
          payload: Record<string, unknown>,
          options: Record<string, unknown>,
        ) => {
          if (options["bypassValidation"] === true) return { enqueued: true };
          const ligne = await db.emailOutbox.create({
            data: {
              template,
              recipient: to,
              payload: payload as never,
              sujet: "Votre devis",
              entityType: options["entityType"] as string,
              entityId: options["entityId"] as string,
              attachments: options["attachments"] as never,
            },
          });
          creees.outbox.push(ligne.id);
          return { enqueued: false, garePourValidation: true, outboxId: ligne.id };
        },
      );

      // Clic : l'e-mail est garé, le devis reste brouillon, aucun jeton, aucun envoi.
      const clic = await sendDevisAction(devis.id);
      expect(clic).toMatchObject({ data: { garePourValidation: true, signatureCreee: false } });
      expect(h.creerToken).not.toHaveBeenCalled();
      const avant = await db.devis.findUniqueOrThrow({
        where: { id: devis.id },
        select: { statut: true, sentAt: true, documentGenereId: true },
      });
      expect(avant).toEqual({ statut: "brouillon", sentAt: null, documentGenereId: null });
      const ligne = await db.emailOutbox.findFirstOrThrow({
        where: { entityId: devis.id, template: "devis-envoi" },
      });
      expect(JSON.stringify(ligne.payload)).not.toContain("/portail/signer/");

      // Un second clic est refusé tant que l'e-mail attend.
      const clic2 = await sendDevisAction(devis.id);
      expect("error" in clic2).toBe(true);

      // Approbation (deux onglets) : un seul passe.
      const [a, b] = await Promise.all([
        approuverEmailAction({ id: ligne.id }),
        approuverEmailAction({ id: ligne.id }),
      ]);
      expect([a, b].filter((r) => "data" in r)).toHaveLength(1);
      expect(h.creerToken).toHaveBeenCalledTimes(1);
      const bypass = h.enqueueEmail.mock.calls.filter(
        (c) => (c[4] as Record<string, unknown>)["bypassValidation"] === true,
      );
      expect(bypass).toHaveLength(1);
      expect((bypass[0]![3] as Record<string, unknown>)["signatureUrl"]).toContain(
        "/portail/signer/tok",
      );

      const apres = await db.devis.findUniqueOrThrow({
        where: { id: devis.id },
        select: { statut: true, sentAt: true, documentGenereId: true },
      });
      expect(apres.statut).toBe("envoye");
      expect(apres.sentAt).not.toBeNull();
      expect(apres.documentGenereId).toBe(piece.id);
    } finally {
      h.mode = "auto";
    }
  });
  it("B2 PR 4 : DEUX lignes de renvoi du même devis envoyé, approuvées ensemble : un seul nouveau jeton, un seul courriel", async () => {
    h.generateDocument.mockReset();
    h.enqueueEmail.mockReset();
    h.creerToken.mockClear();
    const client = await db.client.create({
      data: {
        numero: "TEST-CLI-B2R",
        raisonSociale: "Client test B2 renvoi",
        contactEmail: "client-b2r@example.test",
      },
    });
    creees.clients.push(client.id);
    const piece = await db.documentGenere.create({
      data: {
        type: "devis",
        numero: "TEST-DOC-B2R",
        clientId: client.id,
        hashSha256: HASH,
        suppressionPrevueAt: dansUnAn,
      },
    });
    creees.pieces.push(piece.id);
    const devis = await db.devis.create({
      data: {
        numero: "TEST-DEV-B2R",
        clientId: client.id,
        lignes: [],
        montantTotalHtCents: 100000,
        mentionTva: "TVA 20 %",
        statut: "envoye",
        sentAt: new Date(),
        documentGenereId: piece.id,
        dateValidite: dansUnAn,
      },
    });
    creees.devis.push(devis.id);
    const marqueur = {
      v: 1,
      nature: "devis-renvoi",
      documentGenereId: piece.id,
      partie: "client",
      devisId: devis.id,
    };
    const lignes = [];
    for (let i = 0; i < 2; i++) {
      const ligne = await db.emailOutbox.create({
        data: {
          template: "devis-envoi",
          recipient: "client-b2r@example.test",
          payload: { numero: "TEST-DEV-B2R", lienSignatureALEnvoi: marqueur } as never,
          sujet: "Votre devis",
          entityType: "Devis",
          entityId: devis.id,
        },
      });
      creees.outbox.push(ligne.id);
      lignes.push(ligne);
    }
    // L'enfilage « dure » : les deux approbations se chevauchent.
    h.enqueueEmail.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 300));
      return { enqueued: true };
    });

    const [a, b] = await Promise.all([
      approuverEmailAction({ id: lignes[0]!.id }),
      approuverEmailAction({ id: lignes[1]!.id }),
    ]);

    expect([a, b].filter((r) => "data" in r)).toHaveLength(1);
    expect(h.creerToken).toHaveBeenCalledTimes(1);
    expect(h.enqueueEmail).toHaveBeenCalledTimes(1);
    const apres = await db.devis.findUniqueOrThrow({
      where: { id: devis.id },
      select: { statut: true },
    });
    expect(apres.statut).toBe("envoye");
  });
});
