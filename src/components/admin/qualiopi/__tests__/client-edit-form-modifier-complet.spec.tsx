/**
 * Lot A2 — rendu du formulaire « Modifier la fiche » : libellés de la maquette,
 * cartes grises, un seul bouton « Enregistrer ».
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/actions/qualiopi/clients", () => ({ updateClientAction: vi.fn() }));

import { ClientEditForm, type ClientEditValues } from "../ClientEditForm";

const INITIAL: ClientEditValues = {
  raisonSociale: "Acme",
  siret: "",
  tvaIntracom: "",
  nafCode: "",
  secteur: "",
  source: "",
  adresseRue: "",
  adresseCodePostal: "",
  adresseVille: "",
  contactNom: "",
  contactEmail: "",
  contactTelephone: "",
  contactFonction: "",
  delaiPaiementJours: "",
  tauxAcomptePct: "",
  modeFacturation: "",
};

const LECTURE = {
  siren: "123456789",
  effectif: 12,
  estPublic: false,
  adresseHistorique: null,
  brancheHref: "/fr/x/qualiopi/clients/1?onglet=resume",
};

function rendre(estParticulier = false): string {
  return renderToStaticMarkup(
    <ClientEditForm
      clientId="1"
      estParticulier={estParticulier}
      initial={INITIAL}
      lecture={LECTURE}
      retourHref="/fr/x/qualiopi/clients"
    />,
  );
}

describe("ClientEditForm — formulaire complet (lot A2)", () => {
  it("montre tous les libellés de la maquette", () => {
    const html = rendre();
    for (const libelle of [
      "Entreprise",
      "SIREN",
      "SIRET",
      "Numéro de TVA",
      "Code NAF",
      "Secteur d&#x27;activité",
      "Nombre de salariés",
      "Secteur public",
      "Adresse",
      "Numéro et rue",
      "Code postal",
      "Ville",
      "Comment ce client est arrivé",
      "Contact principal",
      "Nom et prénom",
      "Fonction",
      "E-mail",
      "Téléphone",
      "Facturation",
      "Délai de paiement",
      "Acompte (%)",
      "Mode de facturation",
      "Acompte puis solde",
      "Solde unique",
      "Modifier dans Branche et OPCO",
    ]) {
      expect(html, libelle).toContain(libelle);
    }
  });

  it("n'a qu'un bouton d'envoi « Enregistrer » et des cartes grises", () => {
    const html = rendre();
    expect(html.match(/type="submit"/g)).toHaveLength(1);
    expect(html).toContain("Enregistrer");
    expect(html).toContain('data-teinte="gris"');
    expect(html).not.toContain("dark:");
  });

  it("masque les champs entreprise pour un particulier", () => {
    const html = rendre(true);
    expect(html).not.toContain("Numéro de TVA");
    expect(html).not.toContain("SIRET");
    expect(html).toContain("Numéro et rue");
  });
});
