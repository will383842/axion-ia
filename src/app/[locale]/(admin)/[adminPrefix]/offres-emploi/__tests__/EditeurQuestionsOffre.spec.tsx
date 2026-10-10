/**
 * L13 (paquet 4a) — l'éditeur des questions d'une offre, dans la console.
 *
 * Ce que ce test prouve : les gestes (ajouter, libeller, typer, rendre
 * obligatoire, réordonner, supprimer) produisent le texte du champ
 * `screeningQuestions` — le même que l'on tapait à la main — et un JSON que
 * l'éditeur ne sait pas lire le laisse fermé au profit du mode avancé, sans
 * rien réécrire. Et que le formulaire charge l'éditeur À LA DEMANDE.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent, screen, within } from "@testing-library/react";

import { EditeurQuestionsOffre } from "../EditeurQuestionsOffre";

afterEach(cleanup);

function monter(valeur: string) {
  const onChange = vi.fn<(v: string) => void>();
  const r = render(<EditeurQuestionsOffre valeur={valeur} onChange={onChange} />);
  return { onChange, ...r };
}

const dernier = (f: ReturnType<typeof vi.fn>) => f.mock.calls.at(-1)?.[0] as string;

describe("EditeurQuestionsOffre", () => {
  it("ajouter une question, la libeller, la typer prix, la rendre obligatoire", () => {
    const { onChange, rerender } = monter("");
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une question" }));
    let v = dernier(onChange);
    const [ajoutee] = JSON.parse(v) as Array<{ id: string }>;
    const id = ajoutee!.id;
    expect(JSON.parse(v)).toEqual([{ id, labelFr: "", required: false }]);

    rerender(<EditeurQuestionsOffre valeur={v} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Libellé de la question 1"), {
      target: { value: "Votre prix journée" },
    });
    v = dernier(onChange);
    rerender(<EditeurQuestionsOffre valeur={v} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Type de la question 1"), {
      target: { value: "price" },
    });
    v = dernier(onChange);
    rerender(<EditeurQuestionsOffre valeur={v} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Question 1 obligatoire"));
    expect(JSON.parse(dernier(onChange))).toEqual([
      { id, labelFr: "Votre prix journée", required: true, type: "price" },
    ]);
  });

  it("réordonner et supprimer", () => {
    const { onChange } = monter('[{"id":"a","labelFr":"A"},{"id":"b","labelFr":"B"}]');
    fireEvent.click(screen.getByRole("button", { name: "Monter la question 2" }));
    expect(dernier(onChange)).toBe('[{"id":"b","labelFr":"B"},{"id":"a","labelFr":"A"}]');
    fireEvent.click(screen.getByRole("button", { name: "Supprimer la question 1" }));
    expect(dernier(onChange)).toBe('[{"id":"b","labelFr":"B"}]');
  });

  it("🔴 supprimer la dernière question enregistre « aucune question » (`[]`)", () => {
    const { onChange } = monter('[{"id":"a","labelFr":"A"}]');
    fireEvent.click(screen.getByRole("button", { name: "Supprimer la question 1" }));
    expect(dernier(onChange)).toBe("[]");
  });

  it("les clés qu'il ne montre pas sont signalées comme conservées", () => {
    monter('[{"id":"p","labelFr":"Prix","type":"price","court":"30 s","groupe":"Vos prix"}]');
    const carte = screen.getByRole("group", { name: "Question 1" });
    expect(within(carte).getByText(/conservés tels quels : court, groupe/)).toBeTruthy();
  });

  it("un JSON illisible : l'éditeur ne réécrit rien et renvoie au mode avancé", () => {
    const { onChange } = monter("[{");
    expect(screen.getByRole("alert").textContent).toMatch(/mode avancé/);
    expect(screen.queryByRole("button", { name: "Ajouter une question" })).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("JobOfferForm", () => {
  const source = readFileSync(join(__dirname, "../JobOfferForm.tsx"), "utf8");

  it("charge l'éditeur À LA DEMANDE (poids de la console)", () => {
    expect(source).toMatch(/dynamic\(\s*\(\)\s*=>\s*import\("\.\/EditeurQuestionsOffre"\)/);
    expect(source).not.toMatch(/from "\.\/EditeurQuestionsOffre"/);
  });

  it("garde le mode avancé (JSON), replié, sous le même nom de champ", () => {
    expect(source).toMatch(/<details[\s\S]*Mode avancé \(JSON\)[\s\S]*name="screeningQuestions"/);
  });
});
