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
const accepter = vi.fn();
const refuser = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/actions/qualiopi/devis-remis-main-propre", () => ({
  marquerRemisEnMainPropreAction: (...a: unknown[]) => remise(...a),
}));
vi.mock("@/server/actions/qualiopi/devis", () => ({
  sendDevisAction: vi.fn(),
  acceptDevisAction: (...a: unknown[]) => accepter(...a),
  declineDevisAction: (...a: unknown[]) => refuser(...a),
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

describe("DevisLifecycleButtons — confirmations et rôles (accepter / refuser)", () => {
  const rendre = (extra: Partial<React.ComponentProps<typeof DevisLifecycleButtons>> = {}) =>
    render(
      <DevisLifecycleButtons devisId="d" statut="envoye" estClassique numero="AXI-7" {...extra} />,
    );

  it("« Marquer accepté » : confirmation avant l'action, annuler n'appelle rien", async () => {
    accepter.mockResolvedValue({ data: { id: "d" } });
    rendre();
    await userEvent.click(screen.getByText("Marquer accepté"));
    expect(accepter).not.toHaveBeenCalled();
    expect(screen.getByText("Marquer le devis AXI-7 accepté ?")).toBeTruthy();
    expect(
      screen.getByText(
        "À faire seulement si le client a signé le devis papier ou donné son accord écrit. La fiche passe client et la suite est lancée.",
      ),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(accepter).not.toHaveBeenCalled();
    await userEvent.click(screen.getByText("Marquer accepté"));
    await userEvent.click(screen.getByRole("button", { name: "Marquer accepté" }));
    expect(accepter).toHaveBeenCalledTimes(1);
    expect(accepter).toHaveBeenCalledWith("d");
  });

  it("« Marquer refusé » : confirmation avant l'action, annuler n'appelle rien", async () => {
    refuser.mockResolvedValue({ data: { id: "d" } });
    rendre();
    await userEvent.click(screen.getByText("Marquer refusé"));
    expect(refuser).not.toHaveBeenCalled();
    expect(screen.getByText("Marquer le devis AXI-7 refusé ?")).toBeTruthy();
    expect(
      screen.getByText("Le lien de signature envoyé au client est désactivé immédiatement."),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(refuser).not.toHaveBeenCalled();
    await userEvent.click(screen.getByText("Marquer refusé"));
    await userEvent.click(screen.getByRole("button", { name: "Marquer refusé" }));
    expect(refuser).toHaveBeenCalledTimes(1);
  });

  it("peutConclure=false : pas de « Marquer accepté », les autres boutons restent", () => {
    rendre({ peutConclure: false });
    expect(screen.queryByText("Marquer accepté")).toBeNull();
    expect(screen.queryByText("Marquer refusé")).not.toBeNull();
  });

  it("peutEcrire=false : aucun bouton d'écriture", () => {
    rendre({ peutEcrire: false });
    for (const t of ["Marquer accepté", "Marquer refusé", "Renvoyer par email"]) {
      expect(screen.queryByText(t)).toBeNull();
    }
    expect(screen.queryByText(/Corriger et renvoyer/)).toBeNull();
  });

  it("peutEcrire=false sur un brouillon : ni envoi ni remise en main propre", () => {
    render(
      <DevisLifecycleButtons
        devisId="d"
        statut="brouillon"
        estClassique
        destinataire="a@b.fr"
        peutEcrire={false}
      />,
    );
    expect(screen.queryByText("Envoyer au client")).toBeNull();
    expect(screen.queryByText(BOUTON)).toBeNull();
  });
});
