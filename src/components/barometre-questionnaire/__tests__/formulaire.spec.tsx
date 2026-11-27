// Formulaire du questionnaire du Baromètre 2027 : rien ne part sans la case, Turnstile n'est monté
// qu'au cochage, les filtres vivent dans le DOM, le code de retrait s'affiche après un succès.

import * as React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormulaireBarometre, type QuestionsProp } from "../FormulaireBarometre";
import {
  AIDES,
  FORMULAIRE,
  LIBELLES_QUESTIONS,
  Q1,
  Q2,
  Q3,
  Q4,
  Q4_NON,
  Q5,
  Q6,
  Q7,
  Q8,
  Q9,
  Q10,
  Q10_MAX,
  Q11,
  Q12,
  Q12_AVEC_SALARIES,
  Q13,
  Q14,
  SECTIONS,
  TEXTE_CONSENTEMENT,
} from "@/content/barometre-questionnaire/textes";

const envoyer = vi.fn(async (_input: unknown) => ({ ok: true as const }));
vi.mock("@/server/actions/barometre-questionnaire/envoyer", () => ({
  envoyerQuestionnaire: (input: unknown) => envoyer(input),
}));

const props: QuestionsProp = {
  libelles: LIBELLES_QUESTIONS,
  sections: SECTIONS,
  aides: AIDES,
  options: {
    q1: Q1,
    q2: Q2,
    q3: Q3,
    q4: Q4,
    q5: Q5,
    q6: Q6,
    q7: Q7,
    q8: Q8,
    q9: Q9,
    q10: Q10,
    q11: Q11,
    q12: Q12,
    q13: Q13,
    q14: Q14,
  },
  q4Non: Q4_NON,
  q12AvecSalaries: Q12_AVEC_SALARIES,
  q10Max: Q10_MAX,
  texteConsentement: TEXTE_CONSENTEMENT,
  textes: { ...FORMULAIRE, formulaire: "Questionnaire" },
};

const question = (id: string) =>
  document.querySelector(`[data-question="${id}"]`) as HTMLElement | null;
const choisir = async (user: ReturnType<typeof userEvent.setup>, id: string, libelle: string) =>
  user.click(within(question(id)!).getByLabelText(libelle));

describe("FormulaireBarometre", () => {
  const fetchSpy = vi.fn();
  beforeEach(() => {
    envoyer.mockClear();
    fetchSpy.mockClear();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    document.getElementById("axion-turnstile-script")?.remove();
    window.sessionStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("envoi impossible sans la case : ni action, ni fetch, ni Turnstile", async () => {
    const user = userEvent.setup();
    render(<FormulaireBarometre q={props} />);
    await user.click(screen.getByRole("button", { name: FORMULAIRE.bouton }));
    expect(envoyer).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe(FORMULAIRE.caseManquante);
  });

  it("la case est décochée au départ ; Turnstile n'est pas monté avant le cochage", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
    const user = userEvent.setup();
    render(<FormulaireBarometre q={props} />);
    const caseConsent = screen.getByLabelText(TEXTE_CONSENTEMENT) as HTMLInputElement;
    expect(caseConsent.checked).toBe(false);
    expect(document.getElementById("axion-turnstile-script")).toBeNull();
    expect(document.querySelector(".turnstile-widget")).toBeNull();
    await user.click(caseConsent);
    await waitFor(() => expect(document.getElementById("axion-turnstile-script")).not.toBeNull());
  });

  it("case cochée mais réponses incomplètes : rien n'est envoyé", async () => {
    const user = userEvent.setup();
    render(<FormulaireBarometre q={props} />);
    await user.click(screen.getByLabelText(TEXTE_CONSENTEMENT));
    await user.click(screen.getByRole("button", { name: FORMULAIRE.bouton }));
    expect(envoyer).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe(FORMULAIRE.champsManquants);
  });

  it("filtres : q5 à q9 apparaissent seulement si q4 est « oui »", async () => {
    const user = userEvent.setup();
    render(<FormulaireBarometre q={props} />);
    for (const id of ["q5", "q6", "q7", "q8", "q9", "q14"]) expect(question(id), id).toBeNull();
    await choisir(user, "q4", "Oui, régulièrement");
    for (const id of ["q5", "q6", "q7", "q8", "q9"]) expect(question(id), id).not.toBeNull();
    await choisir(user, "q5", "Autre");
    await choisir(user, "q4", "Non, et je n'y pense pas");
    for (const id of ["q5", "q6", "q7", "q8", "q9"]) expect(question(id), id).toBeNull();
  });

  it("filtre : q14 apparaît seulement si q13 = Oui", async () => {
    const user = userEvent.setup();
    render(<FormulaireBarometre q={props} />);
    expect(question("q14")).toBeNull();
    await choisir(user, "q13", "Oui");
    expect(question("q14")).not.toBeNull();
    await choisir(user, "q13", "Non");
    expect(question("q14")).toBeNull();
  });

  it("filtre : sans salarié, q12 masque « des salariés » et « les deux »", async () => {
    const user = userEvent.setup();
    render(<FormulaireBarometre q={props} />);
    expect(within(question("q12")!).queryByLabelText("Oui, des salariés")).not.toBeNull();
    await choisir(user, "q1", "0");
    expect(within(question("q12")!).queryByLabelText("Oui, des salariés")).toBeNull();
    expect(within(question("q12")!).queryByLabelText("Oui, les deux")).toBeNull();
    expect(within(question("q12")!).queryByLabelText("Oui, moi")).not.toBeNull();
  });

  it("q10 : 3 choix au plus, « Aucun frein » exclusif et toujours en dernier", async () => {
    const user = userEvent.setup();
    render(<FormulaireBarometre q={props} />);
    const labels = () =>
      Array.from(question("q10")!.querySelectorAll("label")).map((l) => l.textContent);
    expect(labels().at(-1)).toBe("Aucun frein");
    for (const l of ["Manque de compétences", "Manque de temps", "Coût perçu"])
      await choisir(user, "q10", l);
    const quatrieme = within(question("q10")!).getByLabelText(
      "Confiance dans les résultats",
    ) as HTMLInputElement;
    expect(quatrieme.disabled).toBe(true);
    await choisir(user, "q10", "Aucun frein");
    const cochees = Array.from(question("q10")!.querySelectorAll("input:checked")).map(
      (i) => (i as HTMLInputElement).value,
    );
    expect(cochees).toEqual(["aucun-frein"]);
    expect(labels().at(-1)).toBe("Aucun frein");
  });

  it("succès : le code de retrait s'affiche une fois, seule l'empreinte est envoyée", async () => {
    const user = userEvent.setup();
    render(<FormulaireBarometre q={props} />);
    await choisir(user, "q1", "1 à 4");
    await choisir(user, "q2", "Commerce (détail et gros)");
    await user.selectOptions(screen.getByLabelText(/Dans quelle région/), "outre-mer");
    await choisir(user, "q4", "Non, et je n'y pense pas");
    await choisir(user, "q10", "Aucun frein");
    await choisir(user, "q11", "Non");
    await choisir(user, "q12", "Non");
    await choisir(user, "q13", "Non");
    await user.click(screen.getByLabelText(TEXTE_CONSENTEMENT));
    await user.click(screen.getByRole("button", { name: FORMULAIRE.bouton }));

    await waitFor(() => expect(envoyer).toHaveBeenCalledTimes(1));
    const envoi = envoyer.mock.calls[0]![0] as Record<string, unknown>;
    expect(envoi["codeRetraitHash"]).toMatch(/^[0-9a-f]{64}$/);
    expect(envoi["consentement"]).toBe(true);
    expect(envoi).not.toHaveProperty("q5");
    expect(envoi["q3"]).toBe("outre-mer");

    const code = await screen.findByTestId("code-retrait");
    expect(code.textContent!.replace(/\s/g, "")).toMatch(/^[0-9A-Z]{16}$/);
    expect(JSON.stringify(envoi)).not.toContain(code.textContent!.replace(/\s/g, ""));
    expect(screen.getByRole("button", { name: FORMULAIRE.copier })).toBeTruthy();
  });
});
