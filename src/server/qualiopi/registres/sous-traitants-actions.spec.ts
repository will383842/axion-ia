/**
 * Tests — Server Actions Sous-traitants OF (T12 AGENT C).
 *
 * Stratégie :
 *   - Mock @/server/qualiopi/registres/sous-traitants-service + _guards.
 *   - Vérifie : creerSousTraitantAction, verifierSousTraitantOfAction.
 *   - Délégation totale au service.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/server/qualiopi/registres/sous-traitants-service", () => ({
  creerSousTraitant: vi.fn(),
  verifierDataGouv: vi.fn(),
  getSousTraitant: vi.fn(),
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

// Les pièces (art. 4 et 8) s'écrivent directement, sans passer par le service :
// ce sont des colonnes de suivi, pas une opération métier du registre.
vi.mock("@/lib/prisma", () => ({
  prisma: { sousTraitant: { update: vi.fn() } },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports
// ─────────────────────────────────────────────────────────────────────────────

import {
  creerSousTraitant,
  verifierDataGouv,
  getSousTraitant,
} from "@/server/qualiopi/registres/sous-traitants-service";
import { logQualiopiActivity, requireAdminWrite } from "@/server/actions/qualiopi/_guards";
import {
  creerSousTraitantAction,
  verifierSousTraitantOfAction,
  updateSousTraitantPiecesAction,
} from "@/server/actions/qualiopi/sous-traitants";
import { prisma } from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const mockRequireAdminWrite = requireAdminWrite as ReturnType<typeof vi.fn>;
const mockLogActivity = logQualiopiActivity as ReturnType<typeof vi.fn>;
const mockCreerSousTraitant = creerSousTraitant as ReturnType<typeof vi.fn>;
const mockVerifierDataGouv = verifierDataGouv as ReturnType<typeof vi.fn>;
const mockGetSousTraitant = getSousTraitant as ReturnType<typeof vi.fn>;

const ST_UUID = "550e8400-e29b-41d4-a716-446655440040";

// SIRET Luhn-VALIDE. L'ancienne fixture « 12345678901234 » échoue la clé de
// contrôle (vérifié par exécution) : depuis que `creerSousTraitantSchema` valide
// le SIRET (F5), elle faisait échouer le safeParse et tombait 4 tests qui n'ont
// rien à voir avec le SIRET. Ne pas y remettre une valeur inventée :
// 12345678900015, 98765432100015, 11223344556670 et 73282932000074 sont
// Luhn-valides (vérifiés).
const INPUT_BASE = {
  nom: "FormIA Solutions",
  siret: "12345678900015",
  nda: "11073000273",
  objetPrestation: "Formation IA générative — sous-traitance partielle module 3",
};

const ST_STUB = { id: ST_UUID, nom: INPUT_BASE.nom, verifieDataGouvAt: null };

// ─────────────────────────────────────────────────────────────────────────────
// creerSousTraitantAction
// ─────────────────────────────────────────────────────────────────────────────

describe("creerSousTraitantAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-uuid" });
    mockLogActivity.mockResolvedValue(undefined);
    mockCreerSousTraitant.mockResolvedValue({ id: ST_UUID });
  });

  it("retourne { data: { id } } pour un sous-traitant valide", async () => {
    const result = await creerSousTraitantAction(INPUT_BASE);

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.id).toBe(ST_UUID);
  });

  it("délègue à creerSousTraitant avec nom, objetPrestation et actif=true", async () => {
    await creerSousTraitantAction(INPUT_BASE);

    expect(mockCreerSousTraitant).toHaveBeenCalledOnce();
    const arg = mockCreerSousTraitant.mock.calls[0]?.[0] as {
      nom: string;
      objetPrestation: string;
      actif: boolean;
    };
    expect(arg.nom).toBe(INPUT_BASE.nom);
    expect(arg.objetPrestation).toBe(INPUT_BASE.objetPrestation);
    expect(arg.actif).toBe(true);
  });

  it("logge qualiopi.sous_traitant.create", async () => {
    await creerSousTraitantAction(INPUT_BASE);

    const logCall = mockLogActivity.mock.calls[0]?.[0] as { action: string; targetType: string };
    expect(logCall.action).toBe("qualiopi.sous_traitant.create");
    expect(logCall.targetType).toBe("SousTraitant");
  });

  it("retourne { error } si nom dépasse 250 caractères", async () => {
    const result = await creerSousTraitantAction({ ...INPUT_BASE, nom: "A".repeat(251) });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    // Le message n'est plus le littéral générique : l'action remonte désormais
    // le champ fautif, sans quoi un SIRET refusé s'afficherait « Données
    // invalides » sans indiquer quoi corriger.
    expect(result.error).toContain("nom");
  });

  it("retourne { error } générique si le service lève", async () => {
    mockCreerSousTraitant.mockRejectedValue(new Error("DB error"));

    const result = await creerSousTraitantAction(INPUT_BASE);

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toContain("sous-traitant");
  });

  it("ne logge pas si Zod échoue", async () => {
    await creerSousTraitantAction({ ...INPUT_BASE, nom: "" });

    expect(mockCreerSousTraitant).not.toHaveBeenCalled();
    expect(mockLogActivity).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// verifierSousTraitantOfAction
// ─────────────────────────────────────────────────────────────────────────────

describe("verifierSousTraitantOfAction", () => {
  const DATE_VERIF = new Date("2026-06-01T09:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-uuid" });
    mockLogActivity.mockResolvedValue(undefined);
    mockGetSousTraitant.mockResolvedValue(ST_STUB);
    mockVerifierDataGouv.mockResolvedValue({ ...ST_STUB, verifieDataGouvAt: DATE_VERIF });
  });

  it("retourne { data: { id, verifieDataGouvAt } }", async () => {
    const result = await verifierSousTraitantOfAction({ id: ST_UUID });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.id).toBe(ST_UUID);
    expect(result.data.verifieDataGouvAt).toBeInstanceOf(Date);
  });

  it("retourne { error } si id n'est pas un UUID", async () => {
    const result = await verifierSousTraitantOfAction({ id: "pas-uuid" });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Données invalides");
  });

  it("retourne { error: 'Sous-traitant introuvable' } si getSousTraitant retourne null", async () => {
    mockGetSousTraitant.mockResolvedValue(null);

    const result = await verifierSousTraitantOfAction({ id: ST_UUID });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Sous-traitant introuvable");
  });

  it("logge qualiopi.sous_traitant.verifie_data_gouv", async () => {
    await verifierSousTraitantOfAction({ id: ST_UUID });

    const logCall = mockLogActivity.mock.calls[0]?.[0] as { action: string };
    expect(logCall.action).toBe("qualiopi.sous_traitant.verifie_data_gouv");
  });

  it("accepte une date de vérification personnalisée", async () => {
    const result = await verifierSousTraitantOfAction({
      id: ST_UUID,
      verifieDataGouvAt: DATE_VERIF,
    });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.verifieDataGouvAt).toStrictEqual(DATE_VERIF);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateSousTraitantPiecesAction — art. 4 et 8 de la procédure de sous-traitance
//
// Ces tests portent sur la SÉMANTIQUE des trois états d'un champ, parce que
// c'est là que se joue la perte de données : `undefined` laisse en l'état,
// `null` retire la pièce, une valeur l'enregistre. Confondre les deux premiers
// ferait qu'enregistrer la RC pro effacerait le CV.
// ─────────────────────────────────────────────────────────────────────────────

describe("updateSousTraitantPiecesAction", () => {
  const mockUpdate = (prisma as unknown as { sousTraitant: { update: ReturnType<typeof vi.fn> } })
    .sousTraitant.update;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-uuid" });
    mockGetSousTraitant.mockResolvedValue({ id: ST_UUID, nom: "Organisme X" });
    mockUpdate.mockResolvedValue({ id: ST_UUID });
  });

  it("n'écrit QUE les champs fournis — les autres restent intacts", async () => {
    await updateSousTraitantPiecesAction({ id: ST_UUID, rcProAttestationUrl: "https://r2/rc.pdf" });

    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data["rcProAttestationUrl"]).toBe("https://r2/rc.pdf");
    // 🔴 Le cœur du test : le CV et l'échéance ne doivent PAS apparaître dans
    // le `data`, sinon Prisma les écraserait à `undefined`/`null`.
    expect("cvUrl" in data).toBe(false);
    expect("prochaineVerifAt" in data).toBe(false);
  });

  it("null retire explicitement une pièce", async () => {
    await updateSousTraitantPiecesAction({ id: ST_UUID, rcProAttestationUrl: null });

    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data["rcProAttestationUrl"]).toBeNull();
  });

  it("date le CV au moment du dépôt — l'art. 4 exige un CV de moins de 24 mois", async () => {
    await updateSousTraitantPiecesAction({ id: ST_UUID, cvUrl: "https://r2/cv.pdf" });

    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    // Une URL sans date ne permettrait pas de vérifier l'ancienneté exigée.
    expect(data["cvUploadedAt"]).toBeInstanceOf(Date);
  });

  it("efface la date de dépôt quand le CV est retiré", async () => {
    await updateSousTraitantPiecesAction({ id: ST_UUID, cvUrl: null });

    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    // Une date de dépôt sans CV affirmerait qu'une pièce absente a été fournie.
    expect(data["cvUploadedAt"]).toBeNull();
  });

  it("refuse une URL malformée plutôt que de l'enregistrer", async () => {
    const result = await updateSousTraitantPiecesAction({
      id: ST_UUID,
      rcProAttestationUrl: "pas-une-url",
    });

    expect("error" in result).toBe(true);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("refuse un sous-traitant inexistant", async () => {
    mockGetSousTraitant.mockResolvedValue(null);
    const result = await updateSousTraitantPiecesAction({ id: ST_UUID, cvUrl: null });

    expect("error" in result).toBe(true);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("logge l'écriture des pièces", async () => {
    await updateSousTraitantPiecesAction({ id: ST_UUID, cvUrl: "https://r2/cv.pdf" });

    const logCall = mockLogActivity.mock.calls[0]?.[0] as { action: string };
    expect(logCall.action).toBe("qualiopi.sous_traitant.pieces");
  });
});
