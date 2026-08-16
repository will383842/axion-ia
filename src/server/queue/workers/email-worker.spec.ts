/**
 * Tests — bornes du worker d'envoi (audit du 2026-08-16, F-01).
 *
 * Ce worker n'avait aucun test. Ce fichier n'essaie pas de couvrir sa logique
 * d'envoi — il verrouille les trois RÉGLAGES qui le séparent d'une rafale, et
 * rien d'autre.
 *
 * Pourquoi des tests sur des constantes : le `limiter` et la `concurrency` se
 * retirent d'une ligne, et rien ne casse. Aucun test ne rougit, aucune page
 * d'erreur n'apparaît, les e-mails partent même PLUS vite. La facture arrive
 * des semaines plus tard, sous la forme d'une réputation d'expéditeur dégradée
 * et d'un plafond Zoho — dynamique — qu'on a soi-même fait baisser. C'est
 * exactement le profil d'une garde qu'on retire « parce qu'elle ne sert à
 * rien », et c'est pour ça qu'elle doit rougir.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// `vi.hoisted` : les fabriques de `vi.mock` sont remontées en tête de fichier,
// avant toute déclaration ordinaire — une classe déclarée ici serait lue avant
// son initialisation. Le doublon de `Worker` vit donc DANS la fabrique, et seul
// l'espion en est extrait.
const { workerConstructeur } = vi.hoisted(() => ({ workerConstructeur: vi.fn() }));

vi.mock("bullmq", () => ({
  Worker: class {
    constructor(...args: unknown[]) {
      workerConstructeur(...args);
    }
    on(): this {
      return this;
    }
  },
}));
vi.mock("../connection", () => ({ getBullConnectionOrThrow: () => ({ host: "localhost" }) }));
vi.mock("../lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("@/lib/email/client", () => ({
  sendEmail: vi.fn(),
  verifyTransport: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("@/lib/email/templates", () => ({ renderEmailTemplate: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: vi.fn(), isDecryptedEmailUsable: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
const { isR2ConfiguredMock, getObjectBufferR2Mock } = vi.hoisted(() => ({
  isR2ConfiguredMock: vi.fn(),
  getObjectBufferR2Mock: vi.fn(),
}));
vi.mock("@/lib/r2-storage", () => ({
  isR2Configured: (...a: unknown[]) => isR2ConfiguredMock(...a),
  getObjectBufferR2: (...a: unknown[]) => getObjectBufferR2Mock(...a),
}));
vi.mock("@/server/email/email-log", () => ({ cloturerJournal: vi.fn() }));

import { startEmailWorker, resolveAttachments, TAILLE_MAX_PJ_OCTETS } from "./email-worker";

/** Les options du worker sont le 3e argument du constructeur BullMQ. */
function optionsWorker(): Record<string, unknown> {
  startEmailWorker();
  return workerConstructeur.mock.calls[0]?.[2] as Record<string, unknown>;
}

beforeEach(() => vi.clearAllMocks());

describe("worker d'envoi — les bornes de débit (F-01)", () => {
  // 🔴 Douze workers de ce dépôt bornent leur débit ; celui qui parle au SEUL
  // tiers à quota n'en avait aucun.
  it("borne le débit à 40 envois par heure", () => {
    expect(optionsWorker()["limiter"]).toEqual({ max: 40, duration: 3_600_000 });
  });

  // Le plancher du plafond Zoho est 50/h. On se cale DESSOUS parce que la
  // borne est dynamique — ajustée sur la réputation — et identique en gratuit
  // et en payant : on ne peut ni la lire, ni la négocier, ni l'acheter.
  it("reste sous le plancher du plafond Zoho, marge comprise", () => {
    const limiter = optionsWorker()["limiter"] as { max: number; duration: number };
    expect(limiter.duration).toBe(3_600_000);
    expect(limiter.max).toBeLessThan(50);
  });

  // 8 → 2, aligné sur les 2 connexions du pool nodemailer. Au-delà, un
  // consommateur attend une connexion libre sans rien gagner.
  it("limite la concurrence à 2, alignée sur le pool du transport", () => {
    expect(optionsWorker()["concurrency"]).toBe(2);
  });
});

describe("worker d'envoi — ce que le bridage ne doit PAS casser", () => {
  // 🔑 Le limiteur BullMQ DIFFÈRE la prise du job : il ne consomme pas de
  // tentative et ne déclenche aucun backoff. Un e-mail retardé par le bridage
  // n'est donc pas un e-mail en risque de perte — à condition que le verrou
  // reste assez long pour couvrir un envoi lent.
  it("conserve un verrou de 2 minutes sur le job pris", () => {
    expect(optionsWorker()["lockDuration"]).toBe(120_000);
  });

  it("conserve le bornage de rétention Redis", () => {
    const opts = optionsWorker();
    expect(opts["removeOnComplete"]).toEqual({ count: 1000 });
    expect(opts["removeOnFail"]).toEqual({ count: 5000 });
  });

  it("consomme bien la file `emails`", () => {
    startEmailWorker();
    expect(workerConstructeur.mock.calls[0]?.[0]).toBe("emails");
  });
});

describe("pièces jointes — le plafond de taille (audit 2026-08-16)", () => {
  const pj = (cle: string) => [{ filename: "doc.pdf", r2Key: cle }];

  beforeEach(() => {
    isR2ConfiguredMock.mockReturnValue(true);
  });

  it("laisse passer une pièce jointe sous le plafond", async () => {
    getObjectBufferR2Mock.mockResolvedValue(Buffer.alloc(1_048_576));
    const r = await resolveAttachments(pj("k1"));
    expect(r).toHaveLength(1);
  });

  // 🔴 Sans cette garde, le refus venait du relais APRÈS transfert, sous forme
  // d'un rejet SMTP opaque — puis cinq fois de suite, le temps que BullMQ
  // épuise ses tentatives à repousser les mêmes mégaoctets.
  it("refuse au-delà du plafond, avec un motif lisible", async () => {
    getObjectBufferR2Mock.mockResolvedValue(Buffer.alloc(TAILLE_MAX_PJ_OCTETS + 1));
    await expect(resolveAttachments(pj("k1"))).rejects.toThrow(/trop lourdes/);
  });

  // Le plafond porte sur le CUMUL, pas sur chaque fichier : trois pièces
  // acceptables séparément forment un message que le relais rejette.
  it("plafonne le CUMUL et non chaque fichier pris isolément", async () => {
    const moitie = Math.ceil(TAILLE_MAX_PJ_OCTETS / 2) + 1;
    getObjectBufferR2Mock.mockResolvedValue(Buffer.alloc(moitie));
    await expect(
      resolveAttachments([
        { filename: "a.pdf", r2Key: "k1" },
        { filename: "b.pdf", r2Key: "k2" },
      ]),
    ).rejects.toThrow(/trop lourdes/);
  });

  // La marge d'encodage est le point : le plafond porte sur les octets BRUTS,
  // le relais sur le message encodé, et le base64 gonfle d'environ un tiers.
  it("garde une marge sous le plafond du relais, base64 compris", () => {
    const transmis = TAILLE_MAX_PJ_OCTETS * (4 / 3);
    expect(transmis).toBeLessThan(15 * 1_048_576);
  });
});
