// Accessibilité du parcours (amendement F / revue B6) : focus, pas d'avance automatique,
// plafond et choix exclusifs annoncés, équivalent texte du résultat.

import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScoreFlow } from "../ScoreFlow";
import { construireQuestions } from "@/content/score-ia-pme/questions";
import { NB_QUESTIONS } from "@/content/score-ia-pme/textes";
import { parcourirJusquAuResultat, repondreEtSuivre, titreQuestion } from "./aide-parcours";

vi.mock("@/server/actions/score-ia-pme/ajouter-a-l-observatoire", () => ({
  ajouterALObservatoire: vi.fn(),
}));
vi.mock("@/server/actions/score-ia-pme/retirer", () => ({ retirerReponsesScore: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const props = () => ({
  questions: construireQuestions(),
  libellesTaille: {},
  snapshot: null,
  encadre: ["x"],
  hrefConfidentialite: "/x",
  prixJournee: "",
});

describe("parcours accessible", () => {
  it("le focus va sur le titre de la nouvelle question après « Suivant »", async () => {
    const user = userEvent.setup();
    render(<ScoreFlow {...props()} />);
    await user.click(screen.getByRole("button", { name: "Commencer" }));
    expect(document.activeElement).toBe(titreQuestion());
    const avant = titreQuestion().textContent;
    await repondreEtSuivre(user);
    expect(titreQuestion().textContent).not.toBe(avant);
    expect(document.activeElement).toBe(titreQuestion());
    // Le titre est focalisable par programme et dans la `legend`.
    expect(titreQuestion().getAttribute("tabindex")).toBe("-1");
    expect(titreQuestion().closest("legend")).not.toBeNull();
  });

  it("annonce « Question n sur 15 » dans une zone aria-live polie", async () => {
    const user = userEvent.setup();
    render(<ScoreFlow {...props()} />);
    await user.click(screen.getByRole("button", { name: "Commencer" }));
    const zone = document.querySelector('[aria-live="polite"].sr-only') as HTMLElement;
    expect(zone.textContent).toBe(`Question 1 sur ${NB_QUESTIONS}`);
  });

  it("aucune avance automatique au choix d'une option", async () => {
    const user = userEvent.setup();
    render(<ScoreFlow {...props()} />);
    await user.click(screen.getByRole("button", { name: "Commencer" }));
    const premierTitre = titreQuestion().textContent;
    await user.click(within(screen.getByRole("group")).getAllByRole("radio")[0] as HTMLElement);
    expect(titreQuestion().textContent).toBe(premierTitre);
  });

  it("« Suivant » reste actif ; sans réponse, une alerte liée au groupe s'affiche", async () => {
    const user = userEvent.setup();
    render(<ScoreFlow {...props()} />);
    await user.click(screen.getByRole("button", { name: "Commencer" }));
    const suivant = screen.getByRole("button", { name: "Suivant" }) as HTMLButtonElement;
    expect(suivant.disabled).toBe(false);
    await user.click(suivant);
    const alerte = screen.getByRole("alert");
    expect(alerte.textContent).toBe("Choisissez une réponse pour continuer.");
    expect(screen.getByRole("group").getAttribute("aria-describedby")).toContain(alerte.id);
  });

  it("plafond de 3 freins et choix exclusif annoncés dans la zone aria-live", async () => {
    const user = userEvent.setup();
    render(<ScoreFlow {...props()} />);
    await user.click(screen.getByRole("button", { name: "Commencer" }));
    // Avance jusqu'à la question des freins (9ᵉ écran).
    for (let i = 0; i < 8; i += 1) await repondreEtSuivre(user);
    const zone = () =>
      (document.querySelector('[aria-live="polite"].sr-only') as HTMLElement).textContent;
    const cases = () =>
      within(screen.getByRole("group")).getAllByRole("checkbox") as HTMLInputElement[];
    const parLibelle = (t: RegExp) =>
      cases().find((c) => t.test(c.closest("label")?.textContent ?? ""))!;

    await user.click(parLibelle(/Le coût/));
    await user.click(parLibelle(/Le manque de temps/));
    await user.click(parLibelle(/pas une priorité/));
    await user.click(parLibelle(/réticences/));
    expect(zone()).toBe("3 réponses au plus : décochez-en une pour en choisir une autre.");
    expect(cases().filter((c) => c.checked)).toHaveLength(3);

    await user.click(parLibelle(/Aucun frein particulier/));
    expect(zone()).toBe("Les autres choix ont été retirés.");
    expect(cases().filter((c) => c.checked)).toHaveLength(1);
  });

  it("le résultat a un équivalent texte du score et de chaque critère, sans dépendre de la couleur", async () => {
    const user = userEvent.setup();
    render(<ScoreFlow {...props()} />);
    await parcourirJusquAuResultat(user, NB_QUESTIONS);
    const titre = screen.getByRole("heading", { name: "Votre score" });
    expect(document.activeElement).toBe(titre);
    expect(screen.getByText(/sur 100/)).toBeTruthy();
    expect(screen.getAllByText(/Niveau/).length).toBeGreaterThan(0);
    // Un point de texte par critère : « Maturité … : n points sur p ».
    const lignes = screen.getAllByText(/points sur \d+/);
    expect(lignes).toHaveLength(7 - 0); // 7 critères (budget présent : « Rien » n'est pas « Je ne sais pas »)
    // Les barres sont décoratives (aria-hidden) : l'information est dans le texte.
    expect(document.querySelectorAll('[aria-hidden="true"] .bg-terracotta').length).toBeGreaterThan(
      0,
    );
  });

  it("« Modifier mes réponses » revient à la première question, réponses conservées", async () => {
    const user = userEvent.setup();
    render(<ScoreFlow {...props()} />);
    await parcourirJusquAuResultat(user, NB_QUESTIONS);
    await user.click(screen.getByRole("button", { name: "Modifier mes réponses" }));
    const premiere = within(screen.getByRole("group")).getAllByRole("radio")[0] as HTMLInputElement;
    expect(premiere.checked).toBe(true);
  });
});

describe("accessibilité : retouches de l'audit PR-3", () => {
  it("après le résultat, l'id « observatoire » n'existe qu'une fois (RGAA 8.2)", async () => {
    const user = userEvent.setup();
    render(
      <>
        <section id="observatoire" />
        <ScoreFlow {...props()} />
      </>,
    );
    await parcourirJusquAuResultat(user, NB_QUESTIONS);
    expect(document.querySelectorAll("#observatoire").length).toBe(1);
    expect(document.querySelectorAll("#observatoire-ajout").length).toBe(1);
  });

  it("« Autre secteur » est séparé du dernier groupe (espacement avant l'option)", async () => {
    const user = userEvent.setup();
    render(<ScoreFlow {...props()} />);
    await user.click(screen.getByRole("button", { name: "Commencer" }));
    let autre: HTMLElement | null = null;
    for (let i = 0; i < NB_QUESTIONS && !autre; i += 1) {
      autre = screen.getByRole("group").querySelector<HTMLElement>('input[value="autre"]');
      if (!autre) await repondreEtSuivre(user);
    }
    expect(autre).not.toBeNull();
    const etiquette = (autre as HTMLElement).closest("label") as HTMLElement;
    expect(etiquette.className).toMatch(/\bmt-3\b/);
  });
});
