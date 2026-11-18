/**
 * L'e-mail interne « devis signé par le client » : une fois, jamais pour un essai,
 * jamais bloquant, jamais adressé au client.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  enqueue: vi.fn(),
  devis: vi.fn(),
  capture: vi.fn(),
  journal: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: h.capture, captureMessage: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { devis: { findFirst: h.devis } } }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: h.enqueue }));
vi.mock("@/server/qualiopi/essai/sorties", () => ({
  sortieSaufEssai: async (essai: boolean, s: unknown, f: () => Promise<unknown>) => {
    if (!essai) return f();
    h.journal(s);
    return null;
  },
}));

import { destinataireAlertesInternes } from "@/lib/destinataires-internes";
import { prevenirDevisSigne, ficheDevisDePiece } from "./notification-interne-devis";

const DOC = "11111111-1111-4111-8111-111111111111";
const DEVIS = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  vi.clearAllMocks();
  h.devis.mockResolvedValue({ id: DEVIS, numero: "AXI-DEV-2026-042" });
  h.enqueue.mockResolvedValue({ enqueued: true });
  process.env["ADMIN_URL_PREFIX"] = "admin-test";
});

describe("prevenirDevisSigne", () => {
  it("enfile UN e-mail interne, avec numéro et lien console, sans clientId", async () => {
    await prevenirDevisSigne({
      documentGenereId: DOC,
      numeroPiece: "AXI-DOC-2026-100",
      etape: "a_contresigner",
      essai: false,
    });
    expect(h.enqueue).toHaveBeenCalledOnce();
    const [gabarit, to, locale, payload, opts] = h.enqueue.mock.calls[0]!;
    expect(gabarit).toBe("devis-signe-a-contresigner");
    expect(to).toBe(destinataireAlertesInternes());
    expect(locale).toBe("fr");
    expect(payload.numeroDevis).toBe("AXI-DEV-2026-042");
    expect(payload.etape).toBe("a_contresigner");
    expect(payload.consoleUrl).toContain(`/fr/admin-test/qualiopi/devis/${DEVIS}`);
    expect(Object.keys(payload).sort()).toEqual(["consoleUrl", "etape", "numeroDevis"]);
    expect(opts.clientId).toBeNull();
    expect(opts.jobId).toBe(`devis-signe-a-contresigner-a_contresigner-${DOC}`);
  });

  it("pièce d'ESSAI : rien ne part, le refus est journalisé", async () => {
    await prevenirDevisSigne({
      documentGenereId: DOC,
      numeroPiece: "AXI-ESSAI-1",
      etape: "a_contresigner",
      essai: true,
    });
    expect(h.enqueue).not.toHaveBeenCalled();
    expect(h.journal).toHaveBeenCalledOnce();
  });

  it("e-mail non mis en file (retour enqueued:false) : alerte Sentry, ne lève pas", async () => {
    h.enqueue.mockResolvedValue({ enqueued: false });
    await expect(
      prevenirDevisSigne({
        documentGenereId: DOC,
        numeroPiece: "X",
        etape: "a_contresigner",
        essai: false,
      }),
    ).resolves.toBeUndefined();
    expect(h.capture).toHaveBeenCalledOnce();
  });

  it("fail-soft : une panne de file ne lève jamais et part chez Sentry", async () => {
    h.enqueue.mockRejectedValue(new Error("redis"));
    await expect(
      prevenirDevisSigne({
        documentGenereId: DOC,
        numeroPiece: "X",
        etape: "complete",
        essai: false,
      }),
    ).resolves.toBeUndefined();
    expect(h.capture).toHaveBeenCalledOnce();
  });

  it("devis introuvable : on prévient quand même avec le numéro de la pièce, sans lien", async () => {
    h.devis.mockResolvedValue(null);
    await prevenirDevisSigne({
      documentGenereId: DOC,
      numeroPiece: "AXI-DOC-2026-100",
      etape: "a_contresigner",
      essai: false,
    });
    const payload = h.enqueue.mock.calls[0]![3];
    expect(payload.numeroDevis).toBe("AXI-DOC-2026-100");
    expect(payload.consoleUrl).toBeUndefined();
  });
});

describe("ficheDevisDePiece", () => {
  it("rend null sans lever quand la lecture échoue", async () => {
    h.devis.mockRejectedValue(new Error("db"));
    await expect(ficheDevisDePiece(DOC)).resolves.toBeNull();
  });
});
