/**
 * `genererFactureCoachingAction` — la facture de coaching est un acte ENGAGEANT.
 *
 * ## Ce que ce fichier verrouille
 *
 * Le SSOT (`src/server/auth/habilitations.ts`) range explicitement la facture de
 * coaching sous l'acte `facturer` : « facturer couvre l'émission d'une facture de
 * formation, d'une facture libre, d'un avoir ET d'une facture de coaching : ce
 * sont le même engagement, et les distinguer inviterait à durcir l'un en oubliant
 * l'autre ». Et `_guards.ts:48-50` le dit de son côté : « à utiliser À LA PLACE de
 * `requireAdminWrite` sur tout acte engageant — `requireAdminWrite` autorise
 * `editor` : […] c'est faux pour attester, FACTURER, conclure ou habiliter ».
 *
 * L'action était pourtant gardée par `requireAdminWrite`, dont la liste
 * (`ROLES_ECRITURE`) contient `editor`. La doctrine écrite du dépôt et le code
 * ne disaient donc pas la même chose, et c'est le code qui servait.
 *
 * 🔴 Le test appelle la SERVER ACTION, pas la garde. `_habilitations.spec.ts`
 * prouve déjà que `requireHabilitation("facturer")` refuse les rôles non
 * habilités ; cela ne prouve rien tant qu'une action ne l'appelle pas. Une garde
 * juste que personne n'interroge ne garde rien.
 *
 * ## Pourquoi seule la session est simulée
 *
 * `requireHabilitation` et la matrice restent RÉELS : ce qui est simulé, c'est
 * uniquement la lecture NextAuth de la session (`requireAdminRead`) et le calcul
 * métier en aval. Un test qui simulerait `requireHabilitation` lui-même
 * vérifierait sa propre fixture.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { etat } = vi.hoisted(() => ({ etat: { role: "admin" as string } }));
const mockGenererFactureCoaching = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { activityLog: { create: vi.fn() } },
}));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: vi.fn(() => null) }));

// Seule la LECTURE DE SESSION est simulée. `requireAdminWrite` garde son
// comportement réel (la liste `ROLES_ECRITURE` du SSOT), sinon le test ne
// démontrerait pas que c'est bien cette garde-là qui laissait passer `editor`.
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

vi.mock("@/server/qualiopi/coaching-1to1/facturation-1to1", () => ({
  genererFactureCoaching: (...a: unknown[]) => mockGenererFactureCoaching(...a),
}));

import { genererFactureCoachingAction } from "./coaching-facturation";

const CONTRAT_ID = "11111111-1111-4111-8111-111111111111";

function connecteComme(role: string): void {
  etat.role = role;
}

describe("genererFactureCoachingAction — habilitation « facturer »", () => {
  beforeEach(() => {
    mockGenererFactureCoaching.mockReset();
    mockGenererFactureCoaching.mockResolvedValue({
      factureId: "f-1",
      documentId: "d-1",
      numero: "AXI-FACT-2026-001",
    });
  });

  it.each(["editor", "reader"])(
    "le rôle « %s » ne peut PAS émettre une facture de coaching",
    async (role) => {
      connecteComme(role);
      const res = await genererFactureCoachingAction({ coachingContractId: CONTRAT_ID });
      expect(res.ok, `${role} a pu émettre une facture de coaching`).toBe(false);
      // 🔴 Le témoin décisif : un `ok:false` peut venir d'un échec métier. Ce qui
      // prouve le refus, c'est que l'émission n'a jamais été TENTÉE.
      expect(mockGenererFactureCoaching).not.toHaveBeenCalled();
    },
  );

  it.each(["super_admin", "admin"])(
    "le rôle « %s » émet normalement — la garde ne bloque personne d'habilité",
    async (role) => {
      connecteComme(role);
      const res = await genererFactureCoachingAction({ coachingContractId: CONTRAT_ID });
      expect(res.ok, `${role} a été bloqué à tort`).toBe(true);
      expect(mockGenererFactureCoaching).toHaveBeenCalledWith(CONTRAT_ID);
    },
  );

  it("une session sans rôle exploitable est refusée, jamais laissée passer", async () => {
    connecteComme("role_inexistant");
    const res = await genererFactureCoachingAction({ coachingContractId: CONTRAT_ID });
    expect(res.ok).toBe(false);
    expect(mockGenererFactureCoaching).not.toHaveBeenCalled();
  });
});
