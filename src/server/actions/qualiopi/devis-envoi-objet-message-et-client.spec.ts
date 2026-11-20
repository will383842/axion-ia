/**
 * `sendDevisAction` — objet et message personnels, clientId et règle du client (lot 1 de l'aperçu
 * de l'e-mail). Mêmes doublures que `devis-envoi-rien-ne-part.spec.ts`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  txOptions: vi.fn(),
  txDevisFindUnique: vi.fn(),
  txDevisUpdateMany: vi.fn(),
  txDevisUpdate: vi.fn(),
  txDevisCount: vi.fn(),
  statuts: {} as Record<string, string>,
  enAttente: {} as Record<string, string>,
  txClientUpdateMany: vi.fn(),
  txTokenUpdateMany: vi.fn(),
  txOutboxFindFirst: vi.fn(),
  outboxUpdateMany: vi.fn(),
  outboxFindUnique: vi.fn(),
  generateDocument: vi.fn(),
  creerToken: vi.fn(),
  revoquer: vi.fn(),
  enqueueEmail: vi.fn(),
  emettre: vi.fn(),
  logActivity: vi.fn(),
  sentry: vi.fn(),
  sentryMessage: vi.fn(),
  formules: vi.fn(),
  telegram: vi.fn(),
  mode: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailOutbox: {
      updateMany: (...a: unknown[]) => h.outboxUpdateMany(...a),
      findUnique: (...a: unknown[]) => h.outboxFindUnique(...a),
    },
    $transaction: async (f: (t: unknown) => unknown, options?: unknown) => {
      h.txOptions(options);
      h.enAttente = {};
      const resultat = await f({
        $queryRaw: (...a: unknown[]) => h.queryRaw(...a),
        devis: {
          findUnique: (...a: unknown[]) => h.txDevisFindUnique(...a),
          updateMany: (...a: unknown[]) => h.txDevisUpdateMany(...a),
          update: (...a: unknown[]) => h.txDevisUpdate(...a),
          count: (...a: unknown[]) => h.txDevisCount(...a),
        },
        client: { updateMany: (...a: unknown[]) => h.txClientUpdateMany(...a) },
        documentSignatureToken: { updateMany: (...a: unknown[]) => h.txTokenUpdateMany(...a) },
        emailOutbox: { findFirst: (...a: unknown[]) => h.txOutboxFindFirst(...a) },
      });
      // Validation : les statuts écrits n'existent qu'après un COMMIT (une exception les annule).
      Object.assign(h.statuts, h.enAttente);
      return resultat;
    },
  },
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: (...a: unknown[]) => h.sentry(...a),
  captureMessage: (...a: unknown[]) => h.sentryMessage(...a),
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(async () => ({ userId: "adm-1", role: "super_admin" })),
  requireHabilitation: vi.fn(async () => ({ userId: "adm-1", role: "super_admin" })),
  logQualiopiActivity: (...a: unknown[]) => h.logActivity(...a),
}));
vi.mock("@/server/actions/qualiopi/documents", () => ({ genererConventionAction: vi.fn() }));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => ({
  formulesActives: async () => h.formules(),
}));
vi.mock("@/server/qualiopi/documents/donnees-pdf-devis", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/qualiopi/documents/donnees-pdf-devis")>()),
  lireContextePdfDevis: vi.fn(async () => ({})),
  donneesPdfDevis: vi.fn(() => ({
    identite: { raisonSociale: "Axion", siret: "1", adresseSiege: "x", nda: "n", qualiopi: "q" },
    formules: undefined,
  })),
}));
vi.mock("@/server/qualiopi/documents/documents-service", () => ({
  generateDocument: (...a: unknown[]) => h.generateDocument(...a),
}));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  creerTokenDocument: (...a: unknown[]) => h.creerToken(...a),
  revoquerTokensDocument: (...a: unknown[]) => h.revoquer(...a),
  TokenDocumentError: class extends Error {
    motif = "x";
  },
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => h.enqueueEmail(...a),
}));
vi.mock("@/server/partners-sync/producteurs/devis", () => ({
  emettreDevisEmis: (...a: unknown[]) => h.emettre(...a),
  emettreDevisSigne: vi.fn(),
  transactionDevisSigne: vi.fn(),
  devisConcernesPourEmission: vi.fn(async () => []),
}));
vi.mock("@/server/email/outbox-service", () => ({
  resoudreMode: async (...a: unknown[]) => h.mode(...a),
}));
vi.mock("@/lib/telegram", () => ({ sendTelegram: (...a: unknown[]) => h.telegram(...a) }));

import { sendDevisAction } from "./devis";

const ID = "11111111-1111-4111-8111-111111111111";

function devis(over: Record<string, unknown> = {}, clientOver: Record<string, unknown> = {}) {
  return {
    id: ID,
    numero: "AXI-DEV-2026-001",
    clientId: "c1",
    statut: "brouillon",
    lignes: [],
    activite: null,
    refClient: null,
    replacesDevisId: null,
    offre: null,
    offreSha256: null,
    replacesDevis: null,
    financementSuggere: null,
    montantTotalHtCents: 150000,
    montantOpcoEstimeCents: null,
    resteAChargeCents: null,
    dateValidite: new Date("2026-12-31T00:00:00Z"),
    client: {
      type: "entreprise",
      raisonSociale: "Client SA",
      siret: null,
      adresse: null,
      adresseRue: null,
      adresseCodePostal: null,
      adresseVille: null,
      contactNom: "Camille",
      contactEmail: "client@example.test",
      contactFonction: null,
      ...clientOver,
    },
    ...over,
  };
}

const OPTIONS_ACTUELLES = {
  attachments: [{ filename: "AXI-DEV-2026-001.pdf", r2Key: "documents/" }],
  entityType: "Devis",
  entityId: ID,
};

function appelEnqueue(): [
  string,
  string,
  string,
  Record<string, unknown>,
  Record<string, unknown>,
] {
  expect(h.enqueueEmail).toHaveBeenCalledTimes(1);
  return h.enqueueEmail.mock.calls[0] as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  h.formules.mockReturnValue(false);
  h.mode.mockResolvedValue("auto");
  h.queryRaw.mockResolvedValue([{ locked: true }]);
  h.txDevisFindUnique.mockResolvedValue(devis());
  h.txDevisUpdateMany.mockResolvedValue({ count: 1 });
  h.txDevisCount.mockResolvedValue(1);
  h.txClientUpdateMany.mockResolvedValue({ count: 1 });
  h.txOutboxFindFirst.mockResolvedValue(null);
  h.generateDocument.mockResolvedValue({ id: "doc-1", numero: "AXI-DEV-2026-001" });
  h.creerToken.mockResolvedValue({ token: "tok" });
  h.revoquer.mockResolvedValue(1);
  h.enqueueEmail.mockResolvedValue({ enqueued: true });
  h.outboxUpdateMany.mockResolvedValue({ count: 1 });
  h.outboxFindUnique.mockResolvedValue({ template: "devis-envoi", payload: {} });
  h.telegram.mockResolvedValue(undefined);
});

describe("sendDevisAction — clientId et règle propre au client", () => {
  it("lit le mode avec le clientId du devis, jamais null", async () => {
    await sendDevisAction(ID);
    expect(h.mode).toHaveBeenCalledWith("devis-envoi", "c1");
  });

  it("passe clientId à enqueueEmail (corbeille et règle par client)", async () => {
    await sendDevisAction(ID);
    expect(appelEnqueue()[4]).toMatchObject({ clientId: "c1" });
  });

  it("sans options : appel identique à l'actuel (hors clientId), sans objet forcé ni message", async () => {
    await sendDevisAction(ID);
    const [gabarit, a, locale, payload, options] = appelEnqueue();
    expect(gabarit).toBe("devis-envoi");
    expect(a).toBe("client@example.test");
    expect(locale).toBe("fr");
    expect(payload).not.toHaveProperty("messagePersonnalise");
    expect(options).toEqual({
      ...OPTIONS_ACTUELLES,
      clientId: "c1",
      attachments: expect.any(Array),
    });
    expect(options).not.toHaveProperty("sujet");
    expect(options).not.toHaveProperty("sujetForce");
  });
});

describe("sendDevisAction — objet et message du fondateur", () => {
  it("le message va dans le contenu, l'objet dans sujet ET sujetForce", async () => {
    await sendDevisAction(ID, { sujet: "Votre devis sur mesure", messagePersonnalise: "Merci !" });
    const [, , , payload, options] = appelEnqueue();
    expect(payload["messagePersonnalise"]).toBe("Merci !");
    expect(options["sujet"]).toBe("Votre devis sur mesure");
    expect(options["sujetForce"]).toBe("Votre devis sur mesure");
  });

  it("un objet ou un message interdit refuse l'envoi : ni jeton, ni PDF, ni e-mail", async () => {
    const r = await sendDevisAction(ID, { messagePersonnalise: "Prise en charge OPCO possible" });
    expect(r).toHaveProperty("error");
    expect(h.enqueueEmail).not.toHaveBeenCalled();
    expect(h.creerToken).not.toHaveBeenCalled();
    expect(h.txDevisUpdateMany).not.toHaveBeenCalled();
  });

  it("en validation : l'objet reste lisible dans la corbeille et le message est gardé", async () => {
    h.mode.mockResolvedValue("validation");
    h.txDevisFindUnique.mockResolvedValue(devis({ updatedAt: new Date("2026-11-01T00:00:00Z") }));
    h.enqueueEmail.mockResolvedValue({ enqueued: false, garePourValidation: true, outboxId: "o1" });
    await sendDevisAction(ID, { sujet: "Objet voulu", messagePersonnalise: "Bonjour à vous" });
    const [, , , payload, options] = appelEnqueue();
    expect(options).toMatchObject({ exigerValidation: true, sujet: "Objet voulu", clientId: "c1" });
    expect(payload["messagePersonnalise"]).toBe("Bonjour à vous");
    expect(h.creerToken).not.toHaveBeenCalled();
  });
});
