/**
 * « JOINDRE DES FICHIERS » N'EXISTE QUE SI LA BIBLIOTHÈQUE EST ALLUMÉE (Candidatures unifiées L5).
 *
 * La page passe `partages={null}` tant que le compartiment et la clé des liens
 * manquent : aucun bouton, aucun texte. Allumée, le bouton apparaît et annonce
 * qu'un lien part à la place d'une pièce jointe ; le panneau, lui, est chargé
 * à la demande (non testé ici : import dynamique).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/features/admin-job-applications/reply-actions", () => ({
  repondreAuCandidatAction: vi.fn(),
  rejouerReponseEchoueeAction: vi.fn(),
  etatLivraisonReponseAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { ComposerReponse } from "../ComposerReponse";

afterEach(cleanup);

function ouvrir(partages: { bibliotheque: [] } | null): void {
  render(
    <ComposerReponse
      applicationId="11111111-1111-1111-1111-111111111111"
      prenom="Amina"
      poste="Monteur vidéo"
      partages={partages}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Répondre au candidat" }));
}

describe("ComposerReponse — joindre des fichiers", () => {
  it("bibliothèque éteinte : aucun bouton « Joindre des fichiers »", () => {
    ouvrir(null);
    expect(screen.queryByRole("button", { name: "Joindre des fichiers" })).toBeNull();
    expect(screen.queryByText(/lien personnel/)).toBeNull();
  });

  it("bibliothèque allumée : le bouton existe, et le texte dit « lien, jamais pièce jointe »", () => {
    ouvrir({ bibliotheque: [] });
    expect(screen.getByRole("button", { name: "Joindre des fichiers" })).toBeTruthy();
    expect(screen.getByText(/jamais en\s+pièce jointe/)).toBeTruthy();
  });

  it("L5b : sans fichier joint, aucune case « déposer sa version » (pas de lien, pas de dépôt)", () => {
    ouvrir({ bibliotheque: [] });
    expect(screen.queryByRole("checkbox", { name: /déposer sa version/ })).toBeNull();
  });
});
