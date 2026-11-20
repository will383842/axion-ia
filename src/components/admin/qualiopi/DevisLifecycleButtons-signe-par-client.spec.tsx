/**
 * Devis signé par le client, en attente de contresignature : « Marquer accepté », « Marquer
 * refusé » et « Renvoyer par email » (avec son avertissement) disparaissent, une note renvoie à
 * la contresignature. Inchangé sinon. « Renvoyer par email » ne s'affiche plus au statut accepté.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/server/actions/qualiopi/devis-remis-main-propre", () => ({
  marquerRemisEnMainPropreAction: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/devis", () => ({
  sendDevisAction: vi.fn(),
  reviseDevisAction: vi.fn(),
  acceptDevisAction: vi.fn(),
  declineDevisAction: vi.fn(),
  transformDevisToConventionAction: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/facturation-emails", () => ({
  envoyerDevisEmailAction: vi.fn(),
}));

import { DevisLifecycleButtons } from "./DevisLifecycleButtons";

afterEach(cleanup);

const ACCEPTER = { name: /Marquer le devis comme accepté/ };
const REFUSER = { name: /Marquer le devis comme refusé/ };
const RENVOYER = { name: /Renvoyer le devis au client par email/ };

describe("DevisLifecycleButtons — signé par le client", () => {
  it("envoyé + signé : boutons masqués, avertissement masqué, note affichée", () => {
    render(<DevisLifecycleButtons devisId="d" statut="envoye" signeParClient clientASigne />);
    expect(screen.queryByRole("button", ACCEPTER)).toBeNull();
    expect(screen.queryByRole("button", REFUSER)).toBeNull();
    expect(screen.queryByRole("button", RENVOYER)).toBeNull();
    expect(screen.queryByTestId("avertissement-renvoi-lien")).toBeNull();
    expect(screen.getByTestId("note-signe-par-client").textContent).toContain(
      "Le client a signé ce devis. Contresignez-le dans le bloc « Signature électronique » ci-dessus pour le conclure.",
    );
  });

  it("envoyé non signé : inchangé (accepter, refuser, renvoyer, avertissement)", () => {
    render(<DevisLifecycleButtons devisId="d" statut="envoye" />);
    expect(screen.getByRole("button", ACCEPTER)).toBeTruthy();
    expect(screen.getByRole("button", REFUSER)).toBeTruthy();
    expect(screen.getByRole("button", RENVOYER)).toBeTruthy();
    expect(screen.getByTestId("avertissement-renvoi-lien")).toBeTruthy();
    expect(screen.queryByTestId("note-signe-par-client")).toBeNull();
  });

  it("🔴 envoyé À FORMULES signé des deux parties (reprise par relance) : ni note, ni accepter, ni refuser, ni renvoyer, ni corriger", () => {
    render(<DevisLifecycleButtons devisId="d" statut="envoye" clientASigne repriseParRelance />);
    expect(screen.queryByRole("button", ACCEPTER)).toBeNull();
    expect(screen.queryByRole("button", REFUSER)).toBeNull();
    expect(screen.queryByRole("button", RENVOYER)).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Corriger et renvoyer|nouvelle version/ }),
    ).toBeNull();
    expect(screen.queryByTestId("avertissement-renvoi-lien")).toBeNull();
    expect(screen.queryByTestId("note-signe-des-deux-parties")).toBeNull();
    expect(screen.queryByTestId("note-signe-par-client")).toBeNull();
  });

  it("accepté : plus de « Renvoyer par email », « Transformer en convention » reste", () => {
    render(<DevisLifecycleButtons devisId="d" statut="accepte" />);
    expect(screen.queryByRole("button", RENVOYER)).toBeNull();
    expect(screen.getByRole("button", { name: /Transformer le devis accepté/ })).toBeTruthy();
  });

  it("brouillon : le libellé d'aperçu ne parle plus de numéro non attribué", () => {
    render(<DevisLifecycleButtons devisId="d" statut="brouillon" />);
    const apercu = screen.getByRole("link", { name: /Ouvrir l'aperçu PDF du brouillon/ });
    const label = apercu.getAttribute("aria-label") ?? "";
    expect(label).toContain("aucune pièce numérotée créée, rien n'est envoyé");
    expect(label).not.toContain("aucun numéro attribué");
  });

  it("envoyé, signé des deux côtés : « Marquer accepté » reste, refuser et renvoyer masqués, note dédiée", () => {
    render(<DevisLifecycleButtons devisId="d" statut="envoye" signeDesDeuxParties clientASigne />);
    expect(screen.getByRole("button", ACCEPTER)).toBeTruthy();
    expect(screen.queryByRole("button", REFUSER)).toBeNull();
    expect(screen.queryByRole("button", RENVOYER)).toBeNull();
    expect(screen.queryByTestId("avertissement-renvoi-lien")).toBeNull();
    expect(screen.queryByTestId("note-signe-par-client")).toBeNull();
    expect(screen.getByTestId("note-signe-des-deux-parties").textContent).toContain(
      "Ce devis est signé des deux parties, mais son acceptation n'a pas été enregistrée. Cliquez sur « Marquer accepté » pour la finir.",
    );
  });

  it("sans droit d'écrire : l'avertissement du renvoi n'est pas affiché (le bouton est masqué)", () => {
    render(<DevisLifecycleButtons devisId="d" statut="envoye" peutEcrire={false} />);
    expect(screen.queryByRole("button", RENVOYER)).toBeNull();
    expect(screen.queryByTestId("avertissement-renvoi-lien")).toBeNull();
  });

  it("signé des deux côtés, sans droit de conclure : pas de note « Marquer accepté »", () => {
    render(
      <DevisLifecycleButtons
        devisId="d"
        statut="envoye"
        signeDesDeuxParties
        clientASigne
        peutConclure={false}
      />,
    );
    expect(screen.queryByRole("button", ACCEPTER)).toBeNull();
    expect(screen.queryByTestId("note-signe-des-deux-parties")).toBeNull();
  });
});
