/**
 * Devis EXPIRÉ : les actions proposées dans la console (lot E2).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const accepter = vi.fn();
const refuser = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/server/actions/qualiopi/devis-remis-main-propre", () => ({
  marquerRemisEnMainPropreAction: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/devis", () => ({
  sendDevisAction: vi.fn(),
  reviseDevisAction: vi.fn(),
  acceptDevisAction: (...a: unknown[]) => accepter(...a),
  declineDevisAction: (...a: unknown[]) => refuser(...a),
  transformDevisToConventionAction: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/facturation-emails", () => ({
  envoyerDevisEmailAction: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/devis-prolonger-validite", () => ({
  prolongerValiditeDevisAction: vi.fn(),
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
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-07-10T10:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.clearAllMocks();
});

const monter = (over: Record<string, unknown> = {}) =>
  render(
    <DevisLifecycleButtons
      devisId="d"
      statut="expire"
      estClassique
      numero="AXI-DEV-2026-001"
      dateValiditeIso="2026-07-08T21:59:59.000Z"
      {...over}
    />,
  );

describe("DevisLifecycleButtons — devis expiré", () => {
  it("expire_remplace_aucun_bouton", () => {
    monter({ successeurEmis: true });
    expect(screen.getByText("Ce devis a été remplacé par une version plus récente.")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByText("Aucune action disponible pour ce statut.")).toBeNull();
  });

  it("expire_signe_client_note_contresigner", () => {
    monter({ clientASigne: true, signeParClient: true });
    expect(screen.getByTestId("note-signe-par-client").textContent).toMatch(
      /Le client a signé ce devis\. Contresignez-le dans le bloc « Signature électronique »\s+ci-dessus pour le conclure\./,
    );
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("expire_successeur_emis_note_remplace", () => {
    monter({ successeurEmis: true, signeParClient: true });
    expect(screen.getByTestId("note-expire-remplace")).toBeTruthy();
    expect(screen.queryByTestId("note-signe-par-client")).toBeNull();
  });

  it("expire_actions_prolonger_corriger_refuser_accepter", () => {
    monter();
    expect(screen.getByRole("button", { name: "Prolonger la validité du devis" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Créer une nouvelle version/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Marquer le devis comme refusé" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Marquer le devis expiré comme accepté" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Renvoyer par email/ })).toBeNull();
  });

  it("accepter_expire_confirmation_texte_exact", async () => {
    monter();
    await userEvent.click(
      screen.getByRole("button", { name: "Marquer le devis expiré comme accepté" }),
    );
    expect(screen.getByText("Marquer accepté un devis expiré ?")).toBeTruthy();
    expect(
      screen.getByText(
        "La date de validité de ce devis (08/07/2026) est dépassée. Le marquer accepté vaut accord aux conditions du PDF d'origine, prix compris. Ne le faites que si le client vous a donné son accord.",
      ),
    ).toBeTruthy();
    expect(accepter).not.toHaveBeenCalled();
    accepter.mockResolvedValue({ data: {} });
    await userEvent.click(screen.getByRole("button", { name: "Marquer accepté" }));
    expect(accepter).toHaveBeenCalledWith("d");
  });

  it("formules_sans_marquer_accepte", () => {
    monter({ estClassique: false });
    expect(screen.queryByRole("button", { name: /accepté/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Créer une nouvelle version/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Marquer le devis comme refusé" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Prolonger la validité du devis" })).toBeTruthy();
  });
});
