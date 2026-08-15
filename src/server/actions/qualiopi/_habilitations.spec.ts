/**
 * Tests NÉGATIFS de la garde serveur `requireHabilitation`.
 *
 * 🔴 Exigence du Lot 10 : « le poste administratif qui tente l'acte réservé se
 * voit refusé côté SERVEUR, pas seulement privé du bouton ». Un test qui cache
 * un bouton ne prouve rien : la Server Action est joignable directement.
 *
 * Ce fichier teste la GARDE. La matrice elle-même est testée dans
 * `src/server/auth/habilitations.spec.ts` (module pur). Les deux sont
 * nécessaires : une matrice juste derrière une garde qui ne l'appelle pas ne
 * garde rien — c'est exactement ce qui s'est passé jusqu'au 2026-08-15, où la
 * frontière existait dans une constante que personne n'interrogeait.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// `vi.hoisted` : `vi.mock` est remonté au-dessus des `const`, donc une fabrique
// qui référencerait un `const` déclaré plus bas lèverait « Cannot access before
// initialization ». Le mock doit naître dans le même mouvement de hoisting.
const { requireAdminReadMock } = vi.hoisted(() => ({ requireAdminReadMock: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: { activityLog: { create: vi.fn() } } }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: vi.fn(() => null) }));
vi.mock("@/server/actions/knowledge/_guards", () => ({
  requireAdminRead: requireAdminReadMock,
  requireAdminWrite: vi.fn(),
  requireAdminPublish: vi.fn(),
  requireAdminDelete: vi.fn(),
  requireSuperAdmin: vi.fn(),
}));

import { requireHabilitation } from "@/server/actions/qualiopi/_guards";
import { ACTES_ENGAGEANTS, MOTIF_REFUS } from "@/server/auth/habilitations";

function connecteComme(role: string): void {
  requireAdminReadMock.mockResolvedValue({ userId: "u-1", role });
}

describe("requireHabilitation — refus côté serveur", () => {
  beforeEach(() => {
    requireAdminReadMock.mockReset();
  });

  it.each(["secretaire", "editor", "reader"])(
    "le rôle « %s » est refusé sur CHACUN des actes engageants",
    async (role) => {
      connecteComme(role);
      for (const acte of ACTES_ENGAGEANTS) {
        await expect(
          requireHabilitation(acte),
          `${role} n'a pas été refusé sur « ${acte} »`,
        ).rejects.toThrow(/^forbidden: /);
      }
    },
  );

  it("le refus porte le MOTIF, pas un code — l'écran doit pouvoir l'afficher", async () => {
    connecteComme("secretaire");
    // Un « forbidden » nu produit un appel téléphonique : la personne ne sait ni
    // pourquoi c'est refusé, ni à qui s'adresser.
    await expect(requireHabilitation("facturer")).rejects.toThrow(MOTIF_REFUS.facturer);
  });

  it("le responsable qualité est refusé sur le contractuel et le financier", async () => {
    connecteComme("responsable_qualite");
    await expect(requireHabilitation("conclure_devis")).rejects.toThrow(/^forbidden: /);
    await expect(requireHabilitation("facturer")).rejects.toThrow(/^forbidden: /);
    await expect(requireHabilitation("contresigner")).rejects.toThrow(/^forbidden: /);
    await expect(requireHabilitation("deposer_demande_financeur")).rejects.toThrow(/^forbidden: /);
  });

  it("le responsable qualité PASSE sur les actes de qualité qui lui reviennent", async () => {
    connecteComme("responsable_qualite");
    await expect(requireHabilitation("attester")).resolves.toMatchObject({
      role: "responsable_qualite",
    });
    await expect(requireHabilitation("valider_evaluation")).resolves.toBeTruthy();
    await expect(requireHabilitation("habiliter_formateur")).resolves.toBeTruthy();
  });

  it("la direction passe partout — la garde ne doit bloquer personne d'habilité", async () => {
    for (const role of ["super_admin", "admin"]) {
      connecteComme(role);
      for (const acte of ACTES_ENGAGEANTS) {
        await expect(
          requireHabilitation(acte),
          `${role} bloqué sur « ${acte} »`,
        ).resolves.toBeTruthy();
      }
    }
  });

  it("une session sans rôle exploitable est refusée, jamais laissée passer", async () => {
    requireAdminReadMock.mockResolvedValue({ userId: "u-1", role: "" });
    await expect(requireHabilitation("attester")).rejects.toThrow(/^forbidden: /);
    requireAdminReadMock.mockResolvedValue({ userId: "u-1", role: "role_inexistant" });
    await expect(requireHabilitation("attester")).rejects.toThrow(/^forbidden: /);
  });

  it("une session absente remonte l'erreur d'authentification, pas un refus d'habilitation", async () => {
    // La distinction compte : « non connecté » et « connecté mais pas habilité »
    // appellent deux gestes différents côté écran.
    requireAdminReadMock.mockRejectedValue(new Error("unauthorized"));
    await expect(requireHabilitation("attester")).rejects.toThrow("unauthorized");
  });
});
