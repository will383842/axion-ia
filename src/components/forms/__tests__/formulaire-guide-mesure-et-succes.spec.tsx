/**
 * Le formulaire du guide, VU PAR LE VISITEUR (lot L1, 2026-09-25).
 *
 * Ce que ce test prouve en rendant vraiment le composant :
 *   1. une demande ACCEPTÉE pose l'événement Plausible « Guide Requested » avec
 *      la provenance, et RIEN d'autre (ni l'adresse, ni sa nature) ;
 *   2. une demande REFUSÉE ne pose aucun événement : on ne compte pas une
 *      conversion qui n'a pas eu lieu ;
 *   3. l'état « envoyé » rappelle l'adresse saisie, et « Ce n'est pas la bonne
 *      adresse ? Saisir la bonne » rouvre le formulaire pré-rempli, focus sur
 *      le champ (une faute de frappe se corrige ICI) ;
 *   5. le jeton Turnstile CONSOMMÉ par une demande acceptée n'est jamais
 *      renvoyé : le widget est remis à zéro, la demande suivante attend un
 *      jeton frais (Turnstile bloquant, D3) ;
 *   6. une demande acceptée prévient la barre collante (événement window).
 *   4. la provenance transmise au serveur est celle du point de collecte
 *      (`guide-ia-bas` pour le second formulaire de la page).
 *
 * Adresses en `@example.invalid` uniquement (dépôt public).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const action = vi.fn();
vi.mock("@/features/guide-ia/actions", () => ({
  demanderGuideAction: (...args: unknown[]) => action(...args),
}));
vi.mock("next-intl", () => ({ useLocale: () => "fr" }));
const resetTurnstile = vi.fn();
vi.mock("@/components/forms/TurnstileWidget", () => ({
  useTurnstileToken: () => ({
    token: "jeton-de-test",
    widget: null,
    reset: resetTurnstile,
    blocked: false,
  }),
}));
const trackEvent = vi.fn();
vi.mock("@/lib/analytics/plausible-tracker", () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}));

import { NewsletterForm } from "../NewsletterForm";
import { libellesFormulaireGuide } from "@/content/guide-ia-formulaire";
import { EVENEMENT_GUIDE_DEMANDE } from "@/lib/analytics/evenement-guide";
import { EVENEMENT_GUIDE_ENVOYE } from "@/components/guide-ia/attribut-formulaire";

const BOUTON_AUTRE_ADRESSE = "Ce n'est pas la bonne adresse ? Saisir la bonne";

const ADRESSE = "dirigeante@entreprise.example.invalid";

function remplirEtEnvoyer(adresse = ADRESSE) {
  fireEvent.input(screen.getByLabelText("Votre e-mail"), { target: { value: adresse } });
  fireEvent.click(screen.getByRole("button", { name: "Recevoir le guide" }));
}

beforeEach(() => {
  action.mockReset();
  trackEvent.mockReset();
  resetTurnstile.mockReset();
});

describe("formulaire du guide — mesure et état envoyé", () => {
  it("le nom de l'événement est celui attendu par Plausible", () => {
    expect(EVENEMENT_GUIDE_DEMANDE).toBe("Guide Requested");
  });

  it("🔴 demande acceptée : « Guide Requested » avec la provenance SEULE", async () => {
    action.mockResolvedValue({ ok: true });
    render(
      <NewsletterForm source="guide-ia-bas" libelles={libellesFormulaireGuide("guide", "fr")} />,
    );
    remplirEtEnvoyer();

    await waitFor(() => expect(trackEvent).toHaveBeenCalledTimes(1));
    expect(trackEvent).toHaveBeenCalledWith("Guide Requested", {
      props: { source: "guide-ia-bas" },
    });
    // Aucune donnée personnelle dans l'événement.
    expect(JSON.stringify(trackEvent.mock.calls)).not.toContain("example.invalid");

    // La provenance part bien au serveur.
    const fd = action.mock.calls[0]![1] as FormData;
    expect(fd.get("source")).toBe("guide-ia-bas");
    expect(fd.get("email")).toBe(ADRESSE);
  });

  it("🔴 demande refusée par le serveur : aucun événement, le message s'affiche", async () => {
    action.mockResolvedValue({ ok: false, error: "Adresse e-mail invalide." });
    render(<NewsletterForm source="guide-ia" libelles={libellesFormulaireGuide("guide", "fr")} />);
    remplirEtEnvoyer();

    expect(await screen.findByText("Adresse e-mail invalide.")).toBeTruthy();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it("l'état envoyé rappelle l'adresse ; « Saisir la bonne » rouvre le formulaire pré-rempli, focus sur le champ", async () => {
    action.mockResolvedValue({ ok: true });
    render(<NewsletterForm source="guide-ia" libelles={libellesFormulaireGuide("guide", "fr")} />);
    remplirEtEnvoyer();

    expect(await screen.findByText("Le guide est en route")).toBeTruthy();
    expect(screen.getByText(ADRESSE)).toBeTruthy();
    // Le focus suit le changement d'état : il est sur l'encadré « envoyé ».
    await waitFor(() =>
      expect(document.activeElement?.textContent).toContain("Le guide est en route"),
    );
    // Jamais « Corriger » : la première demande n'est pas annulée.
    expect(screen.queryByText(/Corriger/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: BOUTON_AUTRE_ADRESSE }));
    const champ = screen.getByLabelText("Votre e-mail") as HTMLInputElement;
    expect(champ.value).toBe(ADRESSE);
    await waitFor(() => expect(document.activeElement).toBe(champ));
    expect(screen.queryByText("Le guide est en route")).toBeNull();
  });

  it("🔴 le jeton Turnstile consommé n'est jamais renvoyé après « Saisir la bonne »", async () => {
    action.mockResolvedValue({ ok: true });
    render(<NewsletterForm source="guide-ia" libelles={libellesFormulaireGuide("guide", "fr")} />);
    remplirEtEnvoyer();
    expect(await screen.findByText("Le guide est en route")).toBeTruthy();
    expect((action.mock.calls[0]![1] as FormData).get("cf-turnstile-response")).toBe(
      "jeton-de-test",
    );
    // Le widget est remis à zéro dès la demande acceptée.
    expect(resetTurnstile).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: BOUTON_AUTRE_ADRESSE }));
    remplirEtEnvoyer("autre@entreprise.example.invalid");
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    const second = action.mock.calls[1]![1] as FormData;
    expect(second.get("email")).toBe("autre@entreprise.example.invalid");
    expect(second.get("cf-turnstile-response")).not.toBe("jeton-de-test");
  });

  it("une demande acceptée prévient la barre collante ; une refusée, non", async () => {
    const ecoute = vi.fn();
    window.addEventListener(EVENEMENT_GUIDE_ENVOYE, ecoute);
    try {
      action.mockResolvedValueOnce({ ok: false, error: "Adresse e-mail invalide." });
      render(
        <NewsletterForm source="guide-ia" libelles={libellesFormulaireGuide("guide", "fr")} />,
      );
      remplirEtEnvoyer();
      expect(await screen.findByText("Adresse e-mail invalide.")).toBeTruthy();
      expect(ecoute).not.toHaveBeenCalled();

      action.mockResolvedValueOnce({ ok: true });
      fireEvent.click(screen.getByRole("button", { name: "Recevoir le guide" }));
      await waitFor(() => expect(ecoute).toHaveBeenCalledTimes(1));
    } finally {
      window.removeEventListener(EVENEMENT_GUIDE_ENVOYE, ecoute);
    }
  });

  it("le champ ouvre le clavier e-mail et la touche « Envoyer » sur mobile", () => {
    render(<NewsletterForm source="guide-ia" libelles={libellesFormulaireGuide("guide", "fr")} />);
    const champ = screen.getByLabelText("Votre e-mail");
    expect(champ.getAttribute("inputmode")).toBe("email");
    expect(champ.getAttribute("enterkeyhint")).toBe("send");
    expect(champ.getAttribute("autocomplete")).toBe("email");
  });
});
