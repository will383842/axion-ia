// T-2 — « Aucun envoi sans la case » (plan V2-10 §7 PR-3).
// Parcours des 15 questions jusqu'au résultat, puis clic sur « Ajouter mes réponses » SANS cocher :
// l'action simulée n'est JAMAIS appelée, `fetch` n'est JAMAIS appelé, le script Turnstile n'est
// PAS injecté. Contre-épreuve : une fois la case cochée, Turnstile est bien monté (le test ne
// passe donc pas simplement parce que le widget serait absent).

import * as React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScoreFlow } from "../ScoreFlow";
import { construireQuestions } from "@/content/score-ia-pme/questions";
import { NB_QUESTIONS } from "@/content/score-ia-pme/textes";
import { parcourirJusquAuResultat } from "./aide-parcours";

const ajouter = vi.fn(async (_input: unknown) => ({ ok: true as const }));
const retirer = vi.fn(async (_input: unknown) => ({ ok: true as const, message: "ok" }));

vi.mock("@/server/actions/score-ia-pme/ajouter-a-l-observatoire", () => ({
  ajouterALObservatoire: (input: unknown) => ajouter(input),
}));
vi.mock("@/server/actions/score-ia-pme/retirer", () => ({
  retirerReponsesScore: (input: unknown) => retirer(input),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const props = () => ({
  questions: construireQuestions(),
  libellesTaille: { TPE: "Moins de 10 (y compris sans salarié)" },
  snapshot: null,
  encadre: ["Texte d'information."],
  hrefConfidentialite: "/fr/politique-confidentialite",
  prixJournee: "",
});

describe("T-2 — aucun envoi sans la case", () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    ajouter.mockClear();
    retirer.mockClear();
    fetchSpy.mockClear();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
    document.getElementById("axion-turnstile-script")?.remove();
    window.sessionStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("15 questions, résultat, clic sans cocher : ni action, ni fetch, ni script Turnstile", async () => {
    const user = userEvent.setup();
    render(<ScoreFlow {...props()} />);
    await parcourirJusquAuResultat(user, NB_QUESTIONS);

    expect(screen.getByRole("heading", { name: "Votre score" })).toBeTruthy();
    // Rien n'a quitté le navigateur pendant tout le parcours.
    expect(ajouter).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(document.getElementById("axion-turnstile-script")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Ajouter mes réponses" }));

    expect(ajouter).not.toHaveBeenCalled();
    expect(retirer).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(document.getElementById("axion-turnstile-script")).toBeNull();
    expect(document.querySelector(".turnstile-widget")).toBeNull();
    // Le message explique pourquoi rien ne part.
    expect(screen.getByRole("alert").textContent).toBe("Cochez la case pour envoyer vos réponses");
  });

  it("contre-épreuve : cocher la case monte Turnstile (et seulement alors)", async () => {
    const user = userEvent.setup();
    render(<ScoreFlow {...props()} />);
    await parcourirJusquAuResultat(user, NB_QUESTIONS);
    expect(document.getElementById("axion-turnstile-script")).toBeNull();

    await user.click(screen.getByRole("checkbox", { name: /J'accepte que mes réponses/ }));

    expect(document.getElementById("axion-turnstile-script")).not.toBeNull();
    // Cocher n'envoie toujours rien : il faut aussi presser le bouton.
    expect(ajouter).not.toHaveBeenCalled();
  });
});
