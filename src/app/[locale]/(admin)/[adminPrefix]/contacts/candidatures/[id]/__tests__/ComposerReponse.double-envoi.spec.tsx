/**
 * Un candidat ne reçoit jamais deux e-mails d'un double clic, et l'écran ne
 * dit « Remise confirmée » que lorsque la remise est réellement confirmée.
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
});

function ouvrirEtRemplir(): HTMLElement {
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
  return screen.getByRole("button", { name: "Envoyer" });
}

describe("ComposerReponse — double envoi", () => {
  it("🔴 deux clics rapprochés n'appellent l'envoi qu'UNE fois", async () => {
    repondre.mockResolvedValue({ ok: true, replyId: "r1" });
    const bouton = ouvrirEtRemplir();
    fireEvent.click(bouton);
    fireEvent.click(bouton);
    await act(async () => {
      await Promise.resolve();
    });
    expect(repondre).toHaveBeenCalledTimes(1);
  });

  it("🔴 le bouton reste verrouillé tant que le message est en file", async () => {
    repondre.mockResolvedValue({ ok: true, replyId: "r1" });
    ouvrirEtRemplir();
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText(/Mise en file/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Envoyer" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));
    expect(repondre).toHaveBeenCalledTimes(1);
  });
});

describe("ComposerReponse — libellé de remise", () => {
  async function jusquAuSondage(statut: string): Promise<void> {
    repondre.mockResolvedValue({ ok: true, replyId: "r1" });
    etat.mockResolvedValue({ statut, erreur: null });
    ouvrirEtRemplir();
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_100);
    });
  }

  it("🔴 `sent` (accepté par le relais) n'affiche PAS « Remise confirmée »", async () => {
    await jusquAuSondage("sent");
    expect(screen.queryByText(/Remise confirmée/)).toBeNull();
    expect(screen.getByText(/Envoyé, en attente de confirmation/)).toBeTruthy();
  });

  it("affiche « Remise confirmée » quand la remise est réellement confirmée", async () => {
    await jusquAuSondage("delivered");
    expect(screen.getByText(/Remise confirmée/)).toBeTruthy();
  });
});
