/**
 * Lot A9 — la carte d'identité de la fiche client sépare la SOCIÉTÉ du CONTACT.
 *
 * Remarque de Williams (SCI Invest Sun, contact Simone Blanc, SIRET
 * 90143483700018) : « ça me demande le SIRET des contacts alors que c'est la
 * société qui devrait l'avoir ». Le SIRET était posé juste à côté de
 * « CONTACT · Simone Blanc » ; « SIREN à compléter » s'affichait alors que le
 * SIRET le contenait ; « Rafraîchir depuis l'INSEE » ne s'affichait jamais ;
 * l'effectif apparaissait deux fois.
 *
 * Rendu de la VRAIE page. Mutations qui font rougir : relire `client.siren`
 * seul pour le badge ou le bouton ; remettre le SIRET dans le bloc Contact ;
 * remettre la case « Effectif » dans la carte.
 * Contre-témoin : un particulier n'a pas de bloc Société.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  session: null as unknown,
  fiche: {} as Record<string, unknown>,
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

const SCI = {
  raisonSociale: "SCI Invest Sun",
  contactNom: "Simone Blanc",
  contactEmail: "simone.blanc@invest-sun.example",
  contactTelephone: "06 12 34 56 78",
  contactFonction: "Gérante",
  siret: "90143483700018",
  siren: null,
  idcc: null,
  conventionCollective: null,
  taille: null,
  effectif: null,
  effectifSource: null,
  effectifReleveLe: null,
  opco: null,
  opcoEnveloppeAnnuelleCents: null,
  opcoAdhesionOffreMobilites: null,
  opcoVersementVolontaire: null,
};

/** Le contenu d'un bloc `data-bloc="…"` de la carte d'identité. */
function bloc(html: string, nom: "societe" | "contact"): string {
  const debut = html.indexOf(`data-bloc="${nom}"`);
  return debut < 0 ? "" : html.slice(debut, html.indexOf("</section>", debut));
}

beforeEach(() => {
  vi.clearAllMocks();
  d.session = { user: { id: "u1", role: "admin" } };
  d.fiche = { ...SCI };
});

describe("fiche client — la société d'un côté, le contact de l'autre", () => {
  it("SIRET de 14 chiffres sans SIREN : pas de badge, SIREN déduit, bouton INSEE visible", async () => {
    const html = await rendreFiche(Page, "facturation");
    expect(html).not.toContain("SIREN à compléter");
    expect(html).not.toContain("Chercher le SIREN");
    expect(bloc(html, "societe")).toContain("901434837");
    expect(html).toContain("Rafraîchir depuis l&#x27;INSEE");
  });

  it("le SIRET et le SIREN sont dans le bloc Société, jamais dans le bloc Contact", async () => {
    const html = await rendreFiche(Page, "facturation");
    expect(bloc(html, "societe")).toContain("90143483700018");
    expect(bloc(html, "societe")).toContain("SCI Invest Sun");
    expect(bloc(html, "contact")).toContain("Simone Blanc");
    expect(bloc(html, "contact")).toContain("simone.blanc@invest-sun.example");
    expect(bloc(html, "contact")).toContain("Gérante");
    expect(bloc(html, "contact")).toContain("06 12 34 56 78");
    expect(bloc(html, "contact")).not.toMatch(/SIRE[NT]|90143483700018|901434837/);
  });

  it("l'effectif n'apparaît qu'une fois, et le bouton INSEE est sous sa tuile", async () => {
    const html = await rendreFiche(Page, "facturation");
    expect(html.match(/>Effectif</g) ?? []).toHaveLength(1);
    const tuile = html.slice(html.indexOf(">Effectif<"), html.indexOf(">OPCO<"));
    expect(tuile).toContain("Rafraîchir depuis l&#x27;INSEE");
  });

  it("SIREN saisi différent du SIRET : conservé, et averti", async () => {
    d.fiche = { ...SCI, siren: "732829320" };
    const html = await rendreFiche(Page, "facturation");
    expect(bloc(html, "societe")).toContain("732829320");
    expect(bloc(html, "societe")).toContain("Le SIREN ne correspond pas au SIRET");
  });

  it("SIREN conforme au SIRET : aucun avertissement", async () => {
    d.fiche = { ...SCI, siren: "901434837" };
    const html = await rendreFiche(Page, "facturation");
    expect(html).not.toContain("ne correspond pas");
  });

  it("entreprise sans SIRET ni SIREN : le badge reste", async () => {
    d.fiche = { ...SCI, siret: null, siren: null };
    const html = await rendreFiche(Page, "facturation");
    expect(html).toContain("SIREN à compléter");
    expect(html).not.toContain("Rafraîchir depuis l&#x27;INSEE");
  });

  it("contre-témoin : un particulier n'a pas de bloc Société, mais garde son contact", async () => {
    d.fiche = { ...SCI, type: "particulier", siret: null, raisonSociale: "Simone Blanc" };
    const html = await rendreFiche(Page, "facturation");
    expect(html).not.toContain('data-bloc="societe"');
    expect(bloc(html, "contact")).toContain("simone.blanc@invest-sun.example");
    expect(html).not.toContain("SIREN à compléter");
  });
});
