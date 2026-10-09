/**
 * L6 — LE COMPOSEUR UNIQUE CÔTÉ FUTUR APPORTEUR.
 *
 * Même panneau que pour un candidat, mais : modèles du réseau, aucun mot de
 * recrutement à l'écran, kit et présentation seulement (ni « Depuis mon
 * ordinateur », ni case de dépôt), rien à joindre si la bibliothèque est
 * éteinte ou la personne opposée (`bibliotheque={null}`).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/features/admin-submissions/reply-actions", () => ({
  replyToSubmissionAction: vi.fn(),
  retryFailedReplyAction: vi.fn(),
  getReplyDeliveryStatusAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { ComposerReponseApporteur } from "@/components/admin/contacts/ComposerReponseApporteur";
import { motsInterditsApporteur } from "@/lib/commercial-application/vocabulaire-apporteur";

afterEach(cleanup);

const KIT = {
  id: "33333333-3333-4333-8333-333333333333",
  titre: "Kit-apporteur.pdf",
  categorie: "kit_apporteur",
  libelleCategorie: "Kit apporteur",
  taille: 1000,
  tailleLisible: "1 ko",
  enAnalyse: false,
};

function ouvrir(bibliotheque: (typeof KIT)[] | null) {
  const r = render(
    <ComposerReponseApporteur
      submissionId="11111111-1111-4111-8111-111111111111"
      prenom="Nadine"
      bibliotheque={bibliotheque}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Répondre" }));
  return r;
}

describe("ComposerReponseApporteur", () => {
  it("propose les modèles du réseau et remplit le prénom", () => {
    ouvrir([KIT]);
    fireEvent.change(screen.getByLabelText("Modèle de départ"), {
      target: { value: "presentation-reseau" },
    });
    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toMatch(
      /^Bonjour Nadine,/,
    );
  });

  it("aucun mot de recrutement à l'écran, panneau ouvert et modèles déroulés", () => {
    const { container } = ouvrir([KIT]);
    expect(motsInterditsApporteur(container.textContent ?? "")).toEqual([]);
  });

  it("joindre : bibliothèque seule, jamais « Depuis mon ordinateur » ni dépôt", async () => {
    ouvrir([KIT]);
    fireEvent.click(screen.getByRole("button", { name: "Joindre des fichiers" }));
    expect(await screen.findByText("Kit-apporteur.pdf")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Depuis mon ordinateur/ })).toBeNull();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.queryByRole("checkbox", { name: /déposer/i })).toBeNull();
  });

  it("bibliothèque éteinte ou personne opposée : aucun bouton « Joindre des fichiers »", () => {
    ouvrir(null);
    expect(screen.queryByRole("button", { name: "Joindre des fichiers" })).toBeNull();
  });
});
