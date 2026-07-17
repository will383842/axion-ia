"use client";
// use-client: lit/écrit le consent (localStorage + cookie) — intrinsèquement client.
//
// CookieConsentControl — contrôle de retrait/modification du consentement, à
// afficher sur `/preferences-cookies`.
//
// RGPD art. 7.3 : le retrait du consentement doit être aussi simple que son
// octroi. Jusqu'ici la page annonçait « modifiable à tout moment » sans
// exposer aucun contrôle : une fois le banner refermé, un visiteur n'avait
// plus AUCUN moyen UI de revenir sur son choix. C'est le seul point de
// contrôle réel du consent hors banner.
//
// Les boutons sont `disabled` tant que l'hydratation n'a pas eu lieu : leurs
// `onClick` n'existent pas encore, on ne montre donc pas de boutons morts
// (même cause racine que le bug du banner). Le markup est identique dans les
// deux états → aucun reflow, CLS 0.

import { useLocale } from "next-intl";
import {
  resetAnalyticsConsent,
  useAnalyticsConsent,
  useIsHydrated,
  writeAnalyticsConsent,
} from "./CookieConsent";

const BTN_BASE =
  "rounded-md px-4 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export function CookieConsentControl() {
  const isFr = useLocale() === "fr";
  const consent = useAnalyticsConsent();
  const isHydrated = useIsHydrated();

  const status = !isHydrated
    ? isFr
      ? "Lecture de votre choix…"
      : "Reading your choice…"
    : consent === "accepted"
      ? isFr
        ? "Vous avez accepté Microsoft Clarity. Les cookies _clck et _clsk sont déposés."
        : "You accepted Microsoft Clarity. The _clck and _clsk cookies are set."
      : consent === "declined"
        ? isFr
          ? "Vous avez refusé Microsoft Clarity. Aucun cookie de mesure n'est déposé."
          : "You declined Microsoft Clarity. No measurement cookie is set."
        : isFr
          ? "Aucun choix enregistré. Le bandeau vous est proposé à la visite."
          : "No choice recorded. The banner is shown on your visit.";

  return (
    <div className="border-border bg-bg-soft/50 space-y-4 rounded-lg border p-5">
      <div className="space-y-1">
        <p className="text-fg text-base font-semibold tracking-tight">
          {isFr ? "Votre choix actuel" : "Your current choice"}
        </p>
        <p className="text-fg-soft text-sm leading-snug" aria-live="polite" aria-busy={!isHydrated}>
          {status}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!isHydrated || consent === "accepted"}
          onClick={() => writeAnalyticsConsent("accepted")}
          className={`bg-terracotta-deep hover:bg-terracotta focus-visible:ring-terracotta text-white ${BTN_BASE}`}
        >
          {isFr ? "Accepter Clarity" : "Accept Clarity"}
        </button>
        <button
          type="button"
          disabled={!isHydrated || consent === "declined"}
          onClick={() => writeAnalyticsConsent("declined")}
          className={`border-border text-fg hover:bg-bg-soft focus-visible:ring-terracotta border ${BTN_BASE}`}
        >
          {isFr ? "Refuser Clarity" : "Decline Clarity"}
        </button>
        <button
          type="button"
          disabled={!isHydrated || consent === "unknown"}
          onClick={resetAnalyticsConsent}
          className={`text-fg-soft hover:text-fg focus-visible:ring-terracotta underline ${BTN_BASE}`}
        >
          {isFr ? "Réinitialiser mon choix" : "Reset my choice"}
        </button>
      </div>
    </div>
  );
}
