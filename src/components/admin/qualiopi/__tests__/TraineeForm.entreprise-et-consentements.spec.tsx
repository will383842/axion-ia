/**
 * 🔴 F1 + F2 — ce que l'ÉCRAN de création d'un stagiaire doit montrer.
 *
 * Les deux défauts constatés en production le 2026-09-04, sur le même
 * formulaire :
 *
 * **F1** — « Entreprise » était un `<input>` LIBRE, donc une seconde saisie du
 * fait déjà porté par la fiche client. Rien ne reliait les deux, rien ne les
 * rapprochait jamais, et la convention portait ensuite l'écart.
 *
 * **F2** — les deux cases de consentement étaient MUETTES : décochées par
 * défaut, même typographie, l'une sous l'autre, pas un mot sur ce qu'elles
 * emportent. On coche sans savoir ce qu'on déclenche — sur une donnée qui
 * engage juridiquement.
 *
 * ⚠️ Pourquoi ce test monte le composant malgré la Server Action : `vi.mock`
 * remplace `@/server/actions/qualiopi/trainees` AVANT le chargement, donc
 * `next-auth` n'est jamais tiré. C'est le patron déjà employé par
 * `SessionForm.prerequis.spec.tsx`. Sans ce mock, le fichier échouerait au
 * CHARGEMENT en annonçant « no tests » — ce qui se lit « rien à signaler ».
 */

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TraineeForm } from "../TraineeForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/server/actions/qualiopi/trainees", () => ({
  createTraineeAction: vi.fn(),
  updateTraineeAction: vi.fn(),
}));

const CLIENTS = [
  { id: "c-1", numero: "AXI-CLI-001", raisonSociale: "SCI Invest Sun" },
  { id: "c-2", numero: "AXI-CLI-002", raisonSociale: "ACME" },
];

describe("F1 — l'entreprise se CHOISIT parmi les clients", () => {
  it("rend un sélecteur, et non un champ de texte libre", () => {
    render(
      <TraineeForm mode="create" baseHref="/fr/admin-x/qualiopi/stagiaires" clients={CLIENTS} />,
    );

    const champ = screen.getByLabelText("Entreprise");
    // Le cœur du correctif : l'élément change de NATURE. Un `<input>` ici,
    // c'est le défaut revenu.
    expect(champ.tagName).toBe("SELECT");
  });

  it("propose chaque client existant, désigné comme sur sa fiche", () => {
    render(
      <TraineeForm mode="create" baseHref="/fr/admin-x/qualiopi/stagiaires" clients={CLIENTS} />,
    );

    expect(screen.getByRole("option", { name: "AXI-CLI-001 — SCI Invest Sun" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "AXI-CLI-002 — ACME" })).toBeTruthy();
  });

  it("garde une porte de sortie pour un employeur hors registre", () => {
    // Sans elle, on créerait un faux client juste pour pouvoir enregistrer un
    // stagiaire — c'est-à-dire qu'on salirait le registre pour contourner
    // l'écran censé le protéger.
    render(
      <TraineeForm mode="create" baseHref="/fr/admin-x/qualiopi/stagiaires" clients={CLIENTS} />,
    );

    expect(
      screen.getByRole("option", { name: /autre entreprise \(hors clients enregistrés\)/i }),
    ).toBeTruthy();
  });

  it("rouvre une fiche existante SUR son client, même écrite en variante", () => {
    render(
      <TraineeForm
        mode="edit"
        traineeId="t-1"
        baseHref="/fr/admin-x/qualiopi/stagiaires"
        clients={CLIENTS}
        initial={{
          nom: "Blanc",
          prenom: "Simone",
          email: "simone@example.test",
          telephone: null,
          // La variante réellement rencontrée en base.
          entreprise: "sci invest sun",
          fonction: null,
          situationHandicap: false,
          consentementFormation: false,
          consentementEmail: false,
          handicapDetailsPresent: false,
        }}
      />,
    );

    // C'est CE point qui fait converger les variantes déjà écrites : au
    // prochain enregistrement, la fiche portera la forme canonique.
    expect((screen.getByLabelText("Entreprise") as HTMLSelectElement).value).toBe("SCI Invest Sun");
  });
});

describe("F2 — chaque consentement DIT ce qu'il emporte", () => {
  it("dit ce qui se produit si le consentement formation est coché, et sinon", () => {
    render(
      <TraineeForm mode="create" baseHref="/fr/admin-x/qualiopi/stagiaires" clients={CLIENTS} />,
    );

    const bloc = screen
      .getByText(/Consentement traitement des données \(formation\)/i)
      .closest("div");
    expect(bloc).not.toBeNull();
    const texte = (bloc as HTMLElement).textContent ?? "";
    expect(texte).toMatch(/Cochée/);
    expect(texte).toMatch(/Décochée/);
    // La conséquence exacte, pas une paraphrase : c'est le registre des
    // stagiaires qui affiche « Donné » / « Non recueilli ».
    expect(texte).toMatch(/Donné/);
    expect(texte).toMatch(/Non recueilli/);
  });

  it("dit que la case « communications email » ne filtre encore AUCUN envoi", () => {
    // 🔑 La vérité mesurée le 2026-09-05 : `consentementEmail` n'est lu par
    // aucun chemin d'envoi. Écrire « cocher autorise les envois » serait une
    // promesse que le produit ne tient pas — et c'est le genre de phrase qu'on
    // oppose ensuite à une réclamation.
    render(
      <TraineeForm mode="create" baseHref="/fr/admin-x/qualiopi/stagiaires" clients={CLIENTS} />,
    );

    const bloc = screen
      .getByText(/Consentement communications email/i)
      .closest("div")?.parentElement;
    expect(bloc).not.toBeNull();
    expect((bloc as HTMLElement).textContent ?? "").toMatch(
      /aucun envoi ne consulte cette case avant de partir/i,
    );
  });
});
