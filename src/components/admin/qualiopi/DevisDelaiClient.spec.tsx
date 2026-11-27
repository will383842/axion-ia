import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  refresh: vi.fn(),
  demander: vi.fn(),
  lever: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh }) }));
vi.mock("@/server/actions/qualiopi/devis-delai-client", () => ({
  demanderDelaiClientAction: (...a: unknown[]) => h.demander(...a),
  leverDelaiClientAction: (...a: unknown[]) => h.lever(...a),
}));

import { DevisDelaiClient } from "./DevisDelaiClient";

const ID = "11111111-1111-4111-8111-111111111111";
const BORNES = { min: "2026-07-11", max: "2026-10-08", defaut: "2026-07-17" };

beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(cleanup);

function monter(over: Partial<React.ComponentProps<typeof DevisDelaiClient>> = {}) {
  return render(
    <DevisDelaiClient
      devisId={ID}
      numero="AXI-DEV-2026-001"
      delaiJusquAuLisible={null}
      bornes={BORNES}
      {...over}
    />,
  );
}

describe("DevisDelaiClient", () => {
  it("sans délai : bouton, puis zone avec valeur par défaut, min, max et aide", () => {
    monter();
    expect(screen.queryByTestId("zone-delai-client")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Le client demande un délai…" }));
    const zone = screen.getByTestId("zone-delai-client");
    expect(zone).toBeTruthy();
    expect(screen.getByText("Ne pas relancer avant le")).toBeTruthy();
    const champ = zone.querySelector("input[type=date]") as HTMLInputElement;
    expect(champ.value).toBe("2026-07-17");
    expect(champ.min).toBe("2026-07-11");
    expect(champ.max).toBe("2026-10-08");
    expect(
      screen.getByText(
        "Jusqu'à cette date, ce devis n'est plus signalé « À relancer » : ni pastille, ni rappel, ni alerte. Rien n'est envoyé au client.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enregistrer le délai" })).toBeTruthy();
  });

  it("« Annuler » referme la zone", () => {
    monter();
    fireEvent.click(screen.getByRole("button", { name: "Le client demande un délai…" }));
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.queryByTestId("zone-delai-client")).toBeNull();
  });

  it("enregistre : appelle l'action avec { devisId, jour }, message de succès, refresh", async () => {
    h.demander.mockResolvedValue({ data: { jourLisible: "17/07/2026" } });
    monter();
    fireEvent.click(screen.getByRole("button", { name: "Le client demande un délai…" }));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le délai" }));
    await waitFor(() =>
      expect(h.demander).toHaveBeenCalledWith({ devisId: ID, jour: "2026-07-17" }),
    );
    const statut = await screen.findByRole("status");
    expect(statut.textContent).toBe(
      "Délai enregistré : pas de rappel pour ce devis avant le 17/07/2026. Rien n'a été envoyé au client.",
    );
    expect(h.refresh).toHaveBeenCalled();
  });

  it("erreur de l'action : message rendu tel quel, pas de refresh", async () => {
    h.demander.mockResolvedValue({ error: "Date invalide." });
    monter();
    fireEvent.click(screen.getByRole("button", { name: "Le client demande un délai…" }));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le délai" }));
    const alerte = await screen.findByRole("alert");
    expect(alerte.textContent).toBe("Date invalide.");
    expect(h.refresh).not.toHaveBeenCalled();
  });

  it("délai actif : note, « Changer la date… » et « Lever le délai »", () => {
    monter({ delaiJusquAuLisible: "20/07/2026" });
    expect(screen.getByTestId("delai-client-actif").textContent).toBe(
      "Le client a demandé un délai : pas de rappel avant le 20/07/2026.",
    );
    expect(screen.queryByRole("button", { name: "Le client demande un délai…" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Changer la date…" }));
    const champ = screen
      .getByTestId("zone-delai-client")
      .querySelector("input") as HTMLInputElement;
    // 20/07/2026 est dans les bornes : c'est la valeur initiale.
    expect(champ.value).toBe("2026-07-20");
  });

  it("changer la date hors bornes : la valeur initiale revient au défaut", () => {
    monter({ delaiJusquAuLisible: "01/07/2026" });
    fireEvent.click(screen.getByRole("button", { name: "Changer la date…" }));
    const champ = screen
      .getByTestId("zone-delai-client")
      .querySelector("input") as HTMLInputElement;
    expect(champ.value).toBe("2026-07-17");
  });

  it("« Lever le délai » appelle l'action, message de succès, refresh", async () => {
    h.lever.mockResolvedValue({ data: { leve: true } });
    monter({ delaiJusquAuLisible: "20/07/2026" });
    fireEvent.click(screen.getByRole("button", { name: "Lever le délai" }));
    await waitFor(() => expect(h.lever).toHaveBeenCalledWith({ devisId: ID }));
    const statut = await screen.findByRole("status");
    expect(statut.textContent).toBe(
      "Délai levé : ce devis peut de nouveau être signalé « À relancer ». Les alertes reviendront au prochain passage du matin s'il y a lieu.",
    );
    expect(h.refresh).toHaveBeenCalled();
  });

  it("bornes nulles : seulement la note, aucun bouton", () => {
    monter({ bornes: null });
    expect(
      screen.getByText(
        "La validité de ce devis se termine aujourd'hui : prolongez-la d'abord pour accorder un délai.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("aucun mot interdit dans le rendu", () => {
    const { container } = monter();
    fireEvent.click(screen.getByRole("button", { name: "Le client demande un délai…" }));
    expect(container.textContent ?? "").not.toMatch(
      /qualiopi|opco|financement|prise en charge|certification|cpf/i,
    );
  });
});
