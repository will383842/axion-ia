import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import type { PhaseAssistant } from "../../../types";
import { EditeurPhases } from "../EditeurPhases";

const P = (id: string, pct: string, patch: Partial<PhaseAssistant> = {}): PhaseAssistant => ({
  id,
  libelle: "",
  pourcentage: pct,
  declencheur: "signature",
  livrable: "",
  delaiSemaines: "",
  ...patch,
});

function Hote({
  initial,
  montants,
  compact,
}: {
  initial: PhaseAssistant[];
  montants?: ReadonlyArray<number | null>;
  compact?: boolean;
}) {
  const [phases, setPhases] = useState(initial);
  return (
    <>
      <EditeurPhases
        phases={phases}
        onChange={setPhases}
        nom="Phases"
        {...(montants ? { montants } : {})}
        {...(compact ? { compact } : {})}
      />
      <div data-testid="etat">{JSON.stringify(phases)}</div>
    </>
  );
}
const lues = () => JSON.parse(screen.getByTestId("etat").textContent!) as PhaseAssistant[];
const pcts = () => lues().map((p) => p.pourcentage);

describe("EditeurPhases", () => {
  it("propose les six modèles", () => {
    render(<Hote initial={[P("a", "100")]} />);
    for (const nom of [
      /complet \(6 phases\)/i,
      /court \(3 phases\)/i,
      /100 % à la signature/i,
      /50 % \/ 50 %/i,
      /30 % \/ 30 % \/ solde/i,
      /composer moi-même/i,
    ]) {
      expect(screen.getByRole("button", { name: nom })).toBeTruthy();
    }
  });

  it.each([
    [/complet \(6 phases\)/i, ["20", "20", "20", "15", "15", "10"]],
    [/court \(3 phases\)/i, ["30", "40", "30"]],
    [/100 % à la signature/i, ["100"]],
    [/50 % \/ 50 %/i, ["50", "50"]],
    [/30 % \/ 30 % \/ solde/i, ["30", "30", "40"]],
    [/composer moi-même/i, ["100"]],
  ])("modèle %s sur des phases vierges", (nom, attendu) => {
    render(<Hote initial={[P("a", "100")]} />);
    fireEvent.click(screen.getByRole("button", { name: nom }));
    expect(pcts()).toEqual(attendu);
  });

  it("des phases déjà rédigées ne sont remplacées qu'après confirmation", () => {
    render(<Hote initial={[P("a", "100", { libelle: "Ma phase" })]} />);
    fireEvent.click(screen.getByRole("button", { name: /court \(3 phases\)/i }));
    expect(lues()).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /remplacer mes phases/i }));
    expect(lues()).toHaveLength(3);
  });

  it("les ids des phases d'un modèle sont uniques", () => {
    render(<Hote initial={[P("a", "100")]} />);
    fireEvent.click(screen.getByRole("button", { name: /complet/i }));
    const ids = lues().map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("total ≠ 100 : message de blocage et total annoncé", () => {
    render(<Hote initial={[P("a", "60"), P("b", "30")]} />);
    expect(screen.getByText(/total des versements : 90 %/i)).toBeTruthy();
    expect(screen.getByText(/doit valoir 100 %/i)).toBeTruthy();
    // Pas de rôle « alert » qui change à chaque frappe.
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("total = 100 : pas de message de blocage", () => {
    render(<Hote initial={[P("a", "60"), P("b", "40")]} />);
    expect(screen.queryByText(/doit valoir 100 %/i)).toBeNull();
  });

  it("garde : le message de blocage existe bien à 90 % (le test à 100 % ne passe pas à vide)", () => {
    render(<Hote initial={[P("a", "60"), P("b", "30")]} />);
    expect(screen.queryByText(/doit valoir 100 %/i)).not.toBeNull();
  });

  it("une seule annonce polie, limitée au total (pas les messages d'erreur)", () => {
    render(<Hote initial={[P("a", "60"), P("b", "30")]} />);
    const lives = document.querySelectorAll("[aria-live]");
    expect(lives).toHaveLength(1);
    expect(lives[0]!.textContent).toMatch(/90 %/);
    expect(lives[0]!.textContent).not.toMatch(/doit valoir/i);
  });

  it("aria-label de la barre recalculé à chaque changement", () => {
    render(<Hote initial={[P("a", "60"), P("b", "40")]} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("60 %, 40 %");
    fireEvent.change(screen.getByLabelText(/versement de la phase 1/i), {
      target: { value: "70" },
    });
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("70 %, 40 %");
  });

  it("ajout et retrait d'une phase", () => {
    render(<Hote initial={[P("a", "100")]} />);
    fireEvent.click(screen.getByRole("button", { name: /ajouter une phase/i }));
    expect(lues()).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: /retirer la phase/i })[1]!);
    expect(lues()).toHaveLength(1);
  });

  it("« + Ajouter une phase » crée une phase à signaler (0 % invalide), message près du champ", () => {
    render(<Hote initial={[P("a", "100")]} />);
    fireEvent.click(screen.getByRole("button", { name: /ajouter une phase/i }));
    const champ = screen.getByLabelText(/versement de la phase 2/i);
    expect(champ.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(champ.getAttribute("aria-describedby")!)!.textContent).toMatch(
      /entre 1 et 100/,
    );
  });

  it("un modèle appliqué puis dont le délai est modifié demande confirmation avant d'être remplacé", () => {
    render(<Hote initial={[P("a", "100")]} />);
    fireEvent.click(screen.getByRole("button", { name: /complet \(6 phases\)/i }));
    const delai = screen.getByLabelText(/délai de la phase 1/i);
    fireEvent.change(delai, { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: /court \(3 phases\)/i }));
    expect(lues()).toHaveLength(6);
    expect(lues()[0]!.delaiSemaines).toBe("9");
    expect(screen.getByRole("button", { name: /remplacer mes phases/i })).toBeTruthy();
  });

  it("après « Retirer » puis « Garder » ou « Confirmer », le focus reste dans l'éditeur", () => {
    render(<Hote initial={[P("a", "50", { libelle: "Étude" }), P("b", "50")]} />);
    fireEvent.click(screen.getByRole("button", { name: /retirer la phase 1/i }));
    const garder = screen.getByRole("button", { name: /garder la phase/i });
    expect(document.activeElement).toBe(garder);
    fireEvent.click(garder);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /retirer la phase 1/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /retirer la phase 1/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirmer le retrait/i }));
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(screen.getByLabelText(/^phase 1/i));
  });

  it("retirer une phase remplie demande confirmation ; la dernière phase reste", () => {
    render(<Hote initial={[P("a", "50", { libelle: "Étude" }), P("b", "50")]} />);
    fireEvent.click(screen.getAllByRole("button", { name: /retirer la phase 1/i })[0]!);
    expect(lues()).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /confirmer le retrait/i }));
    expect(lues().map((p) => p.id)).toEqual(["b"]);
    expect(
      (screen.getByRole("button", { name: /retirer la phase 1/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("saisie du libellé, du livrable et du délai ; le pourcentage n'accepte que des chiffres", () => {
    render(<Hote initial={[P("a", "100")]} />);
    fireEvent.change(screen.getByLabelText(/^phase 1$/i), { target: { value: "Étude" } });
    fireEvent.change(screen.getByLabelText(/livrable/i), { target: { value: "Cahier" } });
    fireEvent.change(screen.getByLabelText(/délai/i), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText(/versement de la phase 1/i), {
      target: { value: "10x" },
    });
    expect(lues()[0]).toMatchObject({
      libelle: "Étude",
      livrable: "Cahier",
      delaiSemaines: "2",
      pourcentage: "100",
    });
  });

  it("montant par phase : affiché tel que reçu du serveur, jamais calculé ici", () => {
    render(<Hote initial={[P("a", "60"), P("b", "40")]} montants={[134517, null]} />);
    expect((document.body.textContent ?? "").replace(/[  ]/g, " ")).toContain("1 345,17");
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("sans montants reçus, aucune colonne de montant", () => {
    render(<Hote initial={[P("a", "100")]} />);
    expect(screen.queryByText(/montant ht/i)).toBeNull();
  });

  it("mode compact : ni livrable ni délai", () => {
    render(<Hote initial={[P("a", "100")]} compact />);
    expect(screen.queryByLabelText(/livrable/i)).toBeNull();
    expect(screen.queryByLabelText(/délai/i)).toBeNull();
  });
});
