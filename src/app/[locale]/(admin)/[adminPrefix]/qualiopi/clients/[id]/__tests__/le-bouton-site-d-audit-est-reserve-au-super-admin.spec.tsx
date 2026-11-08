/**
 * Fiche client : « Audit : ouvrir le site » réservé au super_admin, et seulement quand la
 * variable SITE_AUDIT_DOCUMENTS désigne un document pour ce client.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const PROJET = "11111111-2222-4333-8444-555555555555";
const DOCUMENT = "66666666-7777-4888-8999-aaaaaaaaaaaa";
const HREF = `/api/admin/site-audit/${ID_CLIENT}`;

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllEnvs());

describe("bouton « Audit : ouvrir le site » de la fiche client", () => {
  it("super_admin + variable : lien vers la route, dans un nouvel onglet", async () => {
    vi.stubEnv("SITE_AUDIT_DOCUMENTS", `${ID_CLIENT}:${PROJET}:${DOCUMENT}`);
    d.session = { user: { id: "u1", role: "super_admin" } };
    const html = await rendreFiche(Page, undefined);
    expect(html).toContain(`href="${HREF}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("Audit : ouvrir le site");
  });

  it("super_admin sans variable : pas de bouton", async () => {
    vi.stubEnv("SITE_AUDIT_DOCUMENTS", "");
    d.session = { user: { id: "u1", role: "super_admin" } };
    const html = await rendreFiche(Page, undefined);
    expect(html).not.toContain("Audit : ouvrir le site");
    expect(html).not.toContain(HREF);
  });

  it("admin avec variable : pas de bouton", async () => {
    vi.stubEnv("SITE_AUDIT_DOCUMENTS", `${ID_CLIENT}:${PROJET}:${DOCUMENT}`);
    d.session = { user: { id: "u1", role: "admin" } };
    const html = await rendreFiche(Page, undefined);
    expect(html).not.toContain("Audit : ouvrir le site");
    expect(html).not.toContain(HREF);
  });
});
