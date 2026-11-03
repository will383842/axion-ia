/**
 * Fiche client : « Faire un devis » (action principale, client pré-sélectionné)
 * pour les rôles qui écrivent ; absent pour le lecteur.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({ session: null as unknown }));

vi.mock(
  "@/components/admin/dossier-client/fiche/emplacements",
  async () => (await import("./_emplacements-vides")).emplacementsVides,
);
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
vi.mock("@/features/dossier-client/questionnaires-de-la-fiche", () => ({
  lireQuestionnairesDeLaFiche: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/features/dossier-client/fil-des-echanges", () => ({
  lireFilDesEchanges: vi.fn().mockResolvedValue({ fil: [], sourcesEnPanne: 0 }),
}));

import Page from "@/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/[id]/page";
import { ID_CLIENT, rendreFiche } from "./_fiche-client-rendu";

beforeEach(() => vi.clearAllMocks());

describe("bouton « Faire un devis » de la fiche client", () => {
  const HREF = `/fr/console/qualiopi/devis/new?clientId=${ID_CLIENT}`;

  it.each(["super_admin", "admin"])(
    "rôle « %s » (voit les échanges) : bouton secondaire, aucun bouton plein dans l'en-tête",
    async (role) => {
      d.session = { user: { id: "u1", role } };
      const html = await rendreFiche(Page, undefined);
      expect(html).toContain(`<a class="admin-button-secondary" href="${HREF}">Faire un devis</a>`);
      // Au plus un bouton plein par écran : ici, aucun lien plein vers devis/vente.
      expect(html).not.toMatch(/<a class="admin-button" href="[^"]*(devis|vente)\/new/);
    },
  );

  it.each(["responsable_qualite", "secretaire", "editor"])(
    "rôle « %s » : lien vers /devis/new avec le client, en action principale",
    async (role) => {
      d.session = { user: { id: "u1", role } };
      const html = await rendreFiche(Page, undefined);
      expect(html).toContain(`<a class="admin-button" href="${HREF}">Faire un devis</a>`);
    },
  );

  it("rôle « reader » : fiche rendue, mais pas de bouton", async () => {
    d.session = { user: { id: "u1", role: "reader" } };
    const html = await rendreFiche(Page, undefined);
    expect(html).toContain("Atelier Fictif SARL");
    expect(html).not.toContain("Faire un devis");
    expect(html).not.toContain("/devis/new");
  });
});
