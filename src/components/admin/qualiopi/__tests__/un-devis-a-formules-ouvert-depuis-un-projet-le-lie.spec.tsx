/**
 * Un devis à formules ouvert depuis un projet transmet `projetId` (même garde que le devis
 * classique : seulement si le client choisi est celui du projet).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const creerMock = vi.fn();
vi.mock("@/server/actions/qualiopi/devis-formules", () => ({
  creerDevisFormulesAction: (...a: unknown[]) => creerMock(...a),
}));
vi.mock("@/server/actions/qualiopi/devis", () => ({
  createDevisAction: vi.fn(),
  lireBandeauAttributionAction: async () => null,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import { DevisForm } from "@/components/admin/qualiopi/DevisForm";

const CLIENT = "11111111-1111-4111-8111-111111111111";
const AUTRE = "33333333-3333-4333-8333-333333333333";
const PROJET = "22222222-2222-4222-8222-222222222222";

function monterEtEnvoyer(clientChoisi: string) {
  const { container } = render(
    <DevisForm
      clients={[
        { id: CLIENT, numero: "AXI-CLI-001", raisonSociale: "Client du projet" },
        { id: AUTRE, numero: "AXI-CLI-002", raisonSociale: "Autre client" },
      ]}
      offres={[]}
      activites={[{ value: "implementation", label: "Implémentation" }]}
      basePath="/fr/adm/qualiopi/devis"
      defaultClientId={CLIENT}
      projetId={PROJET}
      formules={{ textes: [], tvaStandardPct: 20 }}
    />,
  );
  fireEvent.change(screen.getByLabelText(/^Client/), { target: { value: clientChoisi } });
  fireEvent.click(screen.getByLabelText(/Devis à formules/));
  fireEvent.click(screen.getByLabelText(/Formule A/));
  fireEvent.change(screen.getByLabelText("Désignation"), { target: { value: "Mise en place" } });
  fireEvent.change(screen.getByLabelText("Prix HT (€)"), { target: { value: "1000" } });
  fireEvent.change(screen.getByLabelText("Mensuel HT (€)"), { target: { value: "40" } });
  fireEvent.submit(container.querySelector("form") as HTMLFormElement);
}

describe("devis à formules ouvert depuis un projet", () => {
  beforeEach(() => {
    creerMock.mockReset();
    creerMock.mockResolvedValue({ data: { id: "d-1", numero: "N-1" } });
  });
  it("le client du projet conservé : projetId part", async () => {
    monterEtEnvoyer(CLIENT);
    await waitFor(() => expect(creerMock).toHaveBeenCalledTimes(1));
    expect((creerMock.mock.calls[0]![0] as Record<string, unknown>)["projetId"]).toBe(PROJET);
  });
  it("un autre client choisi : aucun projetId", async () => {
    monterEtEnvoyer(AUTRE);
    await waitFor(() => expect(creerMock).toHaveBeenCalledTimes(1));
    expect(creerMock.mock.calls[0]![0]).not.toHaveProperty("projetId");
  });
});
