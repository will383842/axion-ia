import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/actions/qualiopi/clients", () => ({ changerTypeClientFormAction: vi.fn() }));

import { ChangerTypeClient } from "../ChangerTypeClient";

const base = {
  clientId: "11111111-1111-4111-8111-111111111111",
  raisonSociale: "Anne Dupont",
  contactNom: "DUPONT Anne",
  blocage: null,
  adresseCodePostal: "69003",
  adresseVille: "Lyon",
  contacts: [{ nom: "DUPONT Anne", fonction: "Gérante", telephone: "0472000000" }],
};

describe("ChangerTypeClient", () => {
  it("particulier : formulaire de passage en entreprise", () => {
    const html = renderToStaticMarkup(<ChangerTypeClient {...base} type="particulier" />);
    expect(html).toContain("Type de fiche");
    expect(html).toContain("Passer en entreprise");
    expect(html).toContain("Nom de l&#x27;entreprise");
    expect(html).toContain("Le contact garde son nom : DUPONT Anne.");
    expect(html).toContain("Confirmer le passage en entreprise");
    expect(html).toContain("ne la retire pas du CRM Pro");
  });

  it("affiche, au-dessus du bouton, ce qui partira au CRM Pro (valeurs de la fiche)", () => {
    const html = renderToStaticMarkup(<ChangerTypeClient {...base} type="particulier" />);
    expect(html).toContain("Partira au CRM Pro");
    expect(html).toContain("le nom de l&#x27;entreprise");
    expect(html).toContain("69003 Lyon");
    expect(html).toContain("DUPONT Anne");
    expect(html).toContain("Gérante");
    expect(html).toContain("0472000000");
    expect(html.indexOf("Partira au CRM Pro")).toBeLessThan(
      html.indexOf("Confirmer le passage en entreprise"),
    );
  });

  it("sans adresse ni contact : le dit, sans inventer de valeur", () => {
    const html = renderToStaticMarkup(
      <ChangerTypeClient
        {...base}
        type="particulier"
        adresseCodePostal={null}
        adresseVille={null}
        contacts={[]}
      />,
    );
    expect(html).toContain("Partira au CRM Pro");
    expect(html).toContain("aucune adresse renseignée");
    expect(html).toContain("aucun contact");
  });

  it("propose un motif facultatif, transmis sous le nom « motif »", () => {
    for (const type of ["particulier", "entreprise"] as const) {
      const html = renderToStaticMarkup(<ChangerTypeClient {...base} type={type} />);
      expect(html).toContain("Motif (facultatif)");
      expect(html).toContain('name="motif"');
      expect(html).toContain('maxLength="300"');
    }
  });

  it("entreprise : repasser en particulier, champ prérempli", () => {
    const html = renderToStaticMarkup(<ChangerTypeClient {...base} type="entreprise" />);
    expect(html).toContain("Repasser en particulier");
    expect(html).toContain("Prénom et nom du client");
    expect(html).toContain('value="DUPONT Anne"');
  });

  it("des pièces : bloc grisé avec la raison, aucun formulaire", () => {
    const html = renderToStaticMarkup(
      <ChangerTypeClient
        {...base}
        type="particulier"
        blocage="Le type ne peut plus changer : la fiche porte 2 devis et 1 facture."
      />,
    );
    expect(html).toContain("la fiche porte 2 devis et 1 facture");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("Confirmer le passage");
  });
});
