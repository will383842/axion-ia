/**
 * Composeur : sur un rebond, aucun « Réessayer » (phase `rebond` distincte) ;
 * sur un échec, le bouton reste. Après un envoi réussi, aucune confirmation
 * n'est redemandée.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup, fireEvent, screen, act } from "@testing-library/react";

const repondre = vi.fn();
const etat = vi.fn();
vi.mock("@/features/admin-job-applications/reply-actions", () => ({
  repondreAuCandidatAction: (...a: unknown[]) => repondre(...a),
  rejouerReponseEchoueeAction: vi.fn(),
  etatLivraisonReponseAction: (...a: unknown[]) => etat(...a),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { ComposerReponse } from "../ComposerReponse";

beforeEach(() => {
  vi.useFakeTimers();
  repondre.mockReset();
  etat.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function envoyerPuisSonder(statut: string, erreur: string | null = null): Promise<void> {
  repondre.mockResolvedValue({ ok: true, replyId: "r1" });
  etat.mockResolvedValue({ statut, erreur });
  render(
    <ComposerReponse
      applicationId="11111111-1111-1111-1111-111111111111"
      prenom="Amina"
      poste="Monteur"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Répondre au candidat" }));
  fireEvent.change(screen.getByLabelText("Objet"), { target: { value: "Votre candidature" } });
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Bonjour" } });
  fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3_100);
  });
}

describe("ComposerReponse — rebond", () => {
  it("🔴 `bounced` : la phrase de rebond, aucun « Réessayer »", async () => {
    await envoyerPuisSonder("bounced", "550 rejeté");
    expect(screen.getByText(/Adresse refusée par le serveur du destinataire/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Réessayer" })).toBeNull();
    // On peut écrire de nouveau.
    expect((screen.getByRole("button", { name: "Envoyer" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("témoin : `failed` garde « Réessayer »", async () => {
    await envoyerPuisSonder("failed", "délai dépassé");
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy();
  });
});

describe("ComposerReponse — après un envoi réussi", () => {
  it("🔴 aucune confirmation n'est redemandée", async () => {
    const confirmer = vi.spyOn(window, "confirm").mockReturnValue(true);
    await envoyerPuisSonder("sent");
    expect(confirmer).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.queryByRole("button", { name: /confirmer|valider/i })).toBeNull();
    expect(repondre).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Envoyé/)).toBeTruthy();
  });
});
