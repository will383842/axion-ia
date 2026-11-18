import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/actions/qualiopi/clients", () => ({ changerTypeClientFormAction: vi.fn() }));

import { apercuPourCrm } from "@/server/crm-sync/apercu-dossier";
import type { ContactPourCrm, EntreeInstantaneCrm } from "@/server/crm-sync/instantane-dossier";

import { ChangerTypeClient } from "../ChangerTypeClient";

const contactCrm = (id: string, o: Partial<ContactPourCrm> = {}): ContactPourCrm => ({
  id,
  nom: "Anne Dupont",
  fonction: "Gérante",
  telephone: "0472000000",
  email: "anne@dupont-exemple.fr",
  emailType: "pro",
  origine: "manuel",
  emailHash: "b".repeat(64),
  oppose: false,
  parti: false,
  ...o,
});

const entreeCrm = (contacts: ContactPourCrm[], o: Partial<EntreeInstantaneCrm> = {}) =>
  ({
    clientId: "11111111-1111-4111-8111-111111111111",
    numero: "AXI-CLI-2",
    type: "particulier",
    raisonSociale: "Anne Dupont",
    siren: null,
    adresseRue: "5 rue Neuve",
    adresseCodePostal: "69003",
    adresseVille: "Lyon",
    telephone: null,
    effectif: null,
    factureEmise: false,
    factureHorsConsole: false,
    questionnaire: null,
    contacts,
    ...o,
  }) satisfies EntreeInstantaneCrm;

const base = {
  clientId: "11111111-1111-4111-8111-111111111111",
  contactNom: "DUPONT Anne",
  blocage: null,
  apercu: apercuPourCrm(entreeCrm([contactCrm("c1")])),
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

  it("affiche, au-dessus du bouton, ce qui partira au CRM Pro (rue, ville, contact, e-mail pro)", () => {
    const html = renderToStaticMarkup(<ChangerTypeClient {...base} type="particulier" />);
    expect(html).toContain("Partira au CRM Pro");
    expect(html).toContain("5 rue Neuve");
    expect(html).toContain("69003");
    expect(html).toContain("Lyon");
    expect(html).toContain("Anne Dupont");
    expect(html).toContain("Gérante");
    expect(html).toContain("0472000000");
    expect(html).toContain("anne@dupont-exemple.fr");
    expect(html).toContain("l&#x27;état du dossier");
    expect(html.indexOf("Partira au CRM Pro")).toBeLessThan(
      html.indexOf("Confirmer le passage en entreprise"),
    );
  });

  it("n'annonce pas un contact opposé, parti ou mention, ni un e-mail grand public", () => {
    const apercu = apercuPourCrm(
      entreeCrm([
        contactCrm("c1"),
        contactCrm("c2", { nom: "Paul Opposé", oppose: true, email: "paul@exemple.fr" }),
        contactCrm("c3", { nom: "Julie Partie", parti: true }),
        contactCrm("c4", { nom: "Marc Cité", origine: "mention" }),
        contactCrm("c5", { nom: "Lise Perso", email: "lise@gmail.com", emailType: "perso" }),
      ]),
    );
    const html = renderToStaticMarkup(
      <ChangerTypeClient {...base} type="particulier" apercu={apercu} />,
    );
    expect(html).toContain("Anne Dupont");
    expect(html).toContain("Lise Perso");
    expect(html).not.toContain("Paul Opposé");
    expect(html).not.toContain("paul@exemple.fr");
    expect(html).not.toContain("Julie Partie");
    expect(html).not.toContain("Marc Cité");
    expect(html).not.toContain("lise@gmail.com");
  });

  it("annonce l'état du dossier (étape, questionnaire, échanges)", () => {
    const apercu = apercuPourCrm(
      entreeCrm([], {
        questionnaire: {
          envoyeLe: new Date("2026-11-02T10:00:00Z"),
          recuLe: null,
          nbReponsesEquipe: 0,
        },
        fiche: { etape: "prospect", nbEmailsConsole: 3, nbNotesConsole: 1 },
      }),
    );
    const html = renderToStaticMarkup(
      <ChangerTypeClient {...base} type="particulier" apercu={apercu} />,
    );
    expect(html).toContain("étape : prospect");
    expect(html).toContain("questionnaire envoyé le 2026-11-02");
    expect(html).toContain("4 échanges");
  });

  it("sans adresse ni contact : le dit, sans inventer de valeur", () => {
    const apercu = apercuPourCrm(
      entreeCrm([], { adresseRue: null, adresseCodePostal: null, adresseVille: null }),
    );
    const html = renderToStaticMarkup(
      <ChangerTypeClient {...base} type="particulier" apercu={apercu} />,
    );
    expect(html).toContain("Partira au CRM Pro");
    expect(html).toContain("aucune adresse renseignée");
    expect(html).toContain("aucun contact");
  });

  it("aperçu illisible : le dit, sans rien annoncer", () => {
    const html = renderToStaticMarkup(
      <ChangerTypeClient {...base} type="particulier" apercu={null} />,
    );
    expect(html).toContain("Le détail de l&#x27;envoi au CRM Pro n&#x27;a pas pu être lu");
    expect(html).not.toContain("Partira au CRM Pro");
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
