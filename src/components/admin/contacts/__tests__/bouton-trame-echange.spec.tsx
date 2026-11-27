import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BoutonTrameEchange } from "../BoutonTrameEchange";

describe("Bouton « Trame d'échange »", () => {
  it("apparaît pour un type d'événement qui contient « apporteur »", () => {
    const html = renderToStaticMarkup(
      <BoutonTrameEchange
        eventTypeName="Échange apporteur d'affaires (15 min)"
        contactName="Camille Durand"
      />,
    );
    expect(html).toContain("Trame d&#x27;échange");
    expect(html).toContain('target="_blank"');
    expect(html).toContain("imprimes/trame-apporteur?prenom=Camille");
  });

  it("apparaît aussi quand le type classé est « apporteur »", () => {
    const html = renderToStaticMarkup(
      <BoutonTrameEchange eventTypeName="Échange" typeRendezVous="apporteur" />,
    );
    expect(html).toContain("imprimes/trame-apporteur");
    expect(html).not.toContain("prenom=");
  });

  it("n'apparaît pas pour un autre type d'événement", () => {
    expect(
      renderToStaticMarkup(
        <BoutonTrameEchange
          eventTypeName="Appel de découverte (30 min)"
          typeRendezVous="diagnostic"
        />,
      ),
    ).toBe("");
    expect(renderToStaticMarkup(<BoutonTrameEchange eventTypeName={null} />)).toBe("");
  });
});
