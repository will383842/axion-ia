/**
 * Confirmation avant envoi ; résultat « garé » ≠ succès ; « Corriger et renvoyer »
 * (devis classique envoyé, non signé par le client).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const envoi = vi.fn();
const revise = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push }) }));
vi.mock("@/server/actions/qualiopi/devis-remis-main-propre", () => ({
  marquerRemisEnMainPropreAction: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/devis", () => ({
  sendDevisAction: (...a: unknown[]) => envoi(...a),
  reviseDevisAction: (...a: unknown[]) => revise(...a),
  acceptDevisAction: vi.fn(),
  declineDevisAction: vi.fn(),
  transformDevisToConventionAction: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/facturation-emails", () => ({
  envoyerDevisEmailAction: vi.fn(),
}));

import { DevisLifecycleButtons } from "./DevisLifecycleButtons";

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

const ENVOYER = { name: /Marquer le devis comme envoyé au client/ };
const brouillon = (over: Record<string, unknown> = {}) =>
  render(
    <DevisLifecycleButtons
      devisId="d"
      statut="brouillon"
      estClassique
      numero="AXI-DEV-2026-001"
      montantHtLabel="1 500,00 € HT"
      destinataire="client@example.test"
      {...over}
    />,
  );

describe("envoi : confirmation d'abord", () => {
  it("aucun appel avant confirmation ; le dialogue dit numéro, montant, destinataire", async () => {
    brouillon({ montantHtLabel: "1 500,00 €" });
    await userEvent.click(screen.getByRole("button", ENVOYER));
    expect(envoi).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "Envoyer le devis AXI-DEV-2026-001 (1 500,00 € HT) à client@example.test ? Le PDF et le lien de signature partent au client, ou attendent votre validation dans Emails → À valider.",
      ),
    ).toBeTruthy();
  });

  it("« Annuler » n'appelle rien", async () => {
    brouillon();
    await userEvent.click(screen.getByRole("button", ENVOYER));
    await userEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(envoi).not.toHaveBeenCalled();
  });

  it("confirmer envoie, une seule fois ; succès présenté comme tel", async () => {
    envoi.mockResolvedValue({
      data: { id: "d", emailEnvoye: true, signatureCreee: true },
    });
    brouillon();
    await userEvent.click(screen.getByRole("button", ENVOYER));
    await userEvent.click(screen.getByRole("button", { name: "Envoyer" }));
    await waitFor(() => expect(envoi).toHaveBeenCalledTimes(1));
    expect((await screen.findByRole("status")).textContent).toContain("Devis envoyé au client");
  });

  it("résultat « garé » : message en attente (la note), jamais un succès", async () => {
    envoi.mockResolvedValue({
      data: {
        id: "d",
        emailEnvoye: false,
        signatureCreee: true,
        garePourValidation: true,
        note: "L'email attend votre validation dans Emails → À valider.",
      },
    });
    brouillon();
    await userEvent.click(screen.getByRole("button", ENVOYER));
    await userEvent.click(screen.getByRole("button", { name: "Envoyer" }));
    const alerte = await screen.findByRole("alert");
    expect(alerte.textContent).toContain("attend votre validation");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("classique sans adresse : note à la place du bouton d'envoi ; « Remis en main propre… » reste", () => {
    brouillon({ destinataire: null });
    expect(screen.queryByRole("button", ENVOYER)).toBeNull();
    expect(screen.getByText("Ce client n'a pas d'adresse e-mail.")).toBeTruthy();
    expect(screen.getByText(/Remis en main propre…/)).toBeTruthy();
  });

  it("devis à formules sans adresse : comportement actuel (bouton présent)", () => {
    brouillon({ estClassique: false, destinataire: null });
    expect(screen.getByRole("button", ENVOYER)).toBeTruthy();
  });
});

describe("« Corriger et renvoyer »", () => {
  const CORRIGER = { name: /Créer une nouvelle version en brouillon/ };
  const envoye = (over: Record<string, unknown> = {}) =>
    render(
      <DevisLifecycleButtons
        devisId="d"
        statut="envoye"
        estClassique
        numero="AXI-DEV-2026-001"
        clientASigne={false}
        {...over}
      />,
    );

  it("présent pour un classique envoyé non signé", () => {
    envoye();
    expect(screen.getByRole("button", CORRIGER)).toBeTruthy();
  });

  it("absent si le client a signé, si devis à formules, ou hors statut « envoye »", () => {
    envoye({ clientASigne: true });
    expect(screen.queryByRole("button", CORRIGER)).toBeNull();
    cleanup();
    envoye({ estClassique: false });
    expect(screen.queryByRole("button", CORRIGER)).toBeNull();
    cleanup();
    for (const statut of ["brouillon", "accepte", "refuse", "expire"] as const) {
      envoye({ statut });
      expect(screen.queryByRole("button", CORRIGER)).toBeNull();
      cleanup();
    }
  });

  it("confirmation d'abord ; « Annuler » n'appelle rien", async () => {
    envoye();
    await userEvent.click(screen.getByRole("button", CORRIGER));
    expect(revise).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "Une nouvelle version en brouillon est créée. L'ancien lien de signature reste valable jusqu'à l'envoi de la nouvelle version, qui le désactivera.",
      ),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(revise).not.toHaveBeenCalled();
  });

  it("confirmer : révision puis navigation vers /corriger de la nouvelle version", async () => {
    revise.mockResolvedValue({ data: { id: "nouveau", numero: "AXI-DEV-2026-002" } });
    window.history.pushState({}, "", "/fr/adm/qualiopi/devis/d");
    envoye();
    await userEvent.click(screen.getByRole("button", CORRIGER));
    await userEvent.click(screen.getByRole("button", { name: "Créer la nouvelle version" }));
    await waitFor(() => expect(revise).toHaveBeenCalledWith("d"));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/fr/adm/qualiopi/devis/nouveau/corriger"),
    );
  });

  it("refus de la révision : message affiché, pas de navigation", async () => {
    revise.mockResolvedValue({ error: "Le client a déjà signé ce devis." });
    envoye();
    await userEvent.click(screen.getByRole("button", CORRIGER));
    await userEvent.click(screen.getByRole("button", { name: "Créer la nouvelle version" }));
    expect((await screen.findByRole("alert")).textContent).toContain("déjà signé");
    expect(push).not.toHaveBeenCalled();
  });
});
