/**
 * `genererFactureParInscriptionAction` — émettre une facture inter-entreprises
 * est un acte ENGAGEANT.
 *
 * L'action alloue un numéro de la série légale `AXI-FACT-YYYY-NNN` et crée une
 * `FactureFormation` opposable au payeur. C'est exactement ce que le SSOT range
 * sous `facturer`. Elle était pourtant gardée par `requireAdminWrite`, qui
 * autorise `editor` — la garde ne correspondait pas à la doctrine écrite du
 * dépôt (`_guards.ts:48-50`).
 *
 * 🔴 Le refus doit tomber AVANT toute lecture métier : le témoin utilisé ici est
 * la distinction entre « rejette forbidden » (garde) et « renvoie
 * "Inscription introuvable" » (la garde a été franchie, l'action a travaillé).
 * Un test qui se contenterait d'un retour d'erreur ne saurait pas distinguer les
 * deux — et c'est précisément le cas laissé ouvert.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { etat } = vi.hoisted(() => ({ etat: { role: "admin" as string } }));
const mockEnrollmentFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    activityLog: { create: vi.fn() },
    enrollment: { findUnique: (...a: unknown[]) => mockEnrollmentFindUnique(...a) },
    factureFormation: { findMany: vi.fn(async () => []), create: vi.fn() },
  },
}));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: vi.fn(() => null) }));

// Seule la lecture de session est simulée : `requireAdminWrite` garde le
// comportement réel de `ROLES_ECRITURE`, et `requireHabilitation` + la matrice
// restent RÉELS.
vi.mock("@/server/actions/knowledge/_guards", async () => {
  const { peutEcrire } = await import("@/server/auth/habilitations");
  const requireAdminRead = async () => ({ userId: "u-1", role: etat.role });
  return {
    requireAdminRead,
    requireAdminWrite: async () => {
      const session = await requireAdminRead();
      if (!peutEcrire(session.role)) throw new Error("forbidden: écriture refusée");
      return session;
    },
    requireAdminPublish: vi.fn(),
    requireAdminDelete: vi.fn(),
    requireSuperAdmin: vi.fn(),
  };
});

import { genererFactureParInscriptionAction } from "./factures-inter";

const ENROLLMENT_ID = "22222222-2222-4222-8222-222222222222";

function connecteComme(role: string): void {
  etat.role = role;
}

describe("genererFactureParInscriptionAction — habilitation « facturer »", () => {
  beforeEach(() => {
    mockEnrollmentFindUnique.mockReset();
    // Inscription absente : le chemin métier s'arrête tout de suite. Ce que le
    // test observe, c'est laquelle des deux issues survient.
    mockEnrollmentFindUnique.mockResolvedValue(null);
  });

  it.each(["editor", "reader"])(
    "le rôle « %s » est refusé AVANT toute lecture d'inscription",
    async (role) => {
      connecteComme(role);
      await expect(
        genererFactureParInscriptionAction({ enrollmentId: ENROLLMENT_ID }),
        `${role} a franchi la garde de facturation`,
      ).rejects.toThrow(/^forbidden: /);
      expect(mockEnrollmentFindUnique).not.toHaveBeenCalled();
    },
  );

  it.each(["super_admin", "admin"])(
    "le rôle « %s » franchit la garde et travaille normalement",
    async (role) => {
      connecteComme(role);
      const res = await genererFactureParInscriptionAction({ enrollmentId: ENROLLMENT_ID });
      expect(res).toEqual({ error: "Inscription introuvable" });
      expect(mockEnrollmentFindUnique).toHaveBeenCalled();
    },
  );
});
