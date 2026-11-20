/**
 * Bouton « Remis en main propre… » : visible seulement pour un devis classique en brouillon,
 * passe par `useConfirmation` (jamais `window.confirm`).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const remise = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/actions/qualiopi/devis-remis-main-propre", () => ({
  marquerRemisEnMainPropreAction: (...a: unknown[]) => remise(...a),
}));
vi.mock("@/server/actions/qualiopi/devis", () => ({
  sendDevisAction: vi.fn(),
  acceptDevisAction: vi.fn(),
  declineDevisAction: vi.fn(),
  transformDevisToConventionAction: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/facturation-emails", () => ({
  envoyerDevisEmailAction: vi.fn(),
}));

import { DevisLifecycleButtons } from "./DevisLifecycleButtons";

// jsdom n'implémente pas <dialog>.showModal / close.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const BOUTON = /Remis en main propre…/;

describe("DevisLifecycleButtons — remis en main propre", () => {
  it("absent pour un devis à formules", () => {
    render(<DevisLifecycleButtons devisId="d" statut="brouillon" estClassique={false} />);
    expect(screen.queryByText(BOUTON)).toBeNull();
  });

  it.each(["envoye", "accepte", "refuse"] as const)("absent hors brouillon (%s)", (statut) => {
    render(<DevisLifecycleButtons devisId="d" statut={statut} estClassique numero="N1" />);
    expect(screen.queryByText(BOUTON)).toBeNull();
  });

  it("« Annuler » n'appelle rien", async () => {
    render(<DevisLifecycleButtons devisId="d" statut="brouillon" estClassique numero="AXI-1" />);
    await userEvent.click(screen.getByText(BOUTON));
    expect(screen.getByText(/AXI-1/)).toBeTruthy();
    expect(screen.getByText(/sans aucun e-mail ni lien de signature/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(remise).not.toHaveBeenCalled();
  });

  it("« Confirmer » appelle l'action une seule fois, avec le motif choisi", async () => {
    remise.mockResolvedValue({ data: { id: "d" } });
    render(<DevisLifecycleButtons devisId="d" statut="brouillon" estClassique numero="AXI-1" />);
    await userEvent.selectOptions(screen.getByRole("combobox"), "adresse_bloquee");
    await userEvent.click(screen.getByText(BOUTON));
    await userEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    expect(remise).toHaveBeenCalledTimes(1);
    expect(remise).toHaveBeenCalledWith({ id: "d", motif: "adresse_bloquee" });
  });

  it("le source n'utilise jamais window.confirm", () => {
    const src = readFileSync(path.resolve(__dirname, "DevisLifecycleButtons.tsx"), "utf8");
    expect(src).not.toMatch(/window\.confirm|\bconfirm\(/);
    expect(src).toContain("useConfirmation");
  });
});

describe("DevisLifecycleButtons — remisEnMainPropre (I1)", () => {
  it("masque le renvoi et l'avertissement, garde accepter, refuser et corriger", () => {
    render(
      <DevisLifecycleButtons
        devisId="d"
        statut="envoye"
        estClassique
        numero="N1"
        remisEnMainPropre
      />,
    );
    expect(screen.queryByText("Renvoyer par email")).toBeNull();
    expect(screen.queryByTestId("avertissement-renvoi-lien")).toBeNull();
    expect(screen.queryByText("Marquer accepté")).not.toBeNull();
    expect(screen.queryByText("Marquer refusé")).not.toBeNull();
    expect(screen.queryByText(/Corriger et renvoyer/)).not.toBeNull();
  });

  it("par défaut le renvoi reste proposé", () => {
    render(<DevisLifecycleButtons devisId="d" statut="envoye" estClassique numero="N1" />);
    expect(screen.queryByText("Renvoyer par email")).not.toBeNull();
  });
});
