/**
 * ⛔ LA RESPONSABLE QUALITÉ VOIT TOUJOURS LA FACTURATION — aucune régression
 * Qualiopi : la fiche client reste ouverte à tous les rôles de la console
 * (`gardePage("consultation")` en tête), et « Pièces et facturation »
 * (indicateurs, devis, factures, encours) reste affiché pour les rôles exclus
 * du dossier par la décision A2.
 *
 * Rendu de la VRAIE page, VRAIE `gardePage`, session doublée.
 *
 * Mutation qui fait rougir : conditionner le bloc « Pièces et facturation » à
 * `peutVoirLesEchanges`, ou appeler `gardeLectureEchanges` en tête de la page.
 * Contre-témoin : un administrateur qui choisit l'onglet « Pièces et
 * facturation » voit la même chose.
 * Angle mort : le contenu exact des montants n'est pas relu ici.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({ session: null as unknown }));

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
vi.mock("@/server/actions/qualiopi/clients", () => ({ updateClientAction: vi.fn() }));

import Page from "@/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/[id]/page";
import { rendreFiche } from "./_fiche-client-rendu";

beforeEach(() => vi.clearAllMocks());

const FACTURATION = ["Encours dû", "Devis", "AXI-DEV-2026-001", "Factures", "AXI-FACT-2026-001"];

describe("⛔ la responsable qualité voit toujours la facturation", () => {
  it("responsable_qualite : pièces, devis, factures et encours sont là", async () => {
    d.session = { user: { id: "u1", role: "responsable_qualite" } };
    const html = await rendreFiche(Page);
    for (const attendu of FACTURATION) expect(html).toContain(attendu);
    expect(html).not.toContain("Accès refusé");
  });

  it.each(["secretaire", "reader", "editor"])("« %s » voit aussi la facturation", async (role) => {
    d.session = { user: { id: "u1", role } };
    const html = await rendreFiche(Page);
    for (const attendu of FACTURATION) expect(html).toContain(attendu);
  });

  it("contre-témoin : un administrateur sur l'onglet « Pièces et facturation » voit la même chose", async () => {
    d.session = { user: { id: "u1", role: "admin" } };
    const html = await rendreFiche(Page, "facturation");
    for (const attendu of FACTURATION) expect(html).toContain(attendu);
  });
});
