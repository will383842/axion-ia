/**
 * Un ancien brouillon de vente portant `financement: "opco"` ne perd pas cette valeur en
 * changeant d'étape : `updateVenteBrouillonAction` remplace tout le payload, donc le
 * formulaire la relit et la renvoie, sans jamais l'afficher.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const updateMock = vi.fn();
vi.mock("@/server/actions/qualiopi/vente-brouillon", () => ({
  createVenteBrouillonAction: vi.fn(),
  supprimerVenteBrouillonAction: vi.fn(),
  updateVenteBrouillonAction: (...a: unknown[]) => updateMock(...a),
}));
vi.mock("@/server/actions/qualiopi/clients", () => ({ createClientAction: vi.fn() }));
vi.mock("@/server/actions/qualiopi/formations", () => ({ duplicateFormationAction: vi.fn() }));
vi.mock("@/server/actions/qualiopi/sessions", () => ({ createSessionAction: vi.fn() }));
vi.mock("@/server/actions/qualiopi/devis", () => ({
  createDevisAction: vi.fn(),
  lireBandeauAttributionAction: async () => null,
}));
vi.mock("@/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), handlers: {} }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import { VenteWizard } from "@/components/admin/qualiopi/VenteWizard";

const CLIENT = "11111111-1111-4111-8111-111111111111";

function monter(payload: Record<string, unknown>) {
  return render(
    <VenteWizard
      adminPrefix="adm"
      role="admin"
      clients={[{ id: CLIENT, numero: "AXI-CLI-001", raisonSociale: "Client" }]}
      offres={[]}
      formations={[]}
      brouillon={{ id: "b-1", etape: 3, payload, clientId: CLIENT, devisId: null, sessionId: null }}
    />,
  );
}

async function precedentEtLirePayload(): Promise<Record<string, unknown>> {
  fireEvent.click(screen.getByRole("button", { name: /Précédent/ }));
  await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
  return (updateMock.mock.calls[0]?.[0] as { payload: Record<string, unknown> }).payload;
}

describe("vente — le financement d'un ancien brouillon est conservé sans être affiché", () => {
  beforeEach(() => {
    updateMock.mockReset();
    updateMock.mockResolvedValue({ data: { id: "b-1" } });
  });

  it("brouillon « opco » rouvert puis ré-enregistré : « opco » reste dans le payload", async () => {
    const { container } = monter({ financement: "opco" });
    expect((await precedentEtLirePayload())["financement"]).toBe("opco");
    expect(container.textContent).not.toMatch(/OPCO/i);
  });

  it("brouillon sans financement : « direct » par défaut", async () => {
    monter({});
    expect((await precedentEtLirePayload())["financement"]).toBe("direct");
  });
});
