"use client";
// use-client: requestIdleCallback + next/dynamic ssr:false (île idle).
//
// ChatWidgetMount (T-08) — point de montage du widget dans le layout public.
//
// Objectifs Web Vitals (AGENTS.md) :
//  - Hors First Load JS : ce wrapper est minuscule ; le vrai widget
//    (`ChatWidget` + hook + parsing SSE) est chargé en CHUNK SÉPARÉ via
//    `next/dynamic({ ssr: false })`, et seulement APRÈS `requestIdleCallback`
//    (fallback setTimeout pour Safari < 18, même patron que
//    `instrumentation-client.ts`). → zéro octet de widget dans le bundle SSR
//    initial, zéro impact LCP/TBT above-the-fold.
//  - CLS 0 : aucun rendu tant que l'idle n'a pas eu lieu ; quand le widget
//    apparaît il est `position: fixed` (hors flux) → aucun reflow.
//
// Kill-switch : gated sur `NEXT_PUBLIC_CHATBOT_ENABLED === "true"`. Tant que
// Will n'active pas le flag (D-PROD), le composant ne monte RIEN et n'émet
// aucune requête réseau. La route serveur reste de toute façon gardée par
// `CHATBOT_ENABLED` (503 sinon).

import * as React from "react";
import dynamic from "next/dynamic";
import { env } from "@/env";

const ChatWidgetLazy = dynamic(
  () =>
    import(/* webpackChunkName: "chatbot-widget" */ "./ChatWidget").then((mod) => ({
      default: mod.ChatWidget,
    })),
  { ssr: false },
);

interface WidgetConfig {
  enabled: boolean;
  pages: string[];
}

/** Canary par page : ["*"] ou vide = toutes les pages ; sinon préfixes autorisés. */
function isPageAllowed(pages: ReadonlyArray<string>): boolean {
  if (!pages || pages.length === 0 || pages.includes("*")) return true;
  if (typeof window === "undefined") return false;
  const path = window.location.pathname;
  return pages.some(
    (prefix) =>
      path === prefix ||
      path.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`) ||
      path.startsWith(prefix),
  );
}

function scheduleIdle(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const w = window as typeof window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (typeof w.requestIdleCallback === "function") {
    const id = w.requestIdleCallback(cb, { timeout: 3000 });
    return () => w.cancelIdleCallback?.(id);
  }
  // Fallback Safari < 18 (~5% trafic mobile), même patron qu'instrumentation-client.
  const id = window.setTimeout(cb, 3000);
  return () => window.clearTimeout(id);
}

export function ChatWidgetMount() {
  const [config, setConfig] = React.useState<WidgetConfig | null>(null);

  // Garde BUILD-TIME « feature déployée » (NEXT_PUBLIC_CHATBOT_ENABLED) : tant
  // qu'elle est ≠ "true", on ne fait AUCUN fetch (zéro coût site-wide). Une fois
  // posée à la mise en service, le pilotage FIN — on/off + canary par page — est
  // RUNTIME via /api/chatbot/widget-config (ChatTenant.actif + reglages.pages),
  // modifiable depuis la console SANS redéploiement. Le kill-switch maître reste
  // l'env serveur CHATBOT_ENABLED (l'endpoint renvoie enabled:false sinon).
  React.useEffect(() => {
    if (env.NEXT_PUBLIC_CHATBOT_ENABLED !== "true") return;
    let cancelled = false;
    const cancelIdle = scheduleIdle(() => {
      fetch("/api/chatbot/widget-config")
        .then((r) => (r.ok ? (r.json() as Promise<WidgetConfig>) : null))
        .then((c) => {
          if (!cancelled && c) setConfig(c);
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, []);

  if (env.NEXT_PUBLIC_CHATBOT_ENABLED !== "true") return null;
  if (!config?.enabled) return null;
  if (!isPageAllowed(config.pages)) return null;
  return <ChatWidgetLazy />;
}
