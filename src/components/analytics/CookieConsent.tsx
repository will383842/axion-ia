"use client";
// use-client: lit/écrit localStorage + state UI banner, intrinsèquement client.
//
// CookieConsent — Banner CMP minimaliste RGPD-compliant.
//
// Méta-cert 2026-05-15 AGENT 21 P0-C — gate Microsoft Clarity sur consent
// explicite (cookies `_clck` / `_clsk` + transfert UE→US).
//
// Architecture :
//  - Plausible self-hosted EU (sans cookie) reste TOUJOURS actif — pas de
//    consent requis (avis CNIL/AKI 2022 sur les analytics anonymisés).
//  - Microsoft Clarity (US, cookies persistants) est GATÉ sur consent :
//    le composant `Clarity` ne charge le script qu'après `accepted`.
//  - Stockage : `localStorage.axion-cookie-consent-v1` = "accepted" | "declined"
//    + timestamp pour expiration CNIL 13 mois.
//
// Hook `useAnalyticsConsent()` implémenté via `useSyncExternalStore` (pattern
// canonique React 19 — SSR-safe + subscribe-only, pas de setState dans
// useEffect).
//
// UX :
//  - Banner sticky bottom, terracotta border, fond cream backdrop-blur.
//  - 2 boutons explicites (refus = même hierarchy que accept, doctrine CNIL).
//  - Aucun cookie déposé tant que pas de clic visiteur.

import * as React from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";

export const ANALYTICS_CONSENT_KEY = "axion-cookie-consent-v1";
const ANALYTICS_CONSENT_TS_KEY = "axion-cookie-consent-v1:ts";
const ANALYTICS_CONSENT_EXPIRY_MS = 13 * 30 * 24 * 60 * 60 * 1000; // 13 mois CNIL
const CONSENT_CHANGE_EVENT = "axion-consent-changed";

export type ConsentValue = "accepted" | "declined" | "unknown";

export function readAnalyticsConsent(): ConsentValue {
  if (typeof window === "undefined") return "unknown";
  const stored = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
  const ts = Number(window.localStorage.getItem(ANALYTICS_CONSENT_TS_KEY) ?? "0");
  if (!stored) return "unknown";
  if (ts && Date.now() - ts > ANALYTICS_CONSENT_EXPIRY_MS) {
    // Consent expiré CNIL — re-demander.
    return "unknown";
  }
  return stored === "accepted" ? "accepted" : "declined";
}

function writeConsent(value: "accepted" | "declined"): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
  window.localStorage.setItem(ANALYTICS_CONSENT_TS_KEY, String(Date.now()));
  // Dispatch un événement custom (le `storage` natif ne fire que sur les
  // AUTRES onglets — il faut un custom event sur l'onglet courant pour
  // que `useSyncExternalStore` resubscribe re-render immédiatement).
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: { value } }));
}

function subscribeConsent(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CONSENT_CHANGE_EVENT, onChange);
  // Cross-tab : un autre onglet qui set localStorage déclenche `storage`.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CONSENT_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getServerSnapshot(): ConsentValue {
  return "unknown";
}

/**
 * Hook canonique React 19 pour lire l'état du consent analytics.
 *
 * Implémenté via `useSyncExternalStore` (SSR-safe + subscribe-only). Pas
 * de setState dans useEffect, conforme `react-hooks/set-state-in-effect`.
 */
export function useAnalyticsConsent(): ConsentValue {
  return React.useSyncExternalStore(subscribeConsent, readAnalyticsConsent, getServerSnapshot);
}

export function CookieConsent() {
  const locale = useLocale();
  const isFr = locale === "fr";
  const consent = useAnalyticsConsent();
  // `dismissed` permet de masquer le banner localement (sans re-trigger sur
  // resubscribe) — utile si l'utilisateur clique puis revient sur la page
  // dans la même session sans choix persisté.
  const [dismissed, setDismissed] = React.useState(false);

  const shown = !dismissed && consent === "unknown";

  if (!shown) return null;

  function accept() {
    writeConsent("accepted");
    setDismissed(true);
  }
  function decline() {
    writeConsent("declined");
    setDismissed(true);
  }

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-body"
      className="bg-bg/95 border-terracotta-deep fixed right-0 bottom-0 left-0 z-50 border-t shadow-lg backdrop-blur"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col gap-1">
          <p id="cookie-consent-title" className="text-fg text-base font-semibold tracking-tight">
            {isFr ? "Cookies analytics" : "Analytics cookies"}
          </p>
          <p id="cookie-consent-body" className="text-fg-soft max-w-2xl text-sm leading-snug">
            {isFr
              ? "Plausible (anonyme, EU, sans cookie) est toujours actif. Vous pouvez en plus accepter Microsoft Clarity (heatmaps + session replay anonymisé, transfert UE → US sous SCC) pour nous aider à améliorer l'UX. "
              : "Plausible (anonymous, EU, cookie-less) is always active. You can additionally accept Microsoft Clarity (anonymized heatmaps + session replay, EU → US transfer under SCC) to help us improve UX. "}
            <Link href="/cookies" className="text-terracotta-deep hover:text-terracotta underline">
              {isFr ? "Détails Cookies" : "Cookie details"}
            </Link>
            {" · "}
            <Link
              href="/sous-processeurs"
              className="text-terracotta-deep hover:text-terracotta underline"
            >
              {isFr ? "Sous-processeurs" : "Sub-processors"}
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={decline}
            className="border-border text-fg hover:bg-bg-soft focus-visible:ring-terracotta rounded-md border px-4 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {isFr ? "Refuser" : "Decline"}
          </button>
          <button
            type="button"
            onClick={accept}
            className="bg-terracotta-deep hover:bg-terracotta focus-visible:ring-terracotta rounded-md px-4 py-2 text-sm font-medium text-white transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {isFr ? "Accepter" : "Accept"}
          </button>
        </div>
      </div>
    </div>
  );
}
