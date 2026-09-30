/**
 * ⛔ L'onglet Synthèse montre, EN TÊTE, ce que fait la société (activité,
 * effectif, outils, niveau en IA) — c'est la promesse « le résumé va dans la
 * fiche client » (vérification V1-C1).
 *
 * Rendu RÉEL du composant serveur `OngletSynthese` (texte HTML), sur un jeu
 * fictif consolidé par la vraie `consoliderFaits`.
 *
 * Mutation qui fait rougir : retirer le bloc « Ce que fait la société », ou
 * le placer après les projets.
 * Contre-témoin : une fiche sans fait affiche le message « Rien de validé ».
 * Angle mort : le style (couleurs, espaces) n'est pas vérifié.
 */

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/features/dossier-client/actions", () => ({
  ajouterPersonneFormAction: vi.fn(),
  basculerOppositionIaFormAction: vi.fn(),
  creerProjetFormAction: vi.fn(),
  garderCetteValeurFormAction: vi.fn(),
}));

import { OngletSynthese } from "@/components/admin/dossier-client/Onglets";
import { consoliderFaits } from "../consolider-faits";
import { MAINTENANT, fait } from "./_faits";

describe("⛔ la synthèse montre ce que fait la société", () => {
  it("activité, effectif, outils et niveau en IA, avant les projets", () => {
    const faits = [
      fait({ type: "activite", texteCourt: "Menuiserie industrielle" }),
      fait({ type: "effectif", quantite: 42 }),
      fait({ type: "outil_utilise", cle: "excel", texteCourt: "Excel" }),
      fait({ type: "niveau_ia", texteCourt: "Débutant" }),
    ];
    const html = renderToStaticMarkup(
      <OngletSynthese
        consolidation={consoliderFaits(faits, [], MAINTENANT)}
        projets={[]}
        ficheHref="/fr/p/qualiopi/clients/x"
      />,
    );
    const iSociete = html.indexOf("Ce que fait la société");
    expect(iSociete).toBeGreaterThan(-1);
    for (const attendu of ["Menuiserie industrielle", "42", "Excel", "Débutant"]) {
      expect(html).toContain(attendu);
    }
    expect(iSociete).toBeLessThan(html.indexOf("Projets"));
  });

  it("contre-témoin : sans fait, le message « Rien de validé » s'affiche", () => {
    const html = renderToStaticMarkup(
      <OngletSynthese
        consolidation={consoliderFaits([], [], MAINTENANT)}
        projets={[]}
        ficheHref="/fr/p/qualiopi/clients/x"
      />,
    );
    expect(html).toContain("Rien de validé pour l&#x27;instant sur l&#x27;entreprise.");
  });

  it("un effectif à trancher porte un bouton « Garder » par valeur (V1-02)", () => {
    const faits = [
      fait({ type: "effectif", quantite: 42, constateLe: new Date("2026-09-01") }),
      fait({ type: "effectif", quantite: 50 }),
    ];
    const html = renderToStaticMarkup(
      <OngletSynthese
        consolidation={consoliderFaits(faits, [], MAINTENANT)}
        projets={[]}
        ficheHref="/fr/p/qualiopi/clients/x"
      />,
    );
    expect(html.match(/name="faitId"/g)).toHaveLength(2);
    expect(html).toContain("Garder 42");
    expect(html).toContain("Garder 50");
  });
});
