import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/actions/qualiopi/clients", () => ({ changerTypeClientFormAction: vi.fn() }));

import { ChangerTypeClient } from "../ChangerTypeClient";

const base = {
  clientId: "11111111-1111-4111-8111-111111111111",
  raisonSociale: "Anne Dupont",
  contactNom: "DUPONT Anne",
  contactFacturationNom: "DUPONT Anne",
  blocage: null,
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
