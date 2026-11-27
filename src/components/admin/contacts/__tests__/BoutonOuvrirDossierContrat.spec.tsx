// « Ouvrir le dossier et envoyer le contrat » : JAMAIS d'envoi en un clic.
// Le 1er clic n'appelle que l'aperçu (lecture seule) ; seul « Confirmer » envoie.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/components/admin/ui/LecteurEmail", () => ({
  LecteurEmail: ({ titre }: { titre: string }) => <div>{titre}</div>,
}));

const apercu = vi.fn();
const envoyer = vi.fn();
vi.mock("@/features/admin-rendezvous/apercu-contrat-apporteur", () => ({
  apercuContratApporteurAction: (...a: unknown[]) => apercu(...a),
}));
vi.mock("@/features/admin-rendezvous/issue-apporteur-actions", () => ({
  ouvrirDossierEtEnvoyerLienAction: (...a: unknown[]) => envoyer(...a),
}));

import { BoutonOuvrirDossierContrat } from "../BoutonOuvrirDossierContrat";

const OK_APERCU = {
  etat: "apercu",
  sujet: "Votre dossier",
  destinataire: "a***@x.fr",
  apercu: {},
};

async function cliquerSurLeBouton(): Promise<void> {
  render(<BoutonOuvrirDossierContrat calendlyEventId="evt_1" />);
  fireEvent.click(screen.getByRole("button", { name: /Ouvrir le dossier et envoyer le contrat/ }));
}

beforeEach(() => {
  vi.clearAllMocks();
  apercu.mockResolvedValue(OK_APERCU);
  envoyer.mockResolvedValue({ etat: "ok", message: "Dossier ouvert. Lien envoyé." });
});

describe("BoutonOuvrirDossierContrat", () => {
  it("🔴 le 1er clic demande l'aperçu et N'ENVOIE JAMAIS", async () => {
    await cliquerSurLeBouton();
    await screen.findByText(/Aperçu : Votre dossier/);
    expect(apercu).toHaveBeenCalledWith({ calendlyEventId: "evt_1" });
    expect(envoyer).not.toHaveBeenCalled();
  });

  it("seul « Confirmer » envoie", async () => {
    await cliquerSurLeBouton();
    fireEvent.click(await screen.findByRole("button", { name: /Confirmer/ }));
    await waitFor(() => expect(envoyer).toHaveBeenCalledTimes(1));
    expect(envoyer).toHaveBeenCalledWith({ calendlyEventId: "evt_1" });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("« Annuler » n'envoie rien et ramène le bouton initial", async () => {
    await cliquerSurLeBouton();
    fireEvent.click(await screen.findByRole("button", { name: "Annuler" }));
    expect(envoyer).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /Ouvrir le dossier et envoyer le contrat/ }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Confirmer/ })).toBeNull();
  });

  it("une erreur d'aperçu n'affiche pas « Confirmer »", async () => {
    apercu.mockResolvedValue({ etat: "erreur", message: "Un dossier existe déjà." });
    await cliquerSurLeBouton();
    await screen.findByText("Un dossier existe déjà.");
    expect(screen.queryByRole("button", { name: /Confirmer/ })).toBeNull();
    expect(envoyer).not.toHaveBeenCalled();
  });
});
