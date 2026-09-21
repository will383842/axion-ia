/**
 * Le formulaire court du tunnel apporteurs ne promet plus d'appel (décision
 * Will 2026-09-19, B4).
 *
 * 🔴 POURQUOI. La page, son bouton, sa case de consentement et l'e-mail qui
 * suit disaient tous qu'on RAPPELAIT la personne. Or depuis le même jour,
 * l'échange de 15 minutes part sur invitation, depuis la console, aux seuls
 * profils retenus : promettre un appel à chacun, c'était annoncer un service
 * qu'on ne rend pas — et faire signer un consentement à un traitement (le
 * démarchage téléphonique) qui n'a pas lieu.
 *
 * Deuxième correction portée par la même case : « jamais transmises » était
 * faux. Les coordonnées vont à nos sous-traitants (envoi d'e-mails,
 * notification interne de l'équipe) ; ce qui est vrai, c'est qu'elles ne sont
 * ni vendues ni cédées. D'où une NOUVELLE version de consentement : la preuve
 * enregistrée doit pointer vers le texte que la personne a réellement coché.
 *
 * On rend le VRAI formulaire et on lit ce qu'il affiche : la case, le bouton,
 * et le message d'erreur qu'on voit en oubliant la case.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/features/commercial-application/lead-actions", () => ({
  submitLeadApporteurAction: vi.fn(async () => ({ ok: true, submissionId: "x" })),
}));
vi.mock("next-intl", () => ({ useLocale: () => "fr" }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

import { LeadApporteurForm } from "../LeadApporteurForm";
import {
  FORMULAIRE,
  HERO,
  MERCI,
  TUNNEL_FACEBOOK_META,
} from "@/content/recrutement/tunnel-facebook";
import { LEAD_APPORTEUR_CONSENT_VERSION } from "@/lib/commercial-application/lead-apporteur";

/** Toute promesse d'appel sortant, apostrophe droite ou typographique. */
const PROMESSE_D_APPEL = /rappel|(?:on|qu['’]on) (?:t|m)['’]appel|appel\sde\snotre/i;

describe("le formulaire court ne promet plus d'appel", () => {
  it("la case de consentement : ni rappel, ni « jamais transmises », 24 mois après la clôture", () => {
    expect(FORMULAIRE.consent).not.toMatch(/rappel/i);
    expect(FORMULAIRE.consent).not.toMatch(/jamais transmises/i);
    expect(FORMULAIRE.consent).toMatch(/m'écrive au sujet du réseau d'apporteurs d'affaires/);
    expect(FORMULAIRE.consent).toMatch(/24 mois après la clôture de mon dossier/);
    expect(FORMULAIRE.consent).toMatch(/jamais vendues ni cédées/);
  });

  it("aucun texte du tunnel ne promet d'appel", () => {
    for (const texte of [
      TUNNEL_FACEBOOK_META.title,
      HERO.cta,
      FORMULAIRE.titre,
      ...FORMULAIRE.points,
      FORMULAIRE.bouton,
      FORMULAIRE.micro,
      MERCI.description,
    ]) {
      expect(texte, texte).not.toMatch(PROMESSE_D_APPEL);
    }
    expect(HERO.cta).toBe("Recevoir le kit");
    expect(FORMULAIRE.bouton).toBe("Recevoir le kit");
  });

  it("le formulaire RENDU : la case, le bouton, et l'erreur de la case oubliée", async () => {
    const { container } = render(<LeadApporteurForm />);
    await userEvent.click(screen.getByRole("button", { name: /Recevoir le kit/ }));
    expect(await screen.findByText("Coche la case pour qu'on puisse t'écrire.")).toBeTruthy();
    // Tout ce que la personne voit, erreurs comprises, avant d'avoir rien envoyé.
    expect(container.textContent ?? "").not.toMatch(PROMESSE_D_APPEL);
    expect(container.textContent ?? "").not.toMatch(/jamais transmises/i);
  });

  it("nouvelle version du consentement : la preuve pointe vers le nouveau texte", () => {
    expect(LEAD_APPORTEUR_CONSENT_VERSION).toBe("lead-apporteur-facebook-v2-2026-09-19");
  });
});
