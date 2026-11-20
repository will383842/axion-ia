/**
 * « Prolonger la validité… » : visibilité, bornes du champ, textes de confirmation et de succès.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const prolonger = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
vi.mock("@/server/actions/qualiopi/devis-remis-main-propre", () => ({
  marquerRemisEnMainPropreAction: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/devis", () => ({
  sendDevisAction: vi.fn(),
  reviseDevisAction: vi.fn(),
  acceptDevisAction: vi.fn(),
  declineDevisAction: vi.fn(),
  transformDevisToConventionAction: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/facturation-emails", () => ({
  envoyerDevisEmailAction: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/devis-prolonger-validite", () => ({
  prolongerValiditeDevisAction: (...a: unknown[]) => prolonger(...a),
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

const BOUTON = { name: "Prolonger la validité du devis" };
const monter = (over: Record<string, unknown> = {}) =>
  render(
    <DevisLifecycleButtons
      devisId="d"
      statut="envoye"
      numero="AXI-DEV-2026-001"
      dateValiditeIso="2026-07-12T21:59:59.000Z"
      {...over}
    />,
  );

async function ouvrirEtChoisir(date: string) {
  await userEvent.click(screen.getByRole("button", BOUTON));
  fireEvent.change(screen.getByLabelText("Nouvelle date de validité"), {
    target: { value: date },
  });
  await userEvent.click(screen.getByRole("button", { name: "Prolonger" }));
}

describe("DevisLifecycleButtons — prolonger la validité", () => {
  it("bouton_visible_envoye_non_signe", () => {
    monter();
    expect(screen.getByRole("button", BOUTON).textContent).toBe("Prolonger la validité…");
  });

  it("masque_si_signe", () => {
    monter({ clientASigne: true, signeParClient: true });
    expect(screen.queryByRole("button", BOUTON)).toBeNull();
  });

  it("masque_si_successeur_emis", () => {
    monter({ successeurEmis: true });
    expect(screen.queryByRole("button", BOUTON)).toBeNull();
  });

  it("masque_si_estimation_tiers", () => {
    monter({ estimationTiersFigee: true });
    expect(screen.queryByRole("button", BOUTON)).toBeNull();
  });

  it("masque_sans_droit_de_conclure et sur un devis expiré (E2)", () => {
    monter({ peutConclure: false });
    expect(screen.queryByRole("button", BOUTON)).toBeNull();
    cleanup();
    monter({ statut: "expire" });
    expect(screen.queryByRole("button", BOUTON)).toBeNull();
    expect(screen.getByText("Aucune action disponible pour ce statut.")).toBeTruthy();
  });

  it("min_est_le_lendemain_de_la_validite_actuelle_si_elle_est_plus_tard_que_demain", async () => {
    // Validité actuelle le 12/07 (Paris) : le serveur refuse une date non postérieure → min = 13/07.
    monter();
    await userEvent.click(screen.getByRole("button", BOUTON));
    const champ = screen.getByLabelText("Nouvelle date de validité") as HTMLInputElement;
    expect(champ.min).toBe("2026-07-13");
    expect(champ.max).toBe("2026-10-08");
  });

  it("bornes_min_max_du_champ", async () => {
    // Validité actuelle déjà passée : le minimum reste demain.
    monter({ dateValiditeIso: "2026-07-08T21:59:59.000Z" });
    await userEvent.click(screen.getByRole("button", BOUTON));
    const champ = screen.getByLabelText("Nouvelle date de validité") as HTMLInputElement;
    expect(champ.type).toBe("date");
    expect(champ.min).toBe("2026-07-11");
    expect(champ.max).toBe("2026-10-08");
    expect(
      screen.getByText("Le PDF déjà envoyé n'est pas modifié : il garde sa date d'origine."),
    ).toBeTruthy();
  });

  it("texte_confirmation_exact", async () => {
    monter();
    await ouvrirEtChoisir("2026-07-20");
    expect(prolonger).not.toHaveBeenCalled();
    expect(screen.getByText("Prolonger la validité du devis AXI-DEV-2026-001 ?")).toBeTruthy();
    expect(
      screen.getByText(
        "La validité passe du 12/07/2026 au 20/07/2026. Le PDF n'est pas modifié. Le lien de signature déjà reçu par le client garde son ancienne échéance : renvoyez ensuite le devis par e-mail pour lui donner un lien valable.",
      ),
    ).toBeTruthy();
  });

  it("message_succes_renvoi", async () => {
    prolonger.mockResolvedValue({ data: { nouvelleDateLisible: "20/07/2026", rouvert: false } });
    monter();
    await ouvrirEtChoisir("2026-07-20");
    const boutons = screen.getAllByRole("button", { name: "Prolonger" });
    await userEvent.click(boutons[0]!);
    await waitFor(() =>
      expect(prolonger).toHaveBeenCalledWith({ devisId: "d", nouvelleDate: "2026-07-20" }),
    );
    expect((await screen.findByRole("status")).textContent).toBe(
      "Validité prolongée jusqu'au 20/07/2026. Le client n'est pas prévenu : cliquez sur « Renvoyer par email » pour lui envoyer un nouveau lien (selon vos réglages, l'e-mail attendra votre validation dans Emails → À valider).",
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("message_succes_main_propre", async () => {
    prolonger.mockResolvedValue({ data: { nouvelleDateLisible: "20/07/2026", rouvert: false } });
    monter({ remisEnMainPropre: true });
    await ouvrirEtChoisir("2026-07-20");
    const boutons = screen.getAllByRole("button", { name: "Prolonger" });
    await userEvent.click(boutons[0]!);
    expect((await screen.findByRole("status")).textContent).toBe(
      "Validité prolongée jusqu'au 20/07/2026. Ce devis a été remis en main propre : prévenez le client de la nouvelle date.",
    );
  });
});
