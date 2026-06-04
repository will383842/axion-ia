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

/**
 * Canary par page (T-25) : si NEXT_PUBLIC_CHATBOT_PAGES est défini (préfixes de
 * chemin séparés par des virgules), le widget ne monte QUE sur ces pages. Vide /
 * non défini = toutes les pages (rollout global).
 */
function isPageAllowed(): boolean {
  const raw = env.NEXT_PUBLIC_CHATBOT_PAGES?.trim();
  if (!raw) return true;
  if (typeof window === "undefined") return false;
  const path = window.location.pathname;
  return raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .some(
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
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (env.NEXT_PUBLIC_CHATBOT_ENABLED !== "true") return;
    if (!isPageAllowed()) return; // canary par page (T-25)
    return scheduleIdle(() => setReady(true));
  }, []);

  if (env.NEXT_PUBLIC_CHATBOT_ENABLED !== "true" || !ready) return null;
  return <ChatWidgetLazy />;
}
