import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Frise } from "../Frise";

const html = renderToStaticMarkup(
  <Frise
    etiquette="Parcours du client"
    etapes={[
      { libelle: "Prospect", etat: "fait" },
      { libelle: "Devis", etat: "courant" },
      { libelle: "Facture", etat: "a_venir" },
      { libelle: "Perdu", etat: "hors_parcours" },
    ]}
  />,
);

describe("Frise", () => {
  it("est une liste ordonnée étiquetée", () => {
    expect(html).toMatch(/^<ol aria-label="Parcours du client"/);
  });
  it("marque l'étape courante et dit « (fait) » aux lecteurs d'écran", () => {
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    expect(html).toContain('<span class="sr-only">(fait)</span>');
    expect(html.match(/\(fait\)/g)).toHaveLength(1);
  });
});
