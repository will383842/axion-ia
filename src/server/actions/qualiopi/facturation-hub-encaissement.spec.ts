/**
 * `enregistrerPaiementFactureAction` — ENCAISSER est un acte ENGAGEANT.
 *
 * Le SSOT ne laisse aucune marge d'interprétation : l'acte `facturer` est défini
 * comme « Émettre une facture, un avoir, OU ENCAISSER ». Enregistrer un paiement
 * solde une créance, fait basculer la facture en `payee`, la retire de la balance
 * âgée et du circuit de relance : c'est un acte comptable opposable, pas une
 * saisie courante.
 *
 * Quatre des cinq actes de facturation du hub appelaient déjà
 * `requireHabilitation("facturer")` (émission libre, émission depuis devis,
 * avoir, émission d'un brouillon). L'encaissement, lui, restait sur
 * `requireAdminWrite` — qui autorise `editor`. C'est le cinquième côté du même
 * carré : une exception silencieuse dans un ensemble par ailleurs durci est
 * précisément ce que le SSOT existe pour empêcher.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { etat } = vi.hoisted(() => ({ etat: { role: "admin" as string } }));
const mockEnregistrerPaiement = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    activityLog: { create: vi.fn() },
    factureFormation: { findUnique: vi.fn(), findMany: vi.fn(async () => []), create: vi.fn() },
    relanceProposee: { findUnique: vi.fn(), updateMany: vi.fn() },
    planRecurrent: { create: vi.fn(), updateMany: vi.fn() },
    payment: { findMany: vi.fn(async () => []) },
    devis: { findUnique: vi.fn() },
    documentSignature: { findMany: vi.fn(async () => []) },
  },
}));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: vi.fn(() => null) }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn(async () => ({ enqueued: true })) }));

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

vi.mock("@/server/qualiopi/financements/facture-libre", () => ({
  genererFactureLibre: vi.fn(),
  genererAvoirFacture: vi.fn(),
  enregistrerPaiementFacture: (...a: unknown[]) => mockEnregistrerPaiement(...a),
}));
vi.mock("@/server/qualiopi/financements/dossier-financement", () => ({
  transitionnerDossier: vi.fn(),
  creerDossierDepuisSession: vi.fn(),
}));

import { enregistrerPaiementFactureAction } from "./facturation-hub";

const FACTURE_ID = "33333333-3333-4333-8333-333333333333";

const paiement = {
  factureId: FACTURE_ID,
  montantCents: 120_000,
  paidAt: new Date("2026-06-01T10:00:00.000Z"),
  mode: "manual_wire" as const,
};

function connecteComme(role: string): void {
  etat.role = role;
}

describe("enregistrerPaiementFactureAction — habilitation « facturer »", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test");
    mockEnregistrerPaiement.mockReset();
    mockEnregistrerPaiement.mockResolvedValue({
      paymentId: "p-1",
      statut: "payee",
      resteACents: 0,
    });
  });

  it.each(["editor", "reader"])("le rôle « %s » ne peut PAS encaisser", async (role) => {
    connecteComme(role);
    await expect(
      enregistrerPaiementFactureAction(paiement),
      `${role} a pu enregistrer un encaissement`,
    ).rejects.toThrow(/^forbidden: /);
    expect(mockEnregistrerPaiement).not.toHaveBeenCalled();
  });

  it.each(["super_admin", "admin"])(
    "le rôle « %s » encaisse normalement — la garde ne bloque personne d'habilité",
    async (role) => {
      connecteComme(role);
      const res = await enregistrerPaiementFactureAction(paiement);
      expect(res, `${role} a été bloqué à tort`).toEqual({
        data: { paymentId: "p-1", statut: "payee", resteACents: 0 },
      });
      expect(mockEnregistrerPaiement).toHaveBeenCalled();
    },
  );
});
