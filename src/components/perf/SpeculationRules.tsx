"use client";

/**
 * V-04 P3 (Sprint Correctif suite 2026-05-22) — Speculation Rules custom.
 *
 * Re-active le bloc Speculation Rules désactivé 2026-05-18 (root layout)
 * en isolant la pose côté CLIENT + gating sur route PUBLIQUE uniquement
 * (skip /admin/* qui crashait l'error boundary RSC stream).
 *
 * Stratégie :
 *  - prerender `moderate` sur 14 URLs stratégiques publiques (top nav + CTA).
 *    `moderate` = déclenche au hover/scroll (pas au load), évite saturation 4G.
 *  - prefetch fallback `moderate` sur tout le locale public.
 *  - SKIP totalement si le pathname commence par `/admin/` ou `/<adminPrefix>/`
 *    (= console admin runtime-rotated) — évite le conflit avec les RSC stream
 *    de l'admin qui crashaient l'error boundary.
 *
 * Pourquoi client-side et pas server-side ?
 *  - Au server-side, on n'a pas l'info de la route au moment du render layout
 *    sans rendre la page dynamique (force-dynamic) ce qui dégrade les Web
 *    Vitals et casse le BF-cache.
 *  - Au client-side, on lit `usePathname()` après hydratation et on injecte
 *    le script via DOM API (`document.head.appendChild`). Les browsers
 *    supportent l'ajout dynamique de `<script type="speculationrules">`.
 *  - Bonus CSP : un script injecté par un autre script est autorisé par
 *    `strict-dynamic` sans nonce supplémentaire.
 *
 * Compat browsers :
 *  - Chrome 121+ (Speculation Rules API stable), Edge récent.
 *  - Safari / Firefox : ignorent silencieusement (pas d'erreur, pas de
 *    bénéfice — fallback automatique au prefetch on-hover natif Next 16).
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";

interface SpeculationRulesProps {
  /** Locale courant (fr / en). Passé depuis le Server Layout via prop. */
  locale: string;
  /**
   * Prefixe admin runtime-rotated (env ADMIN_URL_PREFIX). Si le pathname
   * démarre par ce préfixe → skip injection (évite crash error boundary).
   * Si non fourni, on skip uniquement les patterns connus (/admin/*).
   */
  adminPrefix?: string;
}

const RULES = {
  // prerender — pages à pré-rendre dans un tab caché. `moderate` = déclenche
  // au hover/scroll de plus de 200 ms (économe 4G + lecteurs distraits).
  // `/reserver` exclu : booking client-heavy, prerender = double-init analytics.
  prerender: [
    {
      source: "document",
      where: {
        href_matches: [
          "/{LOCALE}",
          "/{LOCALE}/interventions",
          "/{LOCALE}/interventions/*",
          "/{LOCALE}/audit",
          "/{LOCALE}/audit/*",
          "/{LOCALE}/implementation",
          "/{LOCALE}/cas-concrets",
          "/{LOCALE}/methodologie",
          "/{LOCALE}/comparaisons",
          "/{LOCALE}/stack-ia",
          "/{LOCALE}/implantations",
          "/{LOCALE}/implantations/ile-de-france",
          "/{LOCALE}/implantations/ile-de-france/paris",
          "/{LOCALE}/contact",
        ],
      },
      eagerness: "moderate",
    },
  ],
  // prefetch — fallback large pour le reste du locale (RSC payload + JS chunks).
  prefetch: [
    {
      source: "document",
      where: {
        href_matches: [
          "/{LOCALE}",
          "/{LOCALE}/interventions",
          "/{LOCALE}/interventions/*",
          "/{LOCALE}/audit",
          "/{LOCALE}/audit/*",
          "/{LOCALE}/implementation",
          "/{LOCALE}/cas-concrets",
          "/{LOCALE}/methodologie",
          "/{LOCALE}/comparaisons",
          "/{LOCALE}/stack-ia",
          "/{LOCALE}/implantations",
          "/{LOCALE}/implantations/ile-de-france",
          "/{LOCALE}/implantations/ile-de-france/paris",
          "/{LOCALE}/reserver",
          "/{LOCALE}/contact",
        ],
      },
      eagerness: "moderate",
    },
    {
      source: "document",
      where: { href_matches: "/{LOCALE}/*" },
      eagerness: "moderate",
    },
  ],
} as const;

function expandLocale(rules: typeof RULES, locale: string): unknown {
  // Substitue {LOCALE} par la locale réelle dans tous les href_matches.
  const replaceLocale = (s: string): string => s.replaceAll("{LOCALE}", locale);
  const expandMatches = (matches: string | readonly string[]): string | string[] =>
    Array.isArray(matches) ? matches.map(replaceLocale) : replaceLocale(matches as string);
  return {
    prerender: rules.prerender.map((r) => ({
      ...r,
      where: { href_matches: expandMatches(r.where.href_matches) },
    })),
    prefetch: rules.prefetch.map((r) => ({
      ...r,
      where: { href_matches: expandMatches(r.where.href_matches) },
    })),
  };
}

export function SpeculationRules({ locale, adminPrefix }: SpeculationRulesProps): null {
  const pathname = usePathname();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;

    // Skip sur routes admin (RSC stream crash 2026-05-18).
    if (pathname?.startsWith("/admin/")) return;
    if (adminPrefix && pathname?.includes(`/${adminPrefix}/`)) return;

    // Feature detection — browsers sans support ignorent + pas d'overhead.
    if (typeof HTMLScriptElement === "undefined") return;
    if (!HTMLScriptElement.supports || !HTMLScriptElement.supports("speculationrules")) return;

    // Dédoublonnage idempotent — si déjà injecté lors d'une navigation
    // précédente (client-side nav), ne pas ré-injecter.
    const EXISTING_ID = "axion-speculation-rules";
    if (document.getElementById(EXISTING_ID)) return;

    const script = document.createElement("script");
    script.type = "speculationrules";
    script.id = EXISTING_ID;
    script.textContent = JSON.stringify(expandLocale(RULES, locale));
    document.head.appendChild(script);

    return () => {
      // Cleanup au démontage (changement de locale par exemple).
      const existing = document.getElementById(EXISTING_ID);
      if (existing) existing.remove();
    };
  }, [pathname, locale, adminPrefix]);

  return null;
}
