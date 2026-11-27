/**
 * Après la contresignature, la page se recharge et l'apporteur n'est plus « à vérifier » : le bloc
 * de décision se démonte. Le message de réussite et le bilan des pièces doivent rester visibles.
 */

import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ apercu: vi.fn(), appliquer: vi.fn() }));
vi.mock("@/features/apporteurs-reseau/actions-apporteurs", () => ({
  apercuDecisionAction: (i: unknown) => h.apercu(i),
  appliquerDecisionAction: (i: unknown) => h.appliquer(i),
}));

import { BlocDecision } from "../BlocDecision";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const MESSAGE =
  "Contrat contresigné et envoyé. Pièces jointes : le contrat, la fiche des commissions, le livret et le guide de démarrage.";

beforeEach(() => {
  vi.clearAllMocks();
  h.apercu.mockResolvedValue({
    ok: true,
    email: { destinataire: "claire@exemple.fr", sujet: "Votre contrat", html: "<p>ok</p>" },
  });
  h.appliquer.mockResolvedValue({ ok: true, message: MESSAGE });
});

describe("BlocDecision : confirmation après rechargement", () => {
  it("garde le message visible quand l'apporteur n'est plus à vérifier", async () => {
    const u = userEvent.setup();
    const { rerender } = render(<BlocDecision apporteurId={ID} aVerifier />);
    await u.click(screen.getByRole("button", { name: "Oui, contresigner" }));
    await u.click(
      await screen.findByRole("button", { name: "Contresigner et envoyer le contrat" }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(MESSAGE);

    // La page revalidée rend le même composant, sans le bloc de décision.
    rerender(<BlocDecision apporteurId={ID} aVerifier={false} />);
    expect(screen.queryByRole("button", { name: "Oui, contresigner" })).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Contrat contresigné et envoyé.");
    expect(screen.getByRole("status")).toHaveTextContent("guide de démarrage");
  });

  it("n'affiche rien avant toute décision", () => {
    render(<BlocDecision apporteurId={ID} aVerifier={false} />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
