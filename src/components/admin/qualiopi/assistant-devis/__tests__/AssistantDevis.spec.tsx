import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AssistantDevis, brouillonEstIllisible, type PropsAssistantDevis } from "../AssistantDevis";
import { serialiser, etatInitial } from "../etat";
import { etatT1 } from "../fixtures";

const BASE: PropsAssistantDevis = {
  validiteParDefaut: "2026-12-08",
  formulesActives: true,
  defaultClientId: "c-1",
};

const rendre: PropsAssistantDevis["rendreEtape"] = ({ etape, dispatch }) => (
  <div>
    <p data-testid="etape">{String(etape)}</p>
    <button
      type="button"
      onClick={() => dispatch({ type: "champs", patch: { intitule: "Devis test" } })}
    >
      Remplir l&apos;intitulé
    </button>
    <input aria-label="Champ libre" />
  </div>
);

function remplirEtape1(p: Partial<PropsAssistantDevis> = {}) {
  const e = etatT1();
  return { ...BASE, brouillonInitial: { id: "b1", majLe: "t", donnees: serialiser(e, 1) }, ...p };
}

describe("AssistantDevis", () => {
  it("affiche le titre de l'étape 1 et annonce « Étape 1 sur 4 : Client et projet »", () => {
    render(<AssistantDevis {...BASE} rendreEtape={rendre} />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toContain("Client et projet");
    expect(screen.getByRole("status").textContent).toBe("Étape 1 sur 4 : Client et projet");
  });

  it("« Continuer » avec erreurs : liste role=alert, aucune sauvegarde appelée", async () => {
    const sauvegarder = vi.fn();
    render(
      <AssistantDevis
        {...BASE}
        defaultClientId={undefined}
        sauvegarder={sauvegarder}
        rendreEtape={rendre}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
    const alerte = await screen.findByRole("alert");
    expect(alerte.textContent).toContain("Choisissez un client");
    expect(sauvegarder).not.toHaveBeenCalled();
    expect(screen.getByTestId("etape").textContent).toBe("1");
  });

  it("étape valide : sauvegarde attendue, puis étape suivante, focus sur le titre et annonce", async () => {
    let fin: (v: { ok: true }) => void = () => {};
    const sauvegarder = vi.fn((_s: unknown) => new Promise<{ ok: true }>((r) => (fin = r)));
    render(<AssistantDevis {...remplirEtape1()} sauvegarder={sauvegarder} rendreEtape={rendre} />);
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
    // Libellé « Enregistrement… » dans la même image, étape inchangée tant que ça sauvegarde.
    expect(screen.getByRole("button", { name: "Enregistrement…" })).toBeTruthy();
    expect(screen.getByTestId("etape").textContent).toBe("1");
    expect(sauvegarder).toHaveBeenCalledTimes(1);
    expect(sauvegarder.mock.calls[0]![0]).toMatchObject({ v: 1, etape: "1b" });
    await act(async () => fin({ ok: true }));
    await waitFor(() => expect(screen.getByTestId("etape").textContent).toBe("1b"));
    const titre = screen.getByRole("heading", { level: 2 });
    expect(document.activeElement).toBe(titre);
    expect(titre.getAttribute("tabindex")).toBe("-1");
    expect(screen.getByRole("status").textContent).toBe("Étape 1 sur 4 : Client et projet, Phases");
  });

  it("échec de sauvegarde : on reste sur l'étape et l'erreur est annoncée", async () => {
    const sauvegarder = vi.fn(async () => ({ ok: false as const, erreur: "Réseau coupé." }));
    render(<AssistantDevis {...remplirEtape1()} sauvegarder={sauvegarder} rendreEtape={rendre} />);
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
    const alerte = await screen.findByRole("alert");
    expect(alerte.textContent).toContain("Réseau coupé.");
    expect(screen.getByTestId("etape").textContent).toBe("1");
  });

  it("Entrée dans un champ n'avance jamais d'étape", () => {
    const sauvegarder = vi.fn();
    render(<AssistantDevis {...remplirEtape1()} sauvegarder={sauvegarder} rendreEtape={rendre} />);
    fireEvent.keyDown(screen.getByLabelText("Champ libre"), { key: "Enter" });
    fireEvent.submit(screen.getByLabelText("Champ libre").closest("form") ?? document.body);
    expect(sauvegarder).not.toHaveBeenCalled();
    expect(screen.getByTestId("etape").textContent).toBe("1");
  });

  it("« Retour » revient d'une étape sans sauvegarde ni contrôle", async () => {
    const e = etatT1();
    render(
      <AssistantDevis
        {...BASE}
        brouillonInitial={{ id: "b", majLe: "t", donnees: serialiser(e, 2) }}
        rendreEtape={rendre}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Retour" }));
    await waitFor(() => expect(screen.getByTestId("etape").textContent).toBe("1b"));
  });

  it("brouillon illisible : message lisible en alerte, assistant vide", () => {
    render(
      <AssistantDevis
        {...BASE}
        brouillonInitial={{ id: "b", majLe: "t", donnees: { v: 9 } as never }}
        rendreEtape={rendre}
      />,
    );
    expect(screen.getByRole("alert").textContent).toMatch(/version/i);
    expect(screen.getByTestId("etape").textContent).toBe("1");
    expect(etatInitial).toBeTypeOf("function");
    expect(screen.getByRole("alert").textContent).toMatch(/nouveau brouillon/i);
  });

  it("brouillonEstIllisible : vrai pour un brouillon illisible, faux sinon", () => {
    expect(brouillonEstIllisible(undefined)).toBe(false);
    expect(brouillonEstIllisible({ id: "b", majLe: "t", donnees: { v: 9 } as never })).toBe(true);
    expect(brouillonEstIllisible(remplirEtape1().brouillonInitial)).toBe(false);
  });

  it("pendant la sauvegarde, une pastille terminée ne fait pas sauter d'étape (course)", async () => {
    let fin: (v: { ok: true }) => void = () => {};
    const sauvegarder = vi.fn((_s: unknown) => new Promise<{ ok: true }>((r) => (fin = r)));
    render(
      <AssistantDevis
        {...BASE}
        brouillonInitial={{ id: "b", majLe: "t", donnees: serialiser(etatT1(), 2) }}
        sauvegarder={sauvegarder}
        rendreEtape={rendre}
      />,
    );
    const pastille = screen.getByRole("button", { name: /Client et projet/ });
    expect((pastille as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
    expect(sauvegarder).toHaveBeenCalledTimes(1);
    expect((pastille as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(pastille);
    expect(screen.getByTestId("etape").textContent).toBe("2");
    await act(async () => fin({ ok: true }));
    await waitFor(() => expect(screen.getByTestId("etape").textContent).toBe("3"));
  });
});
