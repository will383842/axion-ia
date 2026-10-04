/**
 * Lot OPCO A7d — la fiche client affiche, en lecture seule, ce que l'OPCO a
 * déjà pris en charge (année en cours et précédente : accordé, en cours), et
 * l'effectif avec sa provenance et le bouton « Rafraîchir depuis l'INSEE ».
 *
 * Témoins : les deux années de Paris sont demandées pour l'OPCO de
 * `opcoDuClient` ; montants affichés en euros ; un effectif SAISI n'offre pas
 * le bouton (rien à rafraîchir : la saisie prime) ; l'annuaire n'est JAMAIS
 * interrogé au rendu.
 * Contre-témoin : un particulier n'a ni bloc OPCO ni effectif.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  session: null as unknown,
  fiche: {} as Record<string, unknown>,
  consommation: vi.fn(),
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
    getClient360: () => Promise.resolve({ ...FICHE_360, ...d.fiche }),
  };
});
vi.mock("@/server/qualiopi/financements/consommation-opco", async (orig) => ({
  ...(await orig<typeof import("@/server/qualiopi/financements/consommation-opco")>()),
  consommationOpcoParAnnee: (...a: unknown[]) => d.consommation(...a),
}));
vi.mock("@/server/qualiopi/financements/etat-fonds-opco-lecture", () => ({
  etatFondsDuClient: async () => null,
}));
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
  garderCetteValeurFormAction: vi.fn(),
  confirmerSirenFormAction: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/clients", () => ({
  updateClientAction: vi.fn(),
  rafraichirEffectifInseeFormAction: vi.fn(),
}));

import Page from "../page";
import { rendreFiche } from "./_fiche-client-rendu";

const annee = Number(
  new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric" }).format(
    new Date(),
  ),
);

beforeEach(() => {
  vi.clearAllMocks();
  d.session = { user: { id: "u1", role: "admin" } };
  d.fiche = {
    opco: "atlas",
    opcoIdentifie: null,
    effectif: 10,
    effectifSource: "insee",
    effectifReleveLe: new Date("2026-10-04T00:00:00Z"),
  };
  d.consommation.mockImplementation(async (_id: string, _opco: string, annees: number[]) =>
    annees.map((a) => ({
      annee: a,
      accordeCents: a === annee ? 123_400 : 50_000,
      enCoursCents: a === annee ? 20_000 : 0,
    })),
  );
});

describe("la fiche dit ce que l'OPCO a déjà pris en charge", () => {
  it("année en cours et précédente, pour l'OPCO typé, en euros", async () => {
    const html = await rendreFiche(Page as never);
    expect(d.consommation).toHaveBeenCalledWith(expect.any(String), "atlas", [annee, annee - 1]);
    expect(html).toContain("Déjà pris en charge par l&#x27;OPCO (Atlas)");
    expect(html).toContain(String(annee));
    expect(html).toContain(String(annee - 1));
    expect(html).toMatch(/1\s?234,00/);
    expect(html).toMatch(/200,00/);
  });

  it("effectif INSEE : provenance, date, et bouton de rafraîchissement — sans appel au rendu", async () => {
    const html = await rendreFiche(Page as never);
    expect(html).toContain("10 salariés");
    expect(html).toContain("Relevé INSEE (borne basse de la tranche)");
    expect(html).toContain("Rafraîchir depuis l&#x27;INSEE");
    expect(d.annuaire).not.toHaveBeenCalled();
  });

  it("effectif SAISI : provenance « saisi », pas de bouton (la saisie prime)", async () => {
    d.fiche = { ...d.fiche, effectifSource: "saisie" };
    const html = await rendreFiche(Page as never);
    expect(html).toContain("Saisi en console");
    expect(html).not.toContain("Rafraîchir depuis l&#x27;INSEE");
  });

  it("OPCO indéterminé : le bloc le dit, aucune lecture", async () => {
    d.fiche = { ...d.fiche, opco: null, opcoIdentifie: null };
    const html = await rendreFiche(Page as never);
    expect(html).toContain("n&#x27;est pas déterminé");
    expect(d.consommation).not.toHaveBeenCalled();
  });

  it("contre-témoin : un particulier n'a ni bloc OPCO ni effectif", async () => {
    d.fiche = { ...d.fiche, type: "particulier" };
    const html = await rendreFiche(Page as never);
    expect(html).not.toContain("Déjà pris en charge par l");
    expect(html).not.toContain('data-champ="effectif"');
  });
});
