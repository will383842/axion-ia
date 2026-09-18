/**
 * 🛑 GARDE — le PowerPoint PROJETÉ n'est fabriqué par AUCUNE voie du moteur
 * de SUPPORTS (lot, individuelle, régénération).
 *
 * `le-ppt-projete-nest-jamais-genere.spec.ts` garde la voie EN LOT
 * (`TOUS_SUPPORT_TYPES`). Mesuré le 2026-09-17 : la voie INDIVIDUELLE était
 * restée ouverte trois semaines après la fermeture en lot (#851) — un bouton
 * « Générer » par type, un schéma Zod qui acceptait les deux valeurs, et un
 * service qui les produisait. Cette garde-ci ferme les deux étages qu'un appel
 * direct atteint : l'action serveur et le service (goulot de `regenererSupport`
 * et de `genererTousSupports`).
 *
 * ## Ce que cette garde ne couvre PAS
 *
 * `genererDiaporamaAction` (`src/server/actions/qualiopi/diaporama.ts`) produit
 * toujours un .pptx projeté, par un AUTRE chemin : sur un clic explicite, en
 * version `brouillon` qui ne remplace pas le fichier déposé tant que Will ne
 * l'a pas publiée. Décision distincte, non tranchée ici — même limite que
 * `le-ppt-projete-nest-jamais-genere.spec.ts`, lignes 20-27.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    formation: { findUnique: vi.fn() },
    supportFormation: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ user: { id: "admin-1" } }),
  requireAdminDelete: vi.fn().mockResolvedValue({ user: { id: "admin-1" } }),
  logQualiopiActivity: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { genererSupportAction } from "@/server/actions/qualiopi/supports";
import { genererSupport } from "@/server/qualiopi/supports/supports-service";
import {
  MOTIF_REFUS_SUPPORT_PROJETE,
  SUPPORTS_PROJETES_INTERDITS,
  estSupportProjete,
} from "@/server/qualiopi/supports/types";

const mp = prisma as unknown as { formation: { findUnique: ReturnType<typeof vi.fn> } };
const SLIDES = ["slides_formateur", "slides_stagiaire"] as const;
const FORMATION_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => vi.clearAllMocks());

describe("🛑 le moteur de supports ne fabrique aucun PowerPoint projeté, quelle que soit sa voie", () => {
  it("la liste interdite porte exactement les deux supports projetés", () => {
    expect([...SUPPORTS_PROJETES_INTERDITS].sort()).toEqual([...SLIDES].sort());
    expect(estSupportProjete("livret_stagiaire")).toBe(false);
  });

  for (const type of SLIDES) {
    it(`l'action refuse ${type} avec le motif NOMMÉ, sans rien lire en base`, async () => {
      const r = await genererSupportAction({ formationId: FORMATION_ID, type } as never);
      expect(r).toEqual({ error: MOTIF_REFUS_SUPPORT_PROJETE });
      expect(mp.formation.findUnique).not.toHaveBeenCalled();
    });

    it(`le service refuse ${type} avant toute lecture — goulot des trois voies`, async () => {
      await expect(genererSupport({ formationId: FORMATION_ID, type })).rejects.toThrow(
        MOTIF_REFUS_SUPPORT_PROJETE,
      );
      expect(mp.formation.findUnique).not.toHaveBeenCalled();
    });
  }
});
