/**
 * « SIREN à compléter » (plan §3.17 point 4) : sur la fiche d'une entreprise
 * sans SIREN, l'annuaire public n'est interrogé QUE sur demande (lien
 * « Chercher le SIREN dans l'annuaire », `?annuaire=1`), côté serveur ; chaque
 * proposition est un formulaire « C'est elle » — rien n'est écrit sans ce clic,
 * et aucun JavaScript n'est envoyé au navigateur.
 *
 * Mutation qui fait rougir : interroger l'annuaire à chaque affichage de la
 * fiche (sans `?annuaire=1`), ou écrire le SIREN sans formulaire.
 * Contre-témoin : une fiche qui a déjà un SIREN n'offre rien.
 * Angle mort : l'action `confirmerSirenFormAction` passe par
 * `updateClientAction`, testée ailleurs (SIREN contraire au SIRET refusé).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  session: null as unknown,
  siren: null as string | null,
  annuaire: vi.fn(),
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
    getClient360: () => Promise.resolve({ ...FICHE_360, siren: d.siren }),
  };
});
vi.mock("@/features/dossier-client/recherche-entreprises", () => ({
  rechercherSiren: (...a: unknown[]) => d.annuaire(...a),
}));
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
  confirmerSirenFormAction: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/clients", () => ({ updateClientAction: vi.fn() }));

import { renderToStaticMarkup } from "react-dom/server";
import Page from "../page";
import { ID_CLIENT } from "./_fiche-client-rendu";

async function rendre(annuaire: boolean): Promise<string> {
  const element = await Page({
    params: Promise.resolve({ locale: "fr", adminPrefix: "console", id: ID_CLIENT }),
    searchParams: Promise.resolve(annuaire ? { onglet: "facturation", annuaire: "1" } : {}),
  });
  return renderToStaticMarkup(element);
}

beforeEach(() => {
  vi.clearAllMocks();
  d.session = { user: { id: "u1", role: "admin" } };
  d.siren = null;
  d.annuaire.mockResolvedValue({
    ok: true,
    propositions: [
      { siren: "552100554", nom: "ATELIER FICTIF", ville: "LYON", codePostal: "69001" },
    ],
  });
});

describe("le SIREN proposé par l'annuaire se confirme d'un clic", () => {
  it("sans demande : badge et lien, l'annuaire n'est PAS interrogé", async () => {
    const html = await rendre(false);
    expect(html).toContain("SIREN à compléter");
    expect(html).toContain("annuaire=1");
    expect(d.annuaire).not.toHaveBeenCalled();
  });

  it("sur demande : chaque proposition est un formulaire « C'est elle »", async () => {
    const html = await rendre(true);
    expect(d.annuaire).toHaveBeenCalledOnce();
    expect(html).toContain("552100554");
    expect(html).toContain("C&#x27;est elle");
    expect(html).toMatch(/<form[^>]*>[\s\S]*name="siren" value="552100554"/);
  });

  it("annuaire en panne : un message, la saisie à la main reste possible", async () => {
    d.annuaire.mockResolvedValue({ ok: false, motif: "indisponible" });
    const html = await rendre(true);
    expect(html).toContain("ne répond pas pour l&#x27;instant");
  });

  it("contre-témoin : une fiche qui a déjà un SIREN n'offre rien", async () => {
    d.siren = "552100554";
    const html = await rendre(true);
    expect(html).not.toContain("SIREN à compléter");
    expect(d.annuaire).not.toHaveBeenCalled();
  });
});
