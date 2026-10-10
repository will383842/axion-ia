/**
 * La mesure de la page « C'est noté » (2026-10-10) : `SubmitApplication` du pixel
 * part avec l'`eventID` décidé par le SERVEUR, et seulement avec la bannière
 * acceptée. Sans identifiant (personne déjà connue, lead suspect…), rien.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

const { trackFunnel, submit, consent } = vi.hoisted(() => ({
  trackFunnel: vi.fn(),
  submit: vi.fn(),
  consent: { valeur: "accepted" as string },
}));
vi.mock("@/lib/tracking", () => ({ trackFunnel }));
vi.mock("@/lib/analytics/meta-pixel", () => ({ trackMetaSubmitApplication: submit }));
vi.mock("@/components/analytics/CookieConsent", () => ({
  readAnalyticsConsent: () => consent.valeur,
}));

import { VslMerciMesure } from "../VslMerciMesure";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  consent.valeur = "accepted";
});

describe("VslMerciMesure", () => {
  it("tire `SubmitApplication` avec l'eventID du serveur quand la bannière est acceptée", () => {
    render(<VslMerciMesure landing="video" candidatureEventId="candidature:lead-1" />);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith("candidature:lead-1");
    expect(trackFunnel).toHaveBeenCalledWith("Call Booking Viewed", { landing: "video" });
  });

  it("rien sans consentement accepté, rien sans identifiant", () => {
    consent.valeur = "declined";
    render(<VslMerciMesure landing="video" candidatureEventId="candidature:lead-1" />);
    cleanup();
    consent.valeur = "accepted";
    render(<VslMerciMesure landing="video" candidatureEventId={null} />);
    render(<VslMerciMesure landing="video" />);
    expect(submit).not.toHaveBeenCalled();
  });
});
