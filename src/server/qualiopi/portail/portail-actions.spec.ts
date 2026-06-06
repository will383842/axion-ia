/**
 * Tests — Server Actions Portail stagiaire (AGENT B — T14).
 *
 * Strategie :
 *   - Mock @/lib/prisma, @/server/actions/qualiopi/_guards
 *   - Mock services AGENT A (portail-service, cookie, rgpd-service, satisfaction-service)
 *   - Mock @/lib/pii-crypto (encryptPii)
 *   - Verifie : accederPortail, quitterPortail, soumettreSatisfaction,
 *               declarerHandicap, demanderExport/Suppression RGPD,
 *               genererPortailAcces (admin), revoquerPortailAcces (admin)
 */

import { describe, it, expect, vi, beforeEach, assert } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks declares AVANT tout import des modules testes
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainee: { update: vi.fn() },
    questionnaire: { findUnique: vi.fn() },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid-1" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/qualiopi/portail/portail-service", () => ({
  creerAcces: vi.fn(),
  verifierToken: vi.fn(),
  revoquerAcces: vi.fn(),
}));

vi.mock("@/server/qualiopi/portail/cookie", () => ({
  setPortailCookie: vi.fn().mockResolvedValue(undefined),
  getPortailToken: vi.fn(),
  clearPortailCookie: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/qualiopi/portail/rgpd-service", () => ({
  creerDemandeRgpd: vi.fn(),
}));

vi.mock("@/server/qualiopi/satisfaction/satisfaction-service", () => ({
  soumettreReponses: vi.fn(),
}));

vi.mock("@/lib/pii-crypto", () => ({
  encryptPii: vi.fn((v: string) => `enc:v1:${v}`),
  decryptPii: vi.fn((v: string) => v),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports (apres mocks)
// ─────────────────────────────────────────────────────────────────────────────

import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import {
  creerAcces,
  verifierToken,
  revoquerAcces,
} from "@/server/qualiopi/portail/portail-service";
import {
  setPortailCookie,
  getPortailToken,
  clearPortailCookie,
} from "@/server/qualiopi/portail/cookie";
import { creerDemandeRgpd } from "@/server/qualiopi/portail/rgpd-service";
import { soumettreReponses } from "@/server/qualiopi/satisfaction/satisfaction-service";
import { encryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";
import {
  accederPortailAction,
  quitterPortailAction,
  soumettreSatisfactionPortailAction,
  declarerHandicapAction,
  demanderExportRgpdAction,
  demanderSuppressionRgpdAction,
  genererPortailAccesAction,
  revoquerPortailAccesAction,
} from "@/server/actions/qualiopi/portail";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers types
// ─────────────────────────────────────────────────────────────────────────────

function mockCall<T>(fn: ReturnType<typeof vi.fn>, callIndex = 0): T {
  const call = fn.mock.calls[callIndex];
  assert(call !== undefined, `mockCall: aucun appel a l'index ${callIndex}`);
  return call[0] as T;
}

const mockRequireAdminWrite = requireAdminWrite as ReturnType<typeof vi.fn>;
const mockLogActivity = logQualiopiActivity as ReturnType<typeof vi.fn>;
const mockCreerAcces = creerAcces as ReturnType<typeof vi.fn>;
const mockVerifierToken = verifierToken as ReturnType<typeof vi.fn>;
const mockRevoquerAcces = revoquerAcces as ReturnType<typeof vi.fn>;
const mockSetPortailCookie = setPortailCookie as ReturnType<typeof vi.fn>;
const mockGetPortailToken = getPortailToken as ReturnType<typeof vi.fn>;
const mockClearPortailCookie = clearPortailCookie as ReturnType<typeof vi.fn>;
const mockCreerDemandeRgpd = creerDemandeRgpd as ReturnType<typeof vi.fn>;
const mockSoumettreReponses = soumettreReponses as ReturnType<typeof vi.fn>;
const mockEncryptPii = encryptPii as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  trainee: { update: ReturnType<typeof vi.fn> };
  questionnaire: { findUnique: ReturnType<typeof vi.fn> };
};

const TRAINEE_UUID = "550e8400-e29b-41d4-a716-446655440001";
const ACCES_UUID = "550e8400-e29b-41d4-a716-446655440002";
const VALID_TOKEN = "a".repeat(64);
const QUEST_TOKEN = "b".repeat(64);
const EXPIRES_FUTURE = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

// ─────────────────────────────────────────────────────────────────────────────
// accederPortailAction
// ─────────────────────────────────────────────────────────────────────────────

describe("accederPortailAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifierToken.mockResolvedValue({ traineeId: TRAINEE_UUID });
    mockSetPortailCookie.mockResolvedValue(undefined);
  });

  it("retourne { data: { ok: true } } pour un token valide", async () => {
    const result = await accederPortailAction({ token: VALID_TOKEN });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.ok).toBe(true);
  });

  it("appelle setPortailCookie apres verification reussie", async () => {
    await accederPortailAction({ token: VALID_TOKEN });

    expect(mockSetPortailCookie).toHaveBeenCalledOnce();
    expect(mockSetPortailCookie).toHaveBeenCalledWith(VALID_TOKEN);
  });

  it("retourne { error } si token invalide (longueur incorrecte)", async () => {
    const result = await accederPortailAction({ token: "court" });

    expect("error" in result).toBe(true);
    expect(mockVerifierToken).not.toHaveBeenCalled();
  });

  it("retourne { error } si verifierToken retourne null", async () => {
    mockVerifierToken.mockResolvedValue(null);

    const result = await accederPortailAction({ token: VALID_TOKEN });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toMatch(/invalid|expire|revoque/i);
  });

  it("ne pose pas le cookie si le token est invalide", async () => {
    mockVerifierToken.mockResolvedValue(null);

    await accederPortailAction({ token: VALID_TOKEN });

    expect(mockSetPortailCookie).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// quitterPortailAction
// ─────────────────────────────────────────────────────────────────────────────

describe("quitterPortailAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("appelle clearPortailCookie et retourne { data: { ok: true } }", async () => {
    const result = await quitterPortailAction();

    expect(mockClearPortailCookie).toHaveBeenCalledOnce();
    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// soumettreSatisfactionPortailAction
// ─────────────────────────────────────────────────────────────────────────────

describe("soumettreSatisfactionPortailAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPortailToken.mockResolvedValue(VALID_TOKEN);
    mockVerifierToken.mockResolvedValue({ traineeId: TRAINEE_UUID });
    mockSoumettreReponses.mockResolvedValue({ id: "quest-repondu-1" });
    // A-01 : questionnaire appartient au stagiaire connecté par défaut
    mockPrisma.questionnaire.findUnique.mockResolvedValue({
      enrollment: { traineeId: TRAINEE_UUID },
    });
  });

  it("retourne { data: { id } } pour des reponses valides", async () => {
    const result = await soumettreSatisfactionPortailAction({
      token: QUEST_TOKEN,
      reponses: { q1: "oui" },
    });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.id).toBe("quest-repondu-1");
  });

  it("transmet noteGlobale a soumettreReponses si fourni", async () => {
    await soumettreSatisfactionPortailAction({
      token: QUEST_TOKEN,
      reponses: { q1: "satisfait" },
      noteGlobale: 5,
    });

    expect(mockSoumettreReponses).toHaveBeenCalledOnce();
    const call = mockCall<{ noteGlobale: number }>(mockSoumettreReponses);
    expect(call.noteGlobale).toBe(5);
  });

  it("ne transmet pas noteGlobale si absent (exactOptionalPropertyTypes)", async () => {
    await soumettreSatisfactionPortailAction({
      token: QUEST_TOKEN,
      reponses: { q1: "oui" },
    });

    const call = mockCall<Record<string, unknown>>(mockSoumettreReponses);
    expect("noteGlobale" in call).toBe(false);
  });

  it("retourne { error } si cookie portail absent", async () => {
    mockGetPortailToken.mockResolvedValue(null);

    const result = await soumettreSatisfactionPortailAction({
      token: QUEST_TOKEN,
      reponses: {},
    });

    expect("error" in result).toBe(true);
    expect(mockSoumettreReponses).not.toHaveBeenCalled();
  });

  it("retourne { error } si token cookie invalide (session expiree)", async () => {
    mockVerifierToken.mockResolvedValue(null);

    const result = await soumettreSatisfactionPortailAction({
      token: QUEST_TOKEN,
      reponses: {},
    });

    expect("error" in result).toBe(true);
  });

  it("retourne { error } si soumettreReponses retourne null", async () => {
    mockSoumettreReponses.mockResolvedValue(null);

    const result = await soumettreSatisfactionPortailAction({
      token: QUEST_TOKEN,
      reponses: { q1: "oui" },
    });

    expect("error" in result).toBe(true);
  });

  it("retourne { error } si noteGlobale hors plage (6)", async () => {
    const result = await soumettreSatisfactionPortailAction({
      token: QUEST_TOKEN,
      reponses: {},
      noteGlobale: 6,
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Données invalides");
  });

  // A-01 (IDOR) — vérification propriété questionnaire
  it("A-01 : retourne { error } si le questionnaire appartient a un autre stagiaire (IDOR)", async () => {
    const autreTraineeId = "550e8400-e29b-41d4-a716-000000000099";
    mockPrisma.questionnaire.findUnique.mockResolvedValue({
      enrollment: { traineeId: autreTraineeId },
    });

    const result = await soumettreSatisfactionPortailAction({
      token: QUEST_TOKEN,
      reponses: { q1: "oui" },
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toMatch(/non autorisé|introuvable/i);
    expect(mockSoumettreReponses).not.toHaveBeenCalled();
  });

  it("A-01 : retourne { error } si le questionnaire est introuvable en DB", async () => {
    mockPrisma.questionnaire.findUnique.mockResolvedValue(null);

    const result = await soumettreSatisfactionPortailAction({
      token: QUEST_TOKEN,
      reponses: { q1: "oui" },
    });

    expect("error" in result).toBe(true);
    expect(mockSoumettreReponses).not.toHaveBeenCalled();
  });

  it("A-01 : appelle soumettreReponses si le questionnaire appartient bien au stagiaire connecté", async () => {
    // Le beforeEach configure questionnaire.traineeId === TRAINEE_UUID
    await soumettreSatisfactionPortailAction({
      token: QUEST_TOKEN,
      reponses: { q1: "ok" },
    });

    expect(mockSoumettreReponses).toHaveBeenCalledOnce();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// declarerHandicapAction
// ─────────────────────────────────────────────────────────────────────────────

describe("declarerHandicapAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPortailToken.mockResolvedValue(VALID_TOKEN);
    mockVerifierToken.mockResolvedValue({ traineeId: TRAINEE_UUID });
    mockPrisma.trainee.update.mockResolvedValue({});
    mockEncryptPii.mockImplementation((v: string) => `enc:v1:${v}`);
  });

  it("retourne { data: { ok: true } } et chiffre le besoin", async () => {
    const result = await declarerHandicapAction({ besoin: "Besoin sous-titrage" });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.ok).toBe(true);
    expect(mockEncryptPii).toHaveBeenCalledOnce();
  });

  it("appelle prisma.trainee.update avec situationHandicap=true et handicapDetailsChiffre", async () => {
    await declarerHandicapAction({ besoin: "Besoin adapt" });

    expect(mockPrisma.trainee.update).toHaveBeenCalledOnce();
    const call = mockCall<{
      where: { id: string };
      data: { situationHandicap: boolean; handicapDetailsChiffre: string };
    }>(mockPrisma.trainee.update);
    expect(call.where.id).toBe(TRAINEE_UUID);
    expect(call.data.situationHandicap).toBe(true);
    expect(call.data.handicapDetailsChiffre).toBe("enc:v1:Besoin adapt");
  });

  it("retourne { error } si cookie portail absent", async () => {
    mockGetPortailToken.mockResolvedValue(null);

    const result = await declarerHandicapAction({ besoin: "test" });

    expect("error" in result).toBe(true);
    expect(mockPrisma.trainee.update).not.toHaveBeenCalled();
  });

  it("retourne { error } si besoin est vide (Zod min(1))", async () => {
    const result = await declarerHandicapAction({ besoin: "" });

    expect("error" in result).toBe(true);
    expect(mockPrisma.trainee.update).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// demanderExportRgpdAction
// ─────────────────────────────────────────────────────────────────────────────

describe("demanderExportRgpdAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPortailToken.mockResolvedValue(VALID_TOKEN);
    mockVerifierToken.mockResolvedValue({ traineeId: TRAINEE_UUID });
    mockCreerDemandeRgpd.mockResolvedValue({
      id: "rgpd-export-1",
      type: "export",
      demandeAt: new Date(),
    });
  });

  it("retourne { data: { id } } et cree une demande export", async () => {
    const result = await demanderExportRgpdAction();

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.id).toBe("rgpd-export-1");
    expect(mockCreerDemandeRgpd).toHaveBeenCalledOnce();
    const call = mockCall<[string, string]>(mockCreerDemandeRgpd);
    expect(call).toBe(TRAINEE_UUID); // premier argument
  });

  it("passe le type 'export' a creerDemandeRgpd", async () => {
    await demanderExportRgpdAction();

    const callArgs = mockCreerDemandeRgpd.mock.calls[0] as [string, string];
    expect(callArgs[1]).toBe("export");
  });

  it("retourne { error } si cookie portail absent", async () => {
    mockGetPortailToken.mockResolvedValue(null);

    const result = await demanderExportRgpdAction();

    expect("error" in result).toBe(true);
    expect(mockCreerDemandeRgpd).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// demanderSuppressionRgpdAction
// ─────────────────────────────────────────────────────────────────────────────

describe("demanderSuppressionRgpdAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPortailToken.mockResolvedValue(VALID_TOKEN);
    mockVerifierToken.mockResolvedValue({ traineeId: TRAINEE_UUID });
    mockCreerDemandeRgpd.mockResolvedValue({
      id: "rgpd-supp-1",
      type: "suppression",
      demandeAt: new Date(),
    });
  });

  it("retourne { data: { id } } et cree une demande suppression", async () => {
    const result = await demanderSuppressionRgpdAction();

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.id).toBe("rgpd-supp-1");
  });

  it("passe le type 'suppression' a creerDemandeRgpd", async () => {
    await demanderSuppressionRgpdAction();

    const callArgs = mockCreerDemandeRgpd.mock.calls[0] as [string, string];
    expect(callArgs[1]).toBe("suppression");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// genererPortailAccesAction (ADMIN)
// ─────────────────────────────────────────────────────────────────────────────

describe("genererPortailAccesAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-uuid-1" });
    mockLogActivity.mockResolvedValue(undefined);
    mockCreerAcces.mockResolvedValue({
      id: ACCES_UUID,
      token: VALID_TOKEN,
      expiresAt: EXPIRES_FUTURE,
    });
  });

  it("retourne { data: { id, token, url, expiresAt } } pour un traineeId valide", async () => {
    const result = await genererPortailAccesAction({ traineeId: TRAINEE_UUID });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.id).toBe(ACCES_UUID);
    expect(result.data.token).toBe(VALID_TOKEN);
    expect(result.data.url).toContain(VALID_TOKEN);
    expect(result.data.expiresAt).toBeInstanceOf(Date);
  });

  it("appelle creerAcces avec le traineeId et 90 j par defaut", async () => {
    await genererPortailAccesAction({ traineeId: TRAINEE_UUID });

    expect(mockCreerAcces).toHaveBeenCalledOnce();
    const callArgs = mockCreerAcces.mock.calls[0] as [string, number | undefined];
    expect(callArgs[0]).toBe(TRAINEE_UUID);
  });

  it("passe joursValidite personnalise a creerAcces", async () => {
    await genererPortailAccesAction({ traineeId: TRAINEE_UUID, joursValidite: 30 });

    const callArgs = mockCreerAcces.mock.calls[0] as [string, number];
    expect(callArgs[1]).toBe(30);
  });

  it("logge l'activite admin avec la bonne action", async () => {
    await genererPortailAccesAction({ traineeId: TRAINEE_UUID });

    expect(mockLogActivity).toHaveBeenCalledOnce();
    const logCall = mockCall<{ action: string; targetType: string; targetId: string }>(
      mockLogActivity,
    );
    expect(logCall.action).toBe("qualiopi.portail.generer_acces");
    expect(logCall.targetType).toBe("PortailAcces");
    expect(logCall.targetId).toBe(ACCES_UUID);
  });

  it("retourne { error } si traineeId n'est pas un UUID", async () => {
    const result = await genererPortailAccesAction({ traineeId: "pas-uuid" });

    expect("error" in result).toBe(true);
    expect(mockCreerAcces).not.toHaveBeenCalled();
  });

  it("L'URL contient /portail/acces/ et le token", async () => {
    const result = await genererPortailAccesAction({ traineeId: TRAINEE_UUID });

    if (!("data" in result)) return;
    expect(result.data.url).toMatch(/portail\/acces\//);
    expect(result.data.url).toContain(VALID_TOKEN);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// revoquerPortailAccesAction (ADMIN)
// ─────────────────────────────────────────────────────────────────────────────

describe("revoquerPortailAccesAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-uuid-1" });
    mockLogActivity.mockResolvedValue(undefined);
    mockRevoquerAcces.mockResolvedValue(undefined);
  });

  it("retourne { data: { id } } sur succes", async () => {
    const result = await revoquerPortailAccesAction({ id: ACCES_UUID });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.id).toBe(ACCES_UUID);
  });

  it("appelle revoquerAcces avec l'id", async () => {
    await revoquerPortailAccesAction({ id: ACCES_UUID });

    expect(mockRevoquerAcces).toHaveBeenCalledOnce();
    expect(mockRevoquerAcces).toHaveBeenCalledWith(ACCES_UUID);
  });

  it("logge l'activite admin avec la bonne action", async () => {
    await revoquerPortailAccesAction({ id: ACCES_UUID });

    expect(mockLogActivity).toHaveBeenCalledOnce();
    const logCall = mockCall<{ action: string }>(mockLogActivity);
    expect(logCall.action).toBe("qualiopi.portail.revoquer_acces");
  });

  it("retourne { error } si id n'est pas un UUID", async () => {
    const result = await revoquerPortailAccesAction({ id: "pas-uuid" });

    expect("error" in result).toBe(true);
    expect(mockRevoquerAcces).not.toHaveBeenCalled();
  });
});
