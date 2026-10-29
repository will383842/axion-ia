/**
 * Lot 0 (socle) : avec les emplacements vides, l'onglet « Devis et factures » rend toujours ses
 * huit sections, déplacées dans `fiche/OngletDevisFactures.tsx`.
 *
 * Mutation qui rougit : oublier une section en déplaçant le bloc, ou rendre l'onglet vide.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({ session: null as unknown }));

vi.mock("@/components/admin/dossier-client/fiche/emplacements", async () => ({
  ...(await import("./_emplacements-vides")).emplacementsVides,
}));
vi.mock("@/auth", () => ({ auth: () => Promise.resolve(d.session) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/server/qualiopi/crm/clients", async (orig) => {
  const { FICHE_360 } = await import("./_fiche-client-rendu");
  return {
    ...(await orig<typeof import("@/server/qualiopi/crm/clients")>()),
    getClient360: () => Promise.resolve(FICHE_360),
  };
});
vi.mock("@/features/dossier-client/queries", () => ({
  lireFaitsDuClient: vi.fn().mockResolvedValue([]),
  lireProjetsDuClient: vi.fn().mockResolvedValue([]),
  lireFaitsARanger: vi.fn().mockResolvedValue([]),
  lireRencontresDuClient: vi.fn().mockResolvedValue([]),
  lirePersonnesDuClient: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/features/dossier-client/actions", () => ({
  ajouterPersonneFormAction: vi.fn(),
  basculerOppositionIaFormAction: vi.fn(),
  creerProjetFormAction: vi.fn(),
  garderCetteValeurFormAction: vi.fn(),
  confirmerSirenFormAction: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/clients", () => ({
  updateClientAction: vi.fn(),
  rafraichirEffectifInseeFormAction: vi.fn(),
}));

import Page from "@/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/[id]/page";
import { rendreFiche } from "./_fiche-client-rendu";

beforeEach(() => vi.clearAllMocks());

const SECTIONS = [
  "Sessions de formation",
  "Contrats de coaching",
  "Missions d&#x27;audit",
  "Devis",
  "Factures",
  "Documents générés",
  "Dossiers de financement",
  "E-mails en attente",
];

describe("l'onglet Devis et factures, emplacements vides", () => {
  it("rend les huit sections", async () => {
    d.session = { user: { id: "u1", role: "admin" } };
    const html = await rendreFiche(Page, "devis-factures");
    for (const titre of SECTIONS) expect(html).toContain(titre);
  });
});

// Lot 1 fiche client : le bloc « Questionnaire avant audit » lit la base ; ces specs ne la touchent pas.
vi.mock("@/features/dossier-client/questionnaires-de-la-fiche", () => ({
  lireQuestionnairesDeLaFiche: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/features/dossier-client/fil-des-echanges", () => ({
  lireFilDesEchanges: vi.fn().mockResolvedValue({ fil: [], sourcesEnPanne: 0 }),
}));
