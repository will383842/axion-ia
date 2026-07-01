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
    __axionTurnstileReadyQueue?: Array<(ok: boolean) => void>;
  }
}

const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SCRIPT_ID = "axion-turnstile-script";

// Résout `true` si l'API Turnstile est chargée, `false` si le chargement échoue
// (script bloqué par une extension/DNS, ex. brunhild.challenges.cloudflare.com
// filtré par un bloqueur → net::ERR_NAME_NOT_RESOLVED). Le `false` permet aux
// forms d'afficher un message clair au lieu de « Une erreur est survenue ».
const SCRIPT_LOAD_TIMEOUT_MS = 8000;

function loadTurnstileScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.turnstile) return resolve(true);
    if (window.__axionTurnstileReady) return resolve(true);

    // Timeout de secours : certains bloqueurs avalent la requête sans déclencher
    // `onerror` → sans ce garde-fou, la promesse ne se résoudrait jamais et le
    // form soumettrait sans token en silence. `resolve` étant idempotent, un
    // onload/onerror ultérieur est sans effet.
    const timer = setTimeout(() => resolve(false), SCRIPT_LOAD_TIMEOUT_MS);
    const settle = (ok: boolean) => {
      clearTimeout(timer);
      resolve(ok);
    };

    window.__axionTurnstileReadyQueue ??= [];
    window.__axionTurnstileReadyQueue.push(settle);

    if (document.getElementById(SCRIPT_ID)) return; // already injected

    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = TURNSTILE_SCRIPT;
    s.async = true;
    s.defer = true;
    s.onload = () => {
      window.__axionTurnstileReady = true;
      (window.__axionTurnstileReadyQueue ?? []).forEach((fn) => fn(true));
      window.__axionTurnstileReadyQueue = [];
    };
    s.onerror = () => {
      (window.__axionTurnstileReadyQueue ?? []).forEach((fn) => fn(false));
      window.__axionTurnstileReadyQueue = [];
    };
    document.head.appendChild(s);
  });
}

export interface TurnstileWidgetProps {
  onToken: (token: string) => void;
  onExpire?: () => void;
  /**
   * Appelé quand Turnstile ne peut PAS fonctionner : script bloqué
   * (extension/DNS) ou challenge en échec. Permet au form d'afficher un
   * message clair (« captcha bloqué par une extension ») plutôt qu'une
   * erreur générique après une soumission vouée à échouer.
   */
  onBlocked?: () => void;
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
  onBlocked,
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

    loadTurnstileScript().then((loaded) => {
      if (cancelled) return;
      // Script bloqué (extension/DNS) ou API absente → on prévient le form.
      if (!loaded || !window.turnstile) {
        onBlocked?.();
        return;
      }
      if (!containerRef.current) return;
      if (widgetIdRef.current) return; // already rendered

      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          // Cloudflare a RETIRÉ "invisible" des valeurs de `size` (désormais
          // compact | flexible | normal). Passer size:"invisible" fait lever
          // `TurnstileError: Invalid value for parameter "size"` → render()
          // échoue → AUCUN token n'est émis → « Captcha échoué » même quand le
          // formulaire est bien hydraté. Pour un comportement quasi-invisible
          // avec un widget « Managed », on n'envoie PAS de `size` et on utilise
          // `appearance:"interaction-only"` : le widget ne s'affiche QUE si un
          // défi interactif est requis ; sinon pass silencieux (token sans UI).
          ...(size === "invisible" ? { appearance: "interaction-only" as const } : { size }),
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
            // Challenge en échec (souvent le backend CF bloqué par un
            // bloqueur : brunhild.challenges.cloudflare.com). Le token est
            // vidé ET on signale le blocage pour un message clair.
            onExpire?.();
            onBlocked?.();
          },
        });
      } catch {
        // Render échoue (ex. paramètre invalide) : token vide → on signale.
        onBlocked?.();
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
  }, [siteKey, size, action, disabled, onToken, onExpire, onBlocked]);

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
  /** `true` si Turnstile ne peut pas fonctionner (script/challenge bloqué). */
  blocked: boolean;
} {
  const [token, setToken] = React.useState<string>("");
  const [blocked, setBlocked] = React.useState(false);
  const [resetKey, setResetKey] = React.useState(0);

  const widget = React.useMemo(
    () => (
      <TurnstileWidget
        key={resetKey}
        onToken={(tok) => {
          setBlocked(false);
          setToken(tok);
        }}
        onExpire={() => setToken("")}
        onBlocked={() => setBlocked(true)}
        {...(action !== undefined ? { action } : {})}
      />
    ),
    [resetKey, action],
  );

  const reset = React.useCallback(() => {
    setToken("");
    setBlocked(false);
    setResetKey((k) => k + 1);
  }, []);

  return { token, widget, reset, blocked };
}
