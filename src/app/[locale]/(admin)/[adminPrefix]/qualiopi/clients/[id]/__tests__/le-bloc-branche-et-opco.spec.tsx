/**
 * Lot OPCO A7b — la fiche client montre un bloc « Branche et OPCO ».
 *
 * Rendu de la VRAIE page, VRAIE `gardePage`, session doublée. Témoins : un seul
 * sélecteur d'OPCO pour qui peut écrire ; lecture seule → bloc sans formulaire ;
 * particulier → pas de bloc.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({ session: null as unknown, fiche: null as unknown }));

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
vi.mock("@/server/qualiopi/crm/clients", async (orig) => ({
  ...(await orig<typeof import("@/server/qualiopi/crm/clients")>()),
  getClient360: () => Promise.resolve(d.fiche),
}));
vi.mock("@/server/qualiopi/financements/etat-fonds-opco-lecture", () => ({
  etatFondsDuClient: () => Promise.resolve(null),
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
vi.mock("@/server/actions/qualiopi/clients", () => ({ updateClientAction: vi.fn() }));

import Page from "@/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/[id]/page";
import { FICHE_360, rendreFiche } from "./_fiche-client-rendu";

const BRANCHE = {
  idcc: "1486",
  conventionCollective: null,
  taille: "TPE",
  effectif: 12,
  effectifSource: "saisie",
  effectifReleveLe: new Date("2026-10-04T00:00:00.000Z"),
  opco: "atlas",
  opcoEnveloppeAnnuelleCents: 300_000,
  opcoNumeroAdherent: "ADH-1",
  opcoAdhesionOffreMobilites: null,
  opcoVersementVolontaire: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  d.fiche = { ...FICHE_360, ...BRANCHE };
});

/** Le bloc seul, découpé dans le rendu de la page. */
function bloc(html: string): string {
  const debut = html.indexOf("Branche et OPCO");
  return debut < 0 ? "" : html.slice(debut, html.indexOf("</section>", debut));
}

describe("fiche client — bloc « Branche et OPCO »", () => {
  it("administrateur : le bloc, ses valeurs, et UN seul sélecteur d'OPCO", async () => {
    d.session = { user: { id: "u1", role: "admin" } };
    const html = await rendreFiche(Page, "facturation");
    expect(bloc(html)).toContain("1486");
    expect(bloc(html)).toContain("Atlas");
    expect(bloc(html)).toContain("ADH-1");
    expect(html.match(/<select[^>]*id="opco-/g) ?? []).toHaveLength(1);
  });

  it("lecture seule : le bloc s'affiche sans formulaire", async () => {
    d.session = { user: { id: "u1", role: "reader" } };
    const html = await rendreFiche(Page);
    expect(bloc(html)).toContain("1486");
    expect(bloc(html)).toContain("Lecture seule");
    expect(bloc(html)).not.toContain("<select");
    expect(bloc(html)).not.toContain("<form");
  });

  it("particulier : pas de bloc", async () => {
    d.session = { user: { id: "u1", role: "admin" } };
    d.fiche = { ...FICHE_360, ...BRANCHE, type: "particulier" };
    const html = await rendreFiche(Page, "facturation");
    expect(html).not.toContain("Branche et OPCO");
  });
});
