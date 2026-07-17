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
//    consent requis (avis CNIL 2022 sur les analytics anonymisés).
//  - Microsoft Clarity (US, cookies persistants) est GATÉ sur consent :
//    le composant `Clarity` ne charge le script qu'après `accepted`.
//  - Stockage : `localStorage.axion-cookie-consent-v1` = "accepted" | "declined"
//    + timestamp pour expiration CNIL 13 mois, avec repli cookie first-party.
//
// Hook `useAnalyticsConsent()` implémenté via `useSyncExternalStore` (pattern
// canonique React 19 — SSR-safe + subscribe-only, pas de setState dans
// useEffect).
//
// UX :
//  - Banner sticky bottom, terracotta border, fond cream backdrop-blur.
//  - 2 boutons explicites (refus = même hierarchy que accept, doctrine CNIL).
//  - Aucun cookie déposé tant que pas de clic visiteur.
//
// ⚠️ Le banner n'est JAMAIS rendu côté serveur (cf. `useIsHydrated`). Le HTML
// des 17k routes SSG est servi par Cloudflare (`cf-cache-status: HIT`) donc
// peint en ~100 ms, alors que les `onClick` React n'existent qu'une fois le
// bundle du layout hydraté (~284 KB gz / 22 chunks). Rendre le banner au SSR
// ouvrait une fenêtre de plusieurs centaines de ms (desktop) à quelques
// secondes (mobile 4G) pendant laquelle il était visible mais MORT au clic —
// c'était la cause du bug « le bandeau ne se ferme pas, parfois ».

import * as React from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";

export const ANALYTICS_CONSENT_KEY = "axion-cookie-consent-v1";
const ANALYTICS_CONSENT_TS_KEY = "axion-cookie-consent-v1:ts";
const ANALYTICS_CONSENT_EXPIRY_MS = 13 * 30 * 24 * 60 * 60 * 1000; // 13 mois CNIL
const CONSENT_CHANGE_EVENT = "axion-consent-changed";

export type ConsentValue = "accepted" | "declined" | "unknown";
export type ConsentChoice = "accepted" | "declined";

/**
 * Snapshot mémoire = SOURCE DE VÉRITÉ UNIQUE du consent.
 *
 * Auparavant le composant maintenait deux états concurrents (`dismissed` en
 * state React + la valeur localStorage), qui pouvaient diverger : si
 * `setItem` throw (iOS « Bloquer tous les cookies », quota, navigation
 * privée), le banner était masqué par `dismissed` mais rien n'était persisté
 * → au rechargement suivant il revenait, indéfiniment.
 *
 * Désormais le choix vit d'abord ici (module-level : survit aux remounts et
 * aux navigations client), et la persistance est best-effort par-dessus.
 * `null` = pas encore lu depuis le stockage.
 */
let snapshot: ConsentValue | null = null;

/** Réinitialise le cache mémoire — réservé aux tests. */
export function __resetConsentSnapshotForTests(): void {
  snapshot = null;
}

function isFresh(ts: number): boolean {
  // ts absent (0) = ancienne écriture sans timestamp → considérée valide.
  return !ts || Date.now() - ts <= ANALYTICS_CONSENT_EXPIRY_MS;
}

function normalize(raw: string | null | undefined): ConsentChoice | null {
  if (raw === "accepted") return "accepted";
  if (raw === "declined") return "declined";
  return null;
}

function readLocalStorage(): ConsentValue | null {
  try {
    const stored = normalize(window.localStorage.getItem(ANALYTICS_CONSENT_KEY));
    if (!stored) return null;
    const ts = Number(window.localStorage.getItem(ANALYTICS_CONSENT_TS_KEY) ?? "0");
    return isFresh(ts) ? stored : "unknown"; // expiré CNIL → re-demander
  } catch {
    // Sprint A11y 2026-05-17 — localStorage peut throw en mode privé
    // Safari historique ou si quota dépassé. Fail-soft = on tente le cookie.
    return null;
  }
}

/**
 * Repli cookie first-party. Couvre les cas où `localStorage` est indisponible
 * mais les cookies passent, et l'éviction ITP de Safari (qui purge
 * localStorage après 7 jours sans interaction, mais pas ce cookie).
 *
 * Stocker le choix de consentement est lui-même exempté de consentement
 * (ePrivacy — strictement nécessaire ; la CNIL l'admet explicitement).
 * Format : `accepted|1720000000`.
 */
function readCookie(): ConsentValue | null {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${ANALYTICS_CONSENT_KEY}=([^;]*)`));
    const raw = match?.[1];
    if (!raw) return null;
    const [rawValue, rawTs] = decodeURIComponent(raw).split("|");
    const stored = normalize(rawValue);
    if (!stored) return null;
    return isFresh(Number(rawTs ?? "0")) ? stored : "unknown";
  } catch {
    return null;
  }
}

function readPersisted(): ConsentValue {
  return readLocalStorage() ?? readCookie() ?? "unknown";
}

export function readAnalyticsConsent(): ConsentValue {
  if (typeof window === "undefined") return "unknown";
  snapshot ??= readPersisted();
  return snapshot;
}

function persist(value: ConsentChoice, ts: number): void {
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
    window.localStorage.setItem(ANALYTICS_CONSENT_TS_KEY, String(ts));
  } catch {
    // Fail-soft — le cookie ci-dessous prend le relais.
  }
  try {
    const maxAge = Math.floor(ANALYTICS_CONSENT_EXPIRY_MS / 1000);
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${ANALYTICS_CONSENT_KEY}=${encodeURIComponent(`${value}|${ts}`)}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
  } catch {
    // Fail-soft — le snapshot mémoire garde le choix pour cet onglet.
  }
}

function clearPersisted(): void {
  try {
    window.localStorage.removeItem(ANALYTICS_CONSENT_KEY);
    window.localStorage.removeItem(ANALYTICS_CONSENT_TS_KEY);
  } catch {
    // Fail-soft.
  }
  try {
    document.cookie = `${ANALYTICS_CONSENT_KEY}=; path=/; max-age=0; SameSite=Lax`;
  } catch {
    // Fail-soft.
  }
}

function emit(): void {
  // Le `storage` natif ne fire que sur les AUTRES onglets — il faut un custom
  // event sur l'onglet courant pour que `useSyncExternalStore` re-render.
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT));
}

/**
 * Enregistre le choix visiteur.
 *
 * Le snapshot mémoire est mis à jour AVANT la persistance et l'event est émis
 * dans tous les cas : même si localStorage ET le cookie échouent, le banner se
 * ferme et le choix tient pour la session — on ne bloque jamais l'UI sur le
 * stockage.
 */
export function writeAnalyticsConsent(value: ConsentChoice): void {
  if (typeof window === "undefined") return;
  snapshot = value;
  persist(value, Date.now());
  emit();
}

/** Retrait du consentement (RGPD art. 7.3) — ré-affiche le banner. */
export function resetAnalyticsConsent(): void {
  if (typeof window === "undefined") return;
  snapshot = "unknown";
  clearPersisted();
  emit();
}

function subscribeConsent(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onSameTab = () => onChange();
  const onOtherTab = () => {
    // Un autre onglet a écrit : invalider le cache pour relire le stockage.
    snapshot = null;
    onChange();
  };
  window.addEventListener(CONSENT_CHANGE_EVENT, onSameTab);
  // Cross-tab : un autre onglet qui set localStorage déclenche `storage`.
  window.addEventListener("storage", onOtherTab);
  return () => {
    window.removeEventListener(CONSENT_CHANGE_EVENT, onSameTab);
    window.removeEventListener("storage", onOtherTab);
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

const subscribeNoop = () => () => {};
const snapshotTrue = () => true;
const snapshotFalse = () => false;

/**
 * `false` au SSR et pendant le rendu d'hydratation, `true` ensuite.
 *
 * Même pattern `useSyncExternalStore` que ci-dessus (donc pas de setState dans
 * un effect, conforme `react-hooks/set-state-in-effect`) : React utilise
 * `getServerSnapshot` pour le rendu d'hydratation — qui matche donc le HTML —
 * puis re-render avec `true` une fois hydraté.
 */
export function useIsHydrated(): boolean {
  return React.useSyncExternalStore(subscribeNoop, snapshotTrue, snapshotFalse);
}

export function CookieConsent() {
  const locale = useLocale();
  const isFr = locale === "fr";
  const consent = useAnalyticsConsent();
  const isHydrated = useIsHydrated();

  // Tant que l'hydratation n'a pas eu lieu, les `onClick` ne sont pas
  // attachés : afficher le banner reviendrait à montrer des boutons morts.
  if (!isHydrated || consent !== "unknown") return null;

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
            onClick={() => writeAnalyticsConsent("declined")}
            className="border-border text-fg hover:bg-bg-soft focus-visible:ring-terracotta rounded-md border px-4 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {isFr ? "Refuser" : "Decline"}
          </button>
          <button
            type="button"
            onClick={() => writeAnalyticsConsent("accepted")}
            className="bg-terracotta-deep hover:bg-terracotta focus-visible:ring-terracotta rounded-md px-4 py-2 text-sm font-medium text-white transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {isFr ? "Accepter" : "Accept"}
          </button>
        </div>
      </div>
    </div>
  );
}
