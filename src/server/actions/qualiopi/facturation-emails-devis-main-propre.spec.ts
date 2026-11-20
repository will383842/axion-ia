/**
 * envoyerDevisEmailAction — garde « remis en main propre » (lot I1).
 * Mocks copiés de `facturation-emails-devis-renvoi.spec.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  findUnique: vi.fn(),
  docFindUnique: vi.fn(),
  outboxFindFirst: vi.fn(),
  traceFindFirst: vi.fn(),
  creerToken: vi.fn(),
  enqueueEmail: vi.fn(),
  resoudreMode: vi.fn(),
  log: vi.fn(),
  verrouOccupe: false,
  ordre: [] as string[],
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    devis: { findUnique: d.findUnique },
    documentGenere: { findUnique: d.docFindUnique },
    emailOutbox: { findFirst: (...a: unknown[]) => d.outboxFindFirst(...a) },
    $transaction: async (f: (t: unknown) => unknown) => {
      const tx = {
        $queryRaw: async () => {
          d.ordre.push("verrou");
          return [{ locked: !d.verrouOccupe }];
        },
        activityLog: {
          findFirst: (...a: unknown[]) => {
            d.ordre.push("canal");
            return d.traceFindFirst(...a);
          },
        },
        emailOutbox: {
          findFirst: (...a: unknown[]) => {
            d.ordre.push("garde");
            return d.outboxFindFirst(...a);
          },
        },
      };
      return f(tx);
    },
  },
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => d.enqueueEmail(...a),
}));
vi.mock("@/server/email/outbox-service", () => ({
  resoudreMode: (...a: unknown[]) => d.resoudreMode(...a),
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "adm-1" }),
  logQualiopiActivity: (...a: unknown[]) => d.log(...a),
}));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => ({
  formulesActives: async () => true,
}));
vi.mock("@/lib/public-url", () => ({
  publicUrl: (p: string) => new URL(p, "https://exemple.test"),
}));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  creerTokenDocument: (...a: unknown[]) => d.creerToken(...a),
  revoquerJetonPrecis: vi.fn(),
  revoquerTokensDocument: vi.fn(),
  TokenDocumentError: class extends Error {
    motif = "x";
  },
}));

import { envoyerDevisEmailAction } from "./facturation-emails";

const ID = "11111111-1111-4111-8111-111111111111";
const PIECE = "22222222-2222-4222-8222-222222222222";

function devis() {
  return {
    id: ID,
    numero: "AXI-DEV-2026-001",
    clientId: "c1",
    statut: "envoye",
    offre: null,
    documentGenereId: PIECE,
    documentGenere: { annuleeAt: null, signatures: [] },
    fichierPdfUrl: "documents/2026/devis/AXI-DOC-001.pdf",
    montantTotalHtCents: 1000,
    dateValidite: new Date("2026-12-31T00:00:00Z"),
    client: {
      raisonSociale: "Client SA",
      contactEmail: "client@example.test",
      contactNom: "Camille",
      contactFonction: null,
    },
  };
}

let espions: ReturnType<typeof vi.spyOn>[] = [];
beforeEach(() => {
  vi.clearAllMocks();
  d.ordre.length = 0;
  d.verrouOccupe = false;
  d.findUnique.mockResolvedValue(devis());
  d.docFindUnique.mockResolvedValue({ metadata: null });
  d.outboxFindFirst.mockResolvedValue(null);
  d.traceFindFirst.mockResolvedValue({ id: "trace-1" });
  d.creerToken.mockResolvedValue({ token: "J", tokenId: "t-1" });
  d.resoudreMode.mockResolvedValue("validation");
  d.enqueueEmail.mockResolvedValue({ enqueued: false, garePourValidation: true, outboxId: "o-1" });
  espions = (["log", "warn", "error", "info"] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => undefined),
  );
});
afterEach(() => espions.forEach((e) => e.mockRestore()));

const rienNeParte = () => {
  expect(d.creerToken).not.toHaveBeenCalled();
  expect(d.enqueueEmail).not.toHaveBeenCalled();
  expect(d.resoudreMode).not.toHaveBeenCalled();
  const actions = d.log.mock.calls.map((c) => (c[0] as { action: string }).action);
  expect(actions).not.toContain("facturation.email.devis");
};

describe("devis remis en main propre : le renvoi est refusé côté serveur", () => {
  it("refus avec message clair ; ni jeton, ni e-mail, ni mode, ni journal d'envoi", async () => {
    const r = await envoyerDevisEmailAction({ devisId: ID });
    expect(r).toHaveProperty("error");
    expect((r as { error: string }).error).toContain("remis en main propre");
    rienNeParte();
  });

  it("ordre : verrou, puis canal, rien d'autre ; « déjà garé » non atteinte", async () => {
    await envoyerDevisEmailAction({ devisId: ID });
    expect(d.ordre).toEqual(["verrou", "canal"]);
  });

  it.each(["auto", "validation"])("même refus en mode %s", async (mode) => {
    d.resoudreMode.mockResolvedValue(mode);
    const r = await envoyerDevisEmailAction({ devisId: ID });
    expect((r as { error: string }).error).toContain("remis en main propre");
    rienNeParte();
  });

  it("sans trace : comportement inchangé (un e-mail enfilé ou garé)", async () => {
    d.traceFindFirst.mockResolvedValue(null);
    const r = await envoyerDevisEmailAction({ devisId: ID });
    expect("data" in r).toBe(true);
    expect(d.enqueueEmail).toHaveBeenCalledOnce();
  });

  it("verrou occupé : message d'envoi en cours, la trace n'est même pas lue", async () => {
    d.verrouOccupe = true;
    const r = await envoyerDevisEmailAction({ devisId: ID });
    expect(r).toEqual({
      error: "Un envoi de ce devis est déjà en cours, réessayez dans un instant.",
    });
    expect(d.traceFindFirst).not.toHaveBeenCalled();
  });
});
