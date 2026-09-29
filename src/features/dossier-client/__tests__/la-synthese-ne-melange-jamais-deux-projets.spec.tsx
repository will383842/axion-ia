/**
 * ⛔ La synthèse ne mélange JAMAIS deux projets : chaque projet a son bloc, et
 * le budget, le besoin et les engagements d'un projet n'apparaissent que dans
 * le sien.
 *
 * Rendu RÉEL de `OngletSynthese` ; on découpe le HTML par bloc de projet
 * (`data-projet`) et on vérifie chaque bloc séparément.
 *
 * Mutation qui fait rougir : dans `Onglets.tsx`, rendre pour chaque projet la
 * portée du premier (`consolidation.projets[projets[0].id]`), ou dans
 * `consolider-faits.ts` ne plus filtrer `projetId`.
 * Contre-témoin : chaque bloc contient bien SES valeurs.
 * Angle mort : l'ordre des projets (le plus récent d'abord) n'est pas vérifié.
 */

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/features/dossier-client/actions", () => ({
  ajouterPersonneFormAction: vi.fn(),
  basculerOppositionIaFormAction: vi.fn(),
  creerProjetFormAction: vi.fn(),
}));

import { OngletSynthese } from "@/components/admin/dossier-client/Onglets";
import type { ProjetDuDossier } from "../queries";
import { consoliderFaits } from "../consolider-faits";
import { MAINTENANT, faitProjet } from "./_faits";

function projet(id: string, titre: string): ProjetDuDossier {
  return {
    id,
    numero: `AXI-PRJ-2026-${id}`,
    titre,
    statut: "ouvert",
    derniereReouvertureLe: null,
    createdAt: MAINTENANT,
    devis: [],
    nbQuestionnaires: 0,
    contacts: [],
  };
}

function bloc(html: string, id: string): string {
  const debut = html.indexOf(`data-projet="${id}"`);
  expect(debut, `bloc du projet ${id} absent`).toBeGreaterThan(-1);
  const fin = html.indexOf("data-projet=", debut + 10);
  return html.slice(debut, fin === -1 ? undefined : fin);
}

describe("⛔ la synthèse ne mélange jamais deux projets", () => {
  it("chaque bloc ne porte que les valeurs de son projet", () => {
    const projets = [projet("001", "Formation RH"), projet("002", "Audit logistique")];
    const faits = [
      faitProjet("001", { type: "besoin", enonce: "Former vingt RH" }),
      faitProjet("001", { type: "budget", montantMaxCents: 1_200_000 }),
      faitProjet("001", {
        type: "engagement_axion",
        enonce: "Envoyer le programme RH",
        suivi: "ouvert",
      }),
      faitProjet("002", { type: "besoin", enonce: "Cartographier les flux" }),
      faitProjet("002", { type: "budget", montantMaxCents: 300_000 }),
    ];
    const html = renderToStaticMarkup(
      <OngletSynthese
        consolidation={consoliderFaits(faits, projets, MAINTENANT)}
        projets={projets}
        ficheHref="/fr/p/qualiopi/clients/x"
      />,
    );
    const rh = bloc(html, "001");
    const audit = bloc(html, "002");

    expect(rh).toContain("Former vingt RH");
    expect(rh).toContain("Envoyer le programme RH");
    expect(rh).not.toContain("Cartographier les flux");
    expect(audit).toContain("Cartographier les flux");
    expect(audit).not.toContain("Former vingt RH");
    expect(audit).not.toContain("Envoyer le programme RH");
    // 12 000 € dans le premier bloc seulement.
    expect(rh).toMatch(/12\s?000/);
    expect(audit).not.toMatch(/12\s?000/);
  });
});
