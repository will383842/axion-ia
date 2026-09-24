/**
 * Le formulaire du guide, VU PAR LE VISITEUR (lot L1, 2026-09-25).
 *
 * Ce que ce test prouve en rendant vraiment le composant :
 *   1. une demande ACCEPTÉE pose l'événement Plausible « Guide Requested » avec
 *      la provenance, et RIEN d'autre (ni l'adresse, ni sa nature) ;
 *   2. une demande REFUSÉE ne pose aucun événement : on ne compte pas une
 *      conversion qui n'a pas eu lieu ;
 *   3. l'état « envoyé » rappelle l'adresse saisie, et « Corriger l'adresse »
 *      rouvre le formulaire pré-rempli (une faute de frappe se corrige ICI) ;
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
vi.mock("@/components/forms/TurnstileWidget", () => ({
  useTurnstileToken: () => ({ token: "jeton-de-test", widget: null, reset: () => {} }),
}));
const trackEvent = vi.fn();
vi.mock("@/lib/analytics/plausible-tracker", () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}));

import { NewsletterForm } from "../NewsletterForm";
import { libellesFormulaireGuide } from "@/content/guide-ia-formulaire";
import { EVENEMENT_GUIDE_DEMANDE } from "@/lib/analytics/evenement-guide";

const ADRESSE = "dirigeante@entreprise.example.invalid";

function remplirEtEnvoyer(adresse = ADRESSE) {
  fireEvent.input(screen.getByLabelText("Votre e-mail"), { target: { value: adresse } });
  fireEvent.click(screen.getByRole("button", { name: "Recevoir le guide" }));
}

beforeEach(() => {
  action.mockReset();
  trackEvent.mockReset();
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

  it("l'état envoyé rappelle l'adresse, et « Corriger l'adresse » rouvre le formulaire pré-rempli", async () => {
    action.mockResolvedValue({ ok: true });
    render(<NewsletterForm source="guide-ia" libelles={libellesFormulaireGuide("guide", "fr")} />);
    remplirEtEnvoyer();

    expect(await screen.findByText("Le guide est en route")).toBeTruthy();
    expect(screen.getByText(ADRESSE)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Corriger l'adresse" }));
    const champ = (await screen.findByLabelText("Votre e-mail")) as HTMLInputElement;
    expect(champ.value).toBe(ADRESSE);
  });

  it("le champ ouvre le clavier e-mail et la touche « Envoyer » sur mobile", () => {
    render(<NewsletterForm source="guide-ia" libelles={libellesFormulaireGuide("guide", "fr")} />);
    const champ = screen.getByLabelText("Votre e-mail");
    expect(champ.getAttribute("inputmode")).toBe("email");
    expect(champ.getAttribute("enterkeyhint")).toBe("send");
    expect(champ.getAttribute("autocomplete")).toBe("email");
  });
});
