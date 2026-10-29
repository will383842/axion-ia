/**
 * Lot A2 — rendu du formulaire « Modifier la fiche » : libellés de la maquette,
 * cartes grises, un seul bouton « Enregistrer ».
 */

import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/actions/qualiopi/clients", () => ({ updateClientAction: vi.fn() }));

import { updateClientAction } from "@/server/actions/qualiopi/clients";

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

const actionSimulee = vi.mocked(updateClientAction);

beforeEach(() => {
  actionSimulee.mockReset();
  actionSimulee.mockResolvedValue({ data: {} } as never);
});
afterEach(cleanup);

function monter(initial: Partial<ClientEditValues>, lecture = LECTURE) {
  render(
    <ClientEditForm
      clientId="1"
      estParticulier={false}
      initial={{ ...INITIAL, ...initial }}
      lecture={lecture}
      retourHref="/fr/x/qualiopi/clients"
    />,
  );
}

async function enregistrer(): Promise<Record<string, unknown>> {
  fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));
  await waitFor(() => expect(actionSimulee).toHaveBeenCalledTimes(1));
  return actionSimulee.mock.calls[0]![0] as Record<string, unknown>;
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

  it("ne change que la ville, rue vide : la charge n'a PAS de clé `adresse` (la rue d'origine est gardée)", async () => {
    monter({ adresseVille: "Lyon" }, { ...LECTURE, adresseHistorique: "12 rue des Lilas" });
    fireEvent.change(screen.getByLabelText("Ville"), { target: { value: "Villeurbanne" } });
    const charge = await enregistrer();
    expect(charge).toEqual({ id: "1", adresseVille: "Villeurbanne" });
    expect(charge).not.toHaveProperty("adresse");
  });

  it("rue saisie : l'ancienne adresse libre est recomposée avec la rue", async () => {
    monter({ adresseVille: "Lyon", adresseCodePostal: "69003" });
    fireEvent.change(screen.getByLabelText("Numéro et rue"), {
      target: { value: "12 rue des Lilas" },
    });
    const charge = await enregistrer();
    expect(charge).toMatchObject({
      adresseRue: "12 rue des Lilas",
      adresse: "12 rue des Lilas, 69003 Lyon",
    });
  });

  it('trois champs d\'adresse vidés : null partout, jamais `adresse: ""`', async () => {
    monter({ adresseRue: "1 rue A", adresseCodePostal: "69003", adresseVille: "Lyon" });
    fireEvent.change(screen.getByLabelText("Numéro et rue"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Code postal"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Ville"), { target: { value: "" } });
    const charge = await enregistrer();
    expect(charge).toEqual({
      id: "1",
      adresseRue: null,
      adresseCodePostal: null,
      adresseVille: null,
    });
  });

  it('un seul champ modifié : seul lui part ; un champ vidé part en null, pas en ""', async () => {
    monter({ secteur: "BTP", contactEmail: "a@b.fr", contactFonction: "Gérant" });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "" } });
    const charge = await enregistrer();
    expect(charge).toEqual({ id: "1", contactEmail: null });
  });

  it("modifier le délai n'envoie que le délai, en nombre", async () => {
    monter({ delaiPaiementJours: "30" });
    fireEvent.change(screen.getByLabelText(/Délai de paiement/), { target: { value: "45" } });
    expect(await enregistrer()).toEqual({ id: "1", delaiPaiementJours: 45 });
  });

  it("« Solde unique » : explique que l'acompte n'est pas appliqué", () => {
    monter({});
    expect(screen.queryByText(/l'acompte n'est pas appliqué/)).toBeNull();
    fireEvent.change(screen.getByLabelText("Mode de facturation"), {
      target: { value: "solde_unique" },
    });
    expect(screen.getByText(/l'acompte n'est pas appliqué/)).toBeTruthy();
  });
});
