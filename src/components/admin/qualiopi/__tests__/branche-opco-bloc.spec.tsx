/**
 * Lot OPCO A7b — bloc « Branche et OPCO » de la fiche client.
 *
 * Témoins : un seul sélecteur d'OPCO ; utilisateur en lecture seule → bloc en
 * lecture seule (aucun formulaire) ; client particulier → pas de bloc.
 * Rendu serveur réel (`renderToStaticMarkup`), action serveur doublée.
 */

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/server/actions/qualiopi/clients", () => ({ updateClientAction: vi.fn() }));

import { BrancheOpcoBloc, type BrancheOpcoClient } from "../BrancheOpcoBloc";

const CLIENT: BrancheOpcoClient = {
  id: "33333333-3333-4333-8333-333333333333",
  type: "entreprise",
  idcc: "1486",
  conventionCollective: "Bureaux d'études techniques (Syntec)",
  taille: "TPE",
  effectif: 12,
  effectifSource: "saisie",
  effectifReleveLe: new Date("2026-10-04T00:00:00.000Z"),
  opco: "mobilites",
  opcoIdentifie: null,
  opcoEnveloppeAnnuelleCents: 300_000,
  opcoNumeroAdherent: "ADH-42",
  opcoAdhesionOffreMobilites: true,
  opcoVersementVolontaire: false,
};

function rendre(props: Partial<Parameters<typeof BrancheOpcoBloc>[0]> = {}): string {
  return renderToStaticMarkup(<BrancheOpcoBloc client={CLIENT} peutEcrire {...props} />);
}

describe("BrancheOpcoBloc", () => {
  it("affiche la branche, l'effectif et sa source, l'OPCO, l'enveloppe et l'adhérent", () => {
    const html = rendre({ peutEcrire: false });
    expect(html).toContain("Branche et OPCO");
    expect(html).toContain("1486");
    expect(html).toContain("12");
    expect(html).toContain("Saisi");
    expect(html).toContain("OPCO Mobilités");
    expect(html).toMatch(/3\s000\s€/);
    expect(html).toContain("ADH-42");
    expect(html).toContain("Offre Mobilités");
  });

  it("un seul sélecteur d'OPCO quand on peut écrire", () => {
    const html = rendre();
    expect(html.match(/<select[^>]*id="opco-/g) ?? []).toHaveLength(1);
    expect(html).toContain("Modifier");
  });

  it("utilisateur en lecture seule : bloc en lecture seule, sans formulaire", () => {
    const html = rendre({ peutEcrire: false });
    expect(html).toContain("Branche et OPCO");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<select");
    expect(html).not.toContain("Modifier");
  });

  it("client particulier : pas de bloc", () => {
    expect(rendre({ client: { ...CLIENT, type: "particulier" } })).toBe("");
  });

  it("OPCO inconnu mais texte libre reconnu : la suggestion s'affiche", () => {
    const html = rendre({
      peutEcrire: false,
      client: { ...CLIENT, opco: null, opcoIdentifie: "atlas" },
    });
    expect(html).toContain("Atlas");
    expect(html).toContain("suggéré");
  });

  it("l'offre Mobilités ne s'affiche que pour OPCO Mobilités", () => {
    const html = rendre({ peutEcrire: false, client: { ...CLIENT, opco: "atlas" } });
    expect(html).not.toContain("Offre Mobilités");
  });

  it("laisse une place sous l'effectif (relevé INSEE d'un autre lot)", () => {
    const html = rendre({ complementEffectif: <span>bouton-insee</span> });
    expect(html).toContain("bouton-insee");
  });
});
