/**
 * LA CONFIRMATION EXPLICITE AVANT UN ENVOI GROUPÉ.
 *
 * ── Le défaut que ce lot ferme ────────────────────────────────────────────
 * Rien à l'écran ne disait, AVANT le clic, combien de personnes allaient
 * recevoir le message. Un recruteur qui coche 93 lignes sans le vouloir et
 * clique « Envoyer à la sélection » n'aurait appris le nombre qu'APRÈS
 * l'envoi — trop tard pour un e-mail, qui ne se rappelle pas.
 *
 * ── Ce que ce test prouve ─────────────────────────────────────────────────
 *   1. le compte affiché suit RÉELLEMENT les cases cochées du formulaire —
 *      y compris celles qui vivent HORS du `<details>`, comme dans l'écran
 *      réel (la table est un frère, pas un enfant, de ce composant) ;
 *   2. le bouton d'envoi reste désactivé tant que la case de confirmation
 *      n'est pas cochée ;
 *   3. toute retouche — sélection OU texte — invalide une confirmation
 *      déjà donnée : elle portait sur un autre message, à un autre effectif.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";

vi.mock("@/features/admin-job-applications/actions-reponse-en-masse", () => ({
  repondreEnMasseAction: vi.fn(),
}));

import { ComposeurEnMasse } from "../ComposeurEnMasse";

afterEach(cleanup);

const MODELES = [
  { value: "libre", label: "Message libre", quand: "", objet: "", corps: "" },
  { value: "refus", label: "Refus", quand: "…", objet: "Objet refus", corps: "Corps refus" },
];

function rendre(): {
  cases: HTMLInputElement[];
  corps: HTMLTextAreaElement;
  objet: HTMLInputElement;
} {
  render(
    <form>
      <input type="checkbox" name="ids" value="a" aria-label="Sélectionner A" />
      <input type="checkbox" name="ids" value="b" aria-label="Sélectionner B" />
      <ComposeurEnMasse modeles={MODELES} plafond={50} />
    </form>,
  );
  // Le composeur est un `<details>` replié : l'ouvrir pour atteindre ses champs.
  fireEvent.click(screen.getByText("Écrire à la sélection"));
  return {
    cases: screen.getAllByRole("checkbox", { name: /Sélectionner/ }) as HTMLInputElement[],
    corps: screen.getByLabelText("Message") as HTMLTextAreaElement,
    objet: screen.getByLabelText("Objet") as HTMLInputElement,
  };
}

function boutonEnvoyer(): HTMLElement {
  return screen.getByRole("button", { name: /Envoyer à la sélection|Envoi…/ });
}

describe("ComposeurEnMasse — combien de destinataires, avant d'envoyer", () => {
  it("annonce ZÉRO destinataire et désactive l'envoi tant que rien n'est coché", () => {
    rendre();
    expect(screen.getByRole("status")).toHaveTextContent("Aucune candidature cochée");
    expect(boutonEnvoyer()).toBeDisabled();
  });

  it("🔴 SUIT LES CASES DU FORMULAIRE, même cochées HORS du `<details>`", () => {
    const { cases } = rendre();
    fireEvent.click(cases[0]!);
    expect(screen.getByRole("status")).toHaveTextContent("1 destinataire");
    fireEvent.click(cases[1]!);
    expect(screen.getByRole("status")).toHaveTextContent("2 destinataires");
  });

  it("le bouton reste désactivé sans la confirmation EXPLICITE, même sélection + texte remplis", () => {
    const { cases, objet, corps } = rendre();
    fireEvent.click(cases[0]!);
    fireEvent.change(objet, { target: { value: "Un objet" } });
    fireEvent.change(corps, { target: { value: "Un message" } });
    expect(boutonEnvoyer()).toBeDisabled();
  });

  it("cocher la confirmation active le bouton — avec sélection et texte", () => {
    const { cases, objet, corps } = rendre();
    fireEvent.click(cases[0]!);
    fireEvent.change(objet, { target: { value: "Un objet" } });
    fireEvent.change(corps, { target: { value: "Un message" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Je confirme l.envoi/ }));
    expect(boutonEnvoyer()).toBeEnabled();
  });

  it("🔴 CHANGER LA SÉLECTION APRÈS COUP invalide une confirmation déjà donnée", () => {
    const { cases, objet, corps } = rendre();
    fireEvent.click(cases[0]!);
    fireEvent.change(objet, { target: { value: "Un objet" } });
    fireEvent.change(corps, { target: { value: "Un message" } });
    const confirmer = screen.getByRole("checkbox", { name: /Je confirme l.envoi/ });
    fireEvent.click(confirmer);
    expect(boutonEnvoyer()).toBeEnabled();

    // On coche UNE candidature de plus — l'effectif annoncé change.
    fireEvent.click(cases[1]!);
    expect(screen.getByRole("status")).toHaveTextContent("2 destinataires");
    expect(boutonEnvoyer()).toBeDisabled();
    expect(confirmer).not.toBeChecked();
  });

  it("🔴 RETOUCHER LE TEXTE APRÈS COUP invalide aussi une confirmation déjà donnée", () => {
    const { cases, objet, corps } = rendre();
    fireEvent.click(cases[0]!);
    fireEvent.change(objet, { target: { value: "Un objet" } });
    fireEvent.change(corps, { target: { value: "Un message" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Je confirme l.envoi/ }));
    expect(boutonEnvoyer()).toBeEnabled();

    fireEvent.change(corps, { target: { value: "Un message modifié" } });
    expect(boutonEnvoyer()).toBeDisabled();
  });
});
