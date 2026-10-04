/**
 * Lot OPCO A7a — l'estimation de prise en charge d'un devis lit l'OPCO du
 * client par la règle unique `opcoDuClient` : OPCO typé d'abord, ancien texte
 * libre reconnu ensuite. Avant ce lot, elle ne lisait que `opcoIdentifie` et
 * estimait « réglages par défaut » un client dont seul l'OPCO typé était posé.
 *
 * L'estimation est interceptée : le test s'arrête là, il ne crée aucun devis.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockClientFindUnique = vi.fn();
const mockEstimate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { client: { findUnique: (...a: unknown[]) => mockClientFindUnique(...a) } },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-1", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-1", role: "super_admin" }),
  logQualiopiActivity: vi.fn(),
}));

// Seule l'estimation est interceptée : les autres fonctions du module
// (`dateDeReferenceDevis`, lot A7d) restent les vraies.
vi.mock("@/server/qualiopi/crm/devis", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/qualiopi/crm/devis")>()),
  estimateOpcoCoverage: (...a: unknown[]) => mockEstimate(...a),
}));

vi.mock("@/server/actions/qualiopi/documents", () => ({ genererConventionAction: vi.fn() }));

import { createDevisAction } from "./devis";

const CLIENT_ID = "550e8400-e29b-41d4-a716-446655440001";

const ENTREE = {
  clientId: CLIENT_ID,
  lignes: [{ designation: "Formation IA", quantite: 1, prixUnitaireHtCents: 150000 }],
  financementSuggere: "opco" as const,
  nbParticipants: 3,
  dureeHeures: 7,
  modaliteOpco: "intra" as const,
};

/** Rend l'OPCO passé à l'estimation (l'action s'arrête à l'interception). */
async function opcoEstime(client: Record<string, unknown>): Promise<unknown> {
  mockClientFindUnique.mockResolvedValue({ idcc: null, ...client });
  await createDevisAction(ENTREE).catch(() => undefined);
  expect(mockEstimate).toHaveBeenCalledOnce();
  return (mockEstimate.mock.calls[0]?.[0] as { opco?: unknown }).opco;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockEstimate.mockRejectedValue(new Error("interception du test"));
});

describe("createDevisAction — OPCO de l'estimation (lot A7a)", () => {
  it("client avec SEULEMENT opcoIdentifie = « atlas » : estimé pour Atlas", async () => {
    expect(await opcoEstime({ opco: null, opcoIdentifie: "atlas" })).toBe("atlas");
  });

  it("client avec SEULEMENT l'OPCO typé : estimé pour cet OPCO", async () => {
    expect(await opcoEstime({ opco: "akto", opcoIdentifie: null })).toBe("akto");
  });

  it("l'OPCO typé prime sur l'ancien texte libre", async () => {
    expect(await opcoEstime({ opco: "atlas", opcoIdentifie: "akto" })).toBe("atlas");
  });

  it("aucun OPCO reconnu : pas de clé `opco`, réglages par défaut", async () => {
    expect(await opcoEstime({ opco: null, opcoIdentifie: "OPCO ?" })).toBeUndefined();
  });
});
