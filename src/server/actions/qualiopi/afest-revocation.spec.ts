/**
 * Tests — afest-revocation.ts
 *
 * Ce que ces tests gardent, et pourquoi ce n'est pas décoratif : le document de
 * reprise exigeait que l'impact d'une révocation soit « chiffré avant/après et
 * journalisé ». Sans test, cette exigence se perd au premier refactor — et ce
 * qui se perdrait, c'est la seule trace disant qu'une facture, un BPF, un
 * certificat ou une attestation vient de devenir inexact.
 *
 * ⚠️ Impact réel en production au 2026-07-30 : `coaching_seance_signatures` = 0,
 * `coaching_sessions` = 0. Aucune donnée n'est exposée aujourd'hui. Le garde-fou
 * est construit pour le jour où il y en aura.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    coachingSeanceSignature: { findUnique: vi.fn() },
    coachingSession: { findUnique: vi.fn() },
  },
}));

vi.mock("@/server/qualiopi/coaching-afest/signature/signature-afest-service", () => ({
  revoquerSignatureSeance: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn(), captureException: vi.fn() }));

vi.mock("./_guards", () => ({
  requireAdminWrite: vi.fn(),
  logQualiopiActivity: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { revoquerSignatureSeance } from "@/server/qualiopi/coaching-afest/signature/signature-afest-service";
import { requireAdminWrite, logQualiopiActivity } from "./_guards";
import { revoquerSignatureSeanceAction } from "./afest-revocation";

type Mock = ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  coachingSeanceSignature: { findUnique: Mock };
  coachingSession: { findUnique: Mock };
};
const mockRevoquer = revoquerSignatureSeance as unknown as Mock;
const mockGuard = requireAdminWrite as unknown as Mock;
const mockLog = logQualiopiActivity as unknown as Mock;

const SIG = "11111111-1111-4111-8111-111111111111";
const COACHING = "22222222-2222-4222-8222-222222222222";

/**
 * Deux séances de 2 h, la seconde signée par le bénéficiaire. En régime
 * `signature_reelle`, seule la seconde compte → 2 h.
 */
function parcours(signeeCount: number) {
  return {
    regimePreuve: "signature_reelle",
    comptesRendus: [
      {
        dureeMinutes: 120,
        statut: "realisee",
        presenceSigneeAt: null,
        beneficiairePresent: true,
        signatures: [],
      },
      {
        dureeMinutes: 120,
        statut: "realisee",
        presenceSigneeAt: null,
        beneficiairePresent: true,
        signatures: signeeCount > 0 ? [{ id: "s1" }] : [],
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // ⚠️ `clearAllMocks` efface les appels, PAS les valeurs de retour.
  mockGuard.mockResolvedValue({ userId: "admin-1", role: "super_admin" });
  mockLog.mockResolvedValue(undefined);
  mockPrisma.coachingSeanceSignature.findUnique.mockResolvedValue({
    coachingId: COACHING,
    role: "beneficiaire",
    compteRenduSeanceId: "cr-2",
  });
  // AVANT : une séance signée (2 h). APRÈS : plus aucune (0 h).
  mockPrisma.coachingSession.findUnique
    .mockResolvedValueOnce(parcours(1))
    .mockResolvedValueOnce(parcours(0));
  mockRevoquer.mockResolvedValue({ ok: true });
});

describe("🔴 l'impact est CHIFFRÉ et JOURNALISÉ", () => {
  it("mesure les heures avant et après, et rend l'écart", async () => {
    const res = await revoquerSignatureSeanceAction({
      signatureId: SIG,
      motif: "erreur de saisie",
    });
    expect(res).toStrictEqual({ ok: true, heuresAvant: 2, heuresApres: 0, deltaHeures: -2 });
  });

  it("journalise l'écart — c'est lui qui dit qu'une pièce devient inexacte", async () => {
    await revoquerSignatureSeanceAction({ signatureId: SIG, motif: "erreur de saisie" });
    const changes = mockLog.mock.calls[0]?.[0]?.changes as Record<string, unknown>;
    expect(changes["heuresAvant"]).toBe(2);
    expect(changes["heuresApres"]).toBe(0);
    expect(changes["deltaHeures"]).toBe(-2);
    expect(changes["motif"]).toBe("erreur de saisie");
  });

  it("⚠️ mesure APRÈS en RELISANT, jamais en déduisant la durée de la séance", async () => {
    // Déduire « la séance faisait 120 min, donc -2 h » supposerait connaître le
    // régime, la neutralisation et l'absence actée — trois règles qui vivent
    // dans `heures.ts`. Deux lectures, donc deux appels.
    await revoquerSignatureSeanceAction({ signatureId: SIG, motif: "m" });
    expect(mockPrisma.coachingSession.findUnique).toHaveBeenCalledTimes(2);
  });

  it("rend un écart NUL quand la séance n'était pas comptée", async () => {
    // Régime `signature_reelle`, séance déjà non signée : la révocation ne
    // change rien au comptage. Le dire évite une alerte pour rien.
    // 🔴 `mockReset` et NON `clearAllMocks` : ce dernier efface les APPELS, pas
    // la file des `mockResolvedValueOnce` posée en `beforeEach`. Sans reset, les
    // deux valeurs déjà en file sont servies d'abord et le test mesure un écart
    // de -2 h là où il en attend 0 — piège déjà documenté sur ce dépôt, et qui
    // vient de se reproduire ici.
    mockPrisma.coachingSession.findUnique.mockReset();
    vi.clearAllMocks();
    mockGuard.mockResolvedValue({ userId: "admin-1", role: "super_admin" });
    mockLog.mockResolvedValue(undefined);
    mockPrisma.coachingSeanceSignature.findUnique.mockResolvedValue({
      coachingId: COACHING,
      role: "tuteur",
      compteRenduSeanceId: "cr-2",
    });
    mockPrisma.coachingSession.findUnique
      .mockResolvedValueOnce(parcours(1))
      .mockResolvedValueOnce(parcours(1));
    mockRevoquer.mockResolvedValue({ ok: true });

    const res = await revoquerSignatureSeanceAction({ signatureId: SIG, motif: "m" });
    expect(res).toMatchObject({ ok: true, deltaHeures: 0 });
  });
});

describe("🔴 gardes", () => {
  it("refuse un rôle `editor` — retirer une preuve engage l'organisme", async () => {
    mockGuard.mockResolvedValue({ userId: "u", role: "editor" });
    const res = await revoquerSignatureSeanceAction({ signatureId: SIG, motif: "m" });
    expect(res).toMatchObject({ ok: false, raison: "role_insuffisant" });
    expect(mockRevoquer).not.toHaveBeenCalled();
  });

  it("refuse un motif vide — une révocation sans motif ne dit rien à l'auditeur", async () => {
    const res = await revoquerSignatureSeanceAction({ signatureId: SIG, motif: "   " });
    expect(res).toMatchObject({ ok: false, raison: "motif_requis" });
    expect(mockRevoquer).not.toHaveBeenCalled();
  });

  it("refuse une signature introuvable sans rien mesurer", async () => {
    mockPrisma.coachingSeanceSignature.findUnique.mockResolvedValue(null);
    const res = await revoquerSignatureSeanceAction({ signatureId: SIG, motif: "m" });
    expect(res).toMatchObject({ ok: false, raison: "signature_introuvable" });
    expect(mockRevoquer).not.toHaveBeenCalled();
  });

  it("⚠️ ne journalise RIEN quand le service refuse", async () => {
    // Un refus journalisé comme une révocation ferait croire à une preuve
    // retirée qui ne l'a pas été.
    mockRevoquer.mockResolvedValue({
      ok: false,
      raison: "revocation_maillon_interne_interdite",
      message: "…",
    });
    const res = await revoquerSignatureSeanceAction({ signatureId: SIG, motif: "m" });
    expect(res).toMatchObject({ ok: false, raison: "revocation_maillon_interne_interdite" });
    expect(mockLog).not.toHaveBeenCalled();
  });
});
