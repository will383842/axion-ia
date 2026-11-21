/**
 * Un candidat ne reçoit jamais deux e-mails d'un double clic, et l'écran ne
 * dit « Remise confirmée » que lorsque la remise est réellement confirmée.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup, fireEvent, screen, act } from "@testing-library/react";

const repondre = vi.fn();
const etat = vi.fn();
vi.mock("@/features/admin-job-applications/reply-actions", () => ({
  apercuReponseCandidatAction: async () => ({ ok: true, apercu: { html: "<p>Aperçu</p>" } }),
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

async function ouvrirEtRemplir(): Promise<HTMLElement> {
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
  // Voir avant d'envoyer (I2-2) : « Envoyer » ne s'active qu'après l'aperçu exact.
  fireEvent.click(screen.getByRole("button", { name: "Voir l’aperçu exact" }));
  await act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
  return screen.getByRole("button", { name: "Envoyer" });
}

describe("ComposerReponse — double envoi", () => {
  it("🔴 deux clics rapprochés n'appellent l'envoi qu'UNE fois", async () => {
    repondre.mockResolvedValue({ ok: true, replyId: "r1" });
    const bouton = await ouvrirEtRemplir();
    fireEvent.click(bouton);
    fireEvent.click(bouton);
    await act(async () => {
      await Promise.resolve();
    });
    expect(repondre).toHaveBeenCalledTimes(1);
  });

  it("🔴 le bouton reste verrouillé tant que le message est en file", async () => {
    repondre.mockResolvedValue({ ok: true, replyId: "r1" });
    await ouvrirEtRemplir();
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

describe("ComposerReponse — libellé d'envoi", () => {
  async function jusquAuSondage(statut: string): Promise<void> {
    repondre.mockResolvedValue({ ok: true, replyId: "r1" });
    etat.mockResolvedValue({ statut, erreur: null });
    await ouvrirEtRemplir();
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_100);
    });
  }

  it("🔴 `sent` affiche « Envoyé » et jamais « Remise confirmée »", async () => {
    await jusquAuSondage("sent");
    expect(screen.queryByText(/Remise confirmée/)).toBeNull();
    expect(screen.getByText(/Envoyé/)).toBeTruthy();
  });
});

describe("ComposerReponse — worker lent et rouverture", () => {
  async function envoyerPuisAttendre(ms: number): Promise<void> {
    repondre.mockResolvedValue({ ok: true, replyId: "r1" });
    etat.mockResolvedValue({ statut: "pending", erreur: null });
    await ouvrirEtRemplir();
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  it("🔴 après 30 s sans réponse du worker, « Envoyer » se déverrouille avec un avis clair", async () => {
    await envoyerPuisAttendre(30_500);
    expect(screen.getByText(/vérifiez la frise avant de renvoyer/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Envoyer" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("avant 30 s, « Envoyer » reste verrouillé", async () => {
    await envoyerPuisAttendre(10_000);
    expect((screen.getByRole("button", { name: "Envoyer" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  async function envoyerEtConfirmerSent(): Promise<void> {
    repondre.mockResolvedValue({ ok: true, replyId: "r1" });
    etat.mockResolvedValue({ statut: "sent", erreur: null });
    await ouvrirEtRemplir();
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_100);
    });
  }

  it("🔴 choisir un modèle après « envoyé » rouvre l'envoi", async () => {
    await envoyerEtConfirmerSent();
    expect((screen.getByRole("button", { name: "Envoyer" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    const select = screen.getByLabelText("Modèle de départ") as HTMLSelectElement;
    const autre = Array.from(select.options).find((o) => o.value !== select.value);
    fireEvent.change(select, { target: { value: autre?.value } });
    await act(async () => {
      await Promise.resolve();
    });
    // Le texte a changé : l'aperçu est périmé, « Envoyer » attend un nouvel aperçu (I2-2).
    // Une fois revu, l'envoi est rouvert — preuve que la phase « envoyé » a bien été levée.
    fireEvent.click(screen.getByRole("button", { name: "Voir l’aperçu exact" }));
    await act(async () => {
      for (let i = 0; i < 6; i++) await Promise.resolve();
    });
    expect((screen.getByRole("button", { name: "Envoyer" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("🔴 insérer un lien après « envoyé » rouvre l'envoi", async () => {
    repondre.mockResolvedValue({ ok: true, replyId: "r1" });
    etat.mockResolvedValue({ statut: "sent", erreur: null });
    render(
      <ComposerReponse
        applicationId="11111111-1111-1111-1111-111111111111"
        prenom="Amina"
        poste="Monteur"
        liensInsertion={[{ id: "l1", label: "Mon lien", url: "https://exemple.test/a" }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Répondre au candidat" }));
    fireEvent.change(screen.getByLabelText("Objet"), { target: { value: "Votre candidature" } });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Bonjour" } });
    // Voir avant d'envoyer (I2-2) : « Envoyer » ne s'active qu'après l'aperçu exact.
    fireEvent.click(screen.getByRole("button", { name: "Voir l’aperçu exact" }));
    await act(async () => {
      for (let i = 0; i < 6; i++) await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_100);
    });
    expect((screen.getByRole("button", { name: "Envoyer" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.click(screen.getByRole("button", { name: "Mon lien" }));
    // Le texte a changé : l'aperçu est périmé, « Envoyer » attend un nouvel aperçu (I2-2).
    // Une fois revu, l'envoi est rouvert — preuve que la phase « envoyé » a bien été levée.
    fireEvent.click(screen.getByRole("button", { name: "Voir l’aperçu exact" }));
    await act(async () => {
      for (let i = 0; i < 6; i++) await Promise.resolve();
    });
    expect((screen.getByRole("button", { name: "Envoyer" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
});
