// @vitest-environment node
/**
 * Questionnaire SANS rendez-vous (25/10/2026, décision de Will) : il se rattache à une fiche client
 * par `client_id`, se dépose et se lit comme celui d'un rendez-vous, et suit une fusion de fiches
 * sans rien déplacer.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const tx = {
    questionnaireAvantAudit: {
      findUnique: m.findUnique,
      findFirst: m.findFirst,
      create: m.create,
      update: vi.fn(),
    },
    $queryRaw: m.queryRaw,
  };
  return {
    prisma: {
      questionnaireAvantAudit: { findFirst: m.findFirst, findUnique: m.findUnique },
      $transaction: async (f: (t: typeof tx) => unknown) => f(tx),
    },
  };
});
vi.mock("@/lib/chiffrer-parole", () => ({ chiffrerParole: vi.fn(), dechiffrerParole: vi.fn() }));
vi.mock("@/features/dossier-client/message-affichable", () => ({
  MessagePourWill: class MessagePourWill extends Error {},
}));
vi.mock("../html", () => ({ validerHtml: () => ({ ok: true }) }));
vi.mock("@/lib/security/email-hash", () => ({ hashEmailForLookup: () => "hash" }));

import { cheminConsole } from "../liens";
import { deposerQuestionnairePourClient, dunClient, lireDuClient } from "../serveur";

const CID = "33333333-3333-4333-8333-333333333333";
const HTML_VALIDE = `<!doctype html><html><body>${"x".repeat(50)}</body></html>`;

describe("questionnaire sans rendez-vous", () => {
  beforeEach(() => vi.clearAllMocks());

  it("se retrouve par la fiche, ou par la fiche qui l'a absorbée (fusion vivante)", () => {
    const w = dunClient(CID);
    expect(w.rencontreId).toBeNull();
    expect(w.OR).toEqual([
      { clientId: CID },
      { client: { fusionsAbsorbee: { some: { absorbantId: CID, defaiteLe: null } } } },
    ]);
  });

  it("lireDuClient prend le plus récent, sans rendez-vous", async () => {
    m.findFirst.mockResolvedValue({ id: "q1" });
    await lireDuClient(CID);
    expect(m.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: dunClient(CID),
        orderBy: [{ creeLe: "desc" }, { id: "asc" }],
      }),
    );
  });

  it("le dépôt crée une ligne rattachée à la fiche, SANS rencontre", async () => {
    m.findFirst.mockResolvedValue(null);
    m.create.mockResolvedValue({ id: "neuf" });
    await deposerQuestionnairePourClient(CID, HTML_VALIDE);
    const data = m.create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data["clientId"]).toBe(CID);
    expect(data).not.toHaveProperty("rencontreId");
  });

  it("un brouillon déjà déposé pour la fiche est remplacé sur place", async () => {
    m.findFirst.mockResolvedValue({ id: "q-brouillon", envoyeLe: null });
    const r = await deposerQuestionnairePourClient(CID, HTML_VALIDE);
    expect(m.create).not.toHaveBeenCalled();
    expect(r).toMatchObject({ id: "q-brouillon", ancienLienMort: false });
  });

  it("le chemin de la console mène au rendez-vous, sinon à la fiche, sinon à la liste", () => {
    expect(cheminConsole("r1", "c1")).toBe("rendez-vous/rencontres/r1#questionnaire-avant-audit");
    expect(cheminConsole(null, "c1")).toBe(
      "qualiopi/clients/c1/questionnaire#questionnaire-avant-audit",
    );
    expect(cheminConsole(null)).toBe("rendez-vous?vue=questionnaires");
  });
});
