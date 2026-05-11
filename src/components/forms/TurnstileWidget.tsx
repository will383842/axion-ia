"use client";
// use-client: Cloudflare Turnstile widget injecte script + render dans DOM,
// callback de token nécessite state React → client-only par définition.
// Audit E2E 2026-05-11 P0-CONF-02 — widget Cloudflare Turnstile.
//
// Pattern : composant invisible (size=invisible) qui charge l'API CF Turnstile
// une fois (`turnstile/v0/api.js`), génère un token, et l'expose au form parent
// via `onToken(token)`. Le form parent injecte le token dans FormData sous le
// nom `cf-turnstile-response` (le serveur le lit via `formData.get("cf-turnstile-response")`).
//
// Comportements :
//  - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` absent → composant ne rend rien et
//    n'émet pas de token. Le serveur :
//      * en dev (`NEXT_PUBLIC_APP_ENV=development`) : fail-soft → action passe.
//      * en prod sans secret server : fail-closed → action rejetée.
//    Dans ce dernier cas, set au moins une DEV key sur Coolify (cf.
//    `_AUDIT/E2E-2026-05-09/ACTIONS-WILL-MANUELLES.md`).
//  - site key de TEST CF (`1x...AA`) → token toujours passé.
//  - site key réelle → challenge si suspect, sinon transparent.
//
// Sécurité : Turnstile token expire 5 min après émission. Le composant
// auto-refresh via `expired-callback`.

import * as React from "react";

interface TurnstileGlobal {
  render: (
    container: HTMLElement,
    opts: {
      sitekey: string;
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      "timeout-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
      size?: "normal" | "compact" | "invisible";
      action?: string;
      cData?: string;
      appearance?: "always" | "execute" | "interaction-only";
      execution?: "render" | "execute";
      retry?: "auto" | "never";
      "refresh-expired"?: "auto" | "manual" | "never-expire";
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
  execute: (widgetId: string) => void;
  getResponse: (widgetId: string) => string | undefined;
}

declare global {
  interface Window {
    turnstile?: TurnstileGlobal;
    __axionTurnstileReady?: boolean;
    __axionTurnstileReadyQueue?: Array<() => void>;
  }
}

const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SCRIPT_ID = "axion-turnstile-script";

function loadTurnstileScript(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve();
    if (window.turnstile) return resolve();
    if (window.__axionTurnstileReady) return resolve();

    window.__axionTurnstileReadyQueue ??= [];
    window.__axionTurnstileReadyQueue.push(resolve);

    if (document.getElementById(SCRIPT_ID)) return; // already injected

    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = TURNSTILE_SCRIPT;
    s.async = true;
    s.defer = true;
    s.onload = () => {
      window.__axionTurnstileReady = true;
      (window.__axionTurnstileReadyQueue ?? []).forEach((fn) => fn());
      window.__axionTurnstileReadyQueue = [];
    };
    document.head.appendChild(s);
  });
}

export interface TurnstileWidgetProps {
  onToken: (token: string) => void;
  onExpire?: () => void;
  /** Action label envoyé à CF pour analytics (optionnel). */
  action?: string;
  /** Visible (challenge interactif) ou invisible (managed). Default invisible. */
  size?: "invisible" | "compact" | "normal";
  /** Pour skip le widget côté tests (Playwright peut injecter un token mock). */
  disabled?: boolean;
}

/**
 * Cloudflare Turnstile widget — invisible par défaut.
 * Le form parent doit conserver le token dans son state et le pousser dans
 * FormData sous le nom `cf-turnstile-response`.
 */
export function TurnstileWidget({
  onToken,
  onExpire,
  action,
  size = "invisible",
  disabled = false,
}: TurnstileWidgetProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const widgetIdRef = React.useRef<string | null>(null);
  const siteKey = process.env["NEXT_PUBLIC_TURNSTILE_SITE_KEY"];

  React.useEffect(() => {
    if (disabled) return;
    if (!siteKey) return;
    if (!containerRef.current) return;

    let cancelled = false;

    loadTurnstileScript().then(() => {
      if (cancelled) return;
      if (!window.turnstile) return;
      if (!containerRef.current) return;
      if (widgetIdRef.current) return; // already rendered

      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          size,
          action: action ?? "submit",
          theme: "light",
          retry: "auto",
          "refresh-expired": "auto",
          callback: (token: string) => {
            onToken(token);
          },
          "expired-callback": () => {
            onExpire?.();
          },
          "error-callback": () => {
            onExpire?.();
          },
        });
      } catch {
        // Render échoue silencieusement : le form garde token vide.
        // Le serveur appliquera le bypass DEV / fail-closed selon env.
      }
    });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* noop */
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, size, action, disabled, onToken, onExpire]);

  // Si pas de site key configurée, on rend juste un placeholder vide.
  // En dev ça permet aux forms de soumettre quand même.
  if (!siteKey) return null;

  return <div ref={containerRef} aria-hidden="true" className="turnstile-widget" />;
}

/**
 * Hook pratique : `useTurnstileToken()` → `{ token, widget, reset }`.
 * À utiliser dans les forms qui veulent juste un token avant submit.
 */
export function useTurnstileToken(action?: string): {
  token: string;
  widget: React.ReactElement;
  reset: () => void;
} {
  const [token, setToken] = React.useState<string>("");
  const [resetKey, setResetKey] = React.useState(0);

  const widget = React.useMemo(
    () => (
      <TurnstileWidget
        key={resetKey}
        onToken={setToken}
        onExpire={() => setToken("")}
        {...(action !== undefined ? { action } : {})}
      />
    ),
    [resetKey, action],
  );

  const reset = React.useCallback(() => {
    setToken("");
    setResetKey((k) => k + 1);
  }, []);

  return { token, widget, reset };
}
