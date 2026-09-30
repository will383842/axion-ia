/**
 * ⛔ UN DEVIS OUVERT DEPUIS UN PROJET ACCEPTE UN AUTRE CLIENT — SANS LE LIER
 * AU PROJET (vérification V1, C2 ; même garde que `VenteWizard`).
 *
 * Ouvert depuis le projet d'une fiche A, le formulaire garde son sélecteur de
 * client : Will peut choisir une fiche B. Le devis de B ne doit alors PAS
 * porter le `projetId` du projet de A — l'action le refuserait (« Ce projet
 * n'appartient pas à ce client »), et le devis ne se créerait pas du tout.
 *
 * Mutation qui rougit : envoyer `projetId` sans comparer `clientId` au client
 * pré-sélectionné (`DevisForm.tsx`, spread `projetId`).
 * Contre-témoin : le client du projet conservé, `projetId` part bien.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const createDevisActionMock = vi.fn();
vi.mock("@/server/actions/qualiopi/devis", () => ({
  createDevisAction: (...args: unknown[]) => createDevisActionMock(...args),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import { DevisForm } from "@/components/admin/qualiopi/DevisForm";

const CLIENT_DU_PROJET = "11111111-1111-4111-8111-111111111111";
const AUTRE_CLIENT = "33333333-3333-4333-8333-333333333333";
const PROJET_ID = "22222222-2222-4222-8222-222222222222";

function monterEtEnvoyer(clientChoisi: string) {
  const { container } = render(
    <DevisForm
      clients={[
        { id: CLIENT_DU_PROJET, numero: "AXI-CLI-001", raisonSociale: "Client du projet" },
        { id: AUTRE_CLIENT, numero: "AXI-CLI-002", raisonSociale: "Autre client" },
      ]}
      offres={[]}
      activites={[{ value: "formation", label: "Formation" }]}
      basePath="/fr/adm/qualiopi/devis"
      defaultClientId={CLIENT_DU_PROJET}
      projetId={PROJET_ID}
    />,
  );
  fireEvent.change(screen.getByLabelText(/^Client/), { target: { value: clientChoisi } });
  fireEvent.change(screen.getByLabelText(/Désignation/), { target: { value: "Ligne" } });
  fireEvent.change(screen.getByLabelText(/PU HT/), { target: { value: "100000" } });
  fireEvent.submit(container.querySelector("form") as HTMLFormElement);
}

describe("⛔ un devis ouvert depuis un projet accepte un autre client", () => {
  beforeEach(() => {
    createDevisActionMock.mockReset();
    createDevisActionMock.mockResolvedValue({ data: { id: "d-1", numero: "AXI-DEV-2026-001" } });
  });

  it("un autre client choisi : le devis part sans projetId", async () => {
    monterEtEnvoyer(AUTRE_CLIENT);
    await waitFor(() => expect(createDevisActionMock).toHaveBeenCalledTimes(1));
    const envoi = createDevisActionMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(envoi["clientId"]).toBe(AUTRE_CLIENT);
    expect(envoi).not.toHaveProperty("projetId");
  });

  it("contre-témoin : le client du projet conservé, le projet part", async () => {
    monterEtEnvoyer(CLIENT_DU_PROJET);
    await waitFor(() => expect(createDevisActionMock).toHaveBeenCalledTimes(1));
    const envoi = createDevisActionMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(envoi["projetId"]).toBe(PROJET_ID);
  });
});
