import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

const A = vi.hoisted(() => ({
  creer: vi.fn(),
  sauver: vi.fn(),
  reprendre: vi.fn(),
  numeroter: vi.fn(),
  envoyer: vi.fn(),
  apercu: vi.fn(),
  sources: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/devis-assistant-brouillon", () => ({
  creerBrouillonAssistantAction: A.creer,
  sauverBrouillonAssistantAction: A.sauver,
  reprendreBrouillonAssistantAction: A.reprendre,
}));
vi.mock("@/server/actions/qualiopi/devis-assistant-finaliser", () => ({
  numeroterDevisAssistantAction: A.numeroter,
  envoyerDepuisAssistantAction: A.envoyer,
}));
vi.mock("@/server/actions/qualiopi/devis-assistant-apercu", () => ({
  apercuAssistantAction: A.apercu,
}));
vi.mock("@/server/actions/qualiopi/devis-assistant-apercu-email", () => ({
  apercuEmailDevisAction: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/devis-assistant-sources", () => ({
  listerSourcesPourQuiAction: A.sources,
}));

import { AssistantDevisBranche } from "../AssistantDevisBranche";
import type { ClientOption } from "../etapes/un/BlocClient";
import { etatInitial } from "../etat";
import { etatVersPayload } from "../vers-payload";

const CLIENT: ClientOption = {
  id: "client-test",
  numero: "CLI-1",
  raisonSociale: "Client Test SAS",
  type: "particulier",
  adresse: null,
  contactNom: null,
  email: "client@example.test",
};

function monter(defaultClientId?: string) {
  const etat = etatInitial({
    defaultClientId,
    validiteParDefaut: "2026-12-08",
    formulesActives: true,
  });
  const payload = etatVersPayload(etat, 1, { tvaStandardPct: 20, textes: [] });
  return render(
    <AssistantDevisBranche
      payloadInitial={payload}
      brouillon={null}
      clients={[CLIENT]}
      textesParDefaut={[]}
      tauxStandard={20}
      formulesActives
      validiteParDefaut="2026-12-08"
      versionCgv="v"
      urlAssistant="/fr/adm/qualiopi/devis/new"
      defaultClientId={defaultClientId}
      rendreEtape={({ dispatch }) => (
        <button
          type="button"
          onClick={() => dispatch({ type: "champs", patch: { intitule: "Site" } })}
        >
          Taper
        </button>
      )}
    />,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  A.sources.mockResolvedValue({ data: [] });
  A.creer.mockResolvedValue({ data: { id: "id-1", revision: 0 } });
});
afterEach(() => vi.useRealTimers());

describe("ouvrir l'assistant sur un client ne crée pas de brouillon vide", () => {
  it("avec defaultClientId : aucun appel de création après 5 s sans saisie", async () => {
    monter("client-test");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(A.creer).not.toHaveBeenCalled();
  });

  it("une frappe déclenche la création après 3 s", async () => {
    monter("client-test");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    fireEvent.click(screen.getByRole("button", { name: "Taper" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2900);
    });
    expect(A.creer).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(A.creer).toHaveBeenCalledTimes(1);
  });
});
