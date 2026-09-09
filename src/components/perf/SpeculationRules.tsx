"use client";
// use-client: usePathname() + useEffect requis pour gating route /admin/* +
// injection DOM `<script type="speculationrules">` post-hydratation. Server
// component impossible : layout root rendrait dynamique (no-store) et casserait
// le BF-cache + dégraderait LCP. Cf. doctrine V-04 P3 2026-05-22.

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
 *  - SKIP totalement sur la console admin (préfixe rotatif) — évite le conflit
 *    avec les flux RSC de l'admin qui crashaient l'error boundary. La détection
 *    passe par `pageEstConsoleAdmin` ; lire le bloc 2026-09-09 ci-dessous, la
 *    version d'origine de cette garde ne fermait rien.
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
import { pageEstConsoleAdmin, urlPorteUnSecret } from "@/lib/analytics/routes-privees";

/**
 * 🔴 2026-09-09 — LA GARDE « CONSOLE ADMIN » N'A JAMAIS PU ÊTRE VRAIE.
 *
 * Ce module documente depuis le 2026-05-22 qu'il doit sauter la console, parce
 * que les règles de spéculation « crashaient l'error boundary RSC stream » de
 * l'admin le 2026-05-18. Les trois conditions écrites pour cela ne fermaient
 * rien :
 *
 *   1. `pathname.startsWith("/admin/")` — `usePathname()` de `next/navigation`
 *      rend le chemin AVEC le préfixe de locale, et `localePrefix: "always"`.
 *      Aucun chemin de ce site ne commence par `/admin/` : ils commencent tous
 *      par `/fr/`. Cette condition était fausse pour TOUTE URL, console comprise.
 *   2. `urlPorteUnSecret(pathname)` — ne couvre que `/portail`.
 *   3. `adminPrefix && …` — le seul point de montage,
 *      `src/app/[locale]/layout.tsx`, écrit `<SpeculationRules locale={locale} />`
 *      SANS `adminPrefix`. La prop étant facultative, ni TypeScript ni ESLint
 *      n'avaient de raison de le dire.
 *
 * ⟹ Les règles étaient donc injectées sur les ~305 pages de la console, EN
 * PRODUCTION uniquement (`NODE_ENV`), ce qui explique qu'aucune recette locale
 * ne l'ait jamais vu. Et la dernière règle est un attrape-tout
 * (`href_matches: "/{LOCALE}/*"`, `eagerness: "moderate"`) : le navigateur
 * préchargeait les ~150 liens de la barre latérale, chacun étant une page
 * `force-dynamic` lourde — c'est-à-dire exactement la configuration que le
 * 2026-05-18 avait désactivée.
 *
 * 🔑 UNE PROP FACULTATIVE N'EST PAS UNE GARDE. Le comportement sûr dépendait
 * qu'on n'oublie pas de la passer, et l'oubli est silencieux par construction.
 * La garde ne prend donc plus de paramètre : elle lit le DOM, où le layout
 * admin pose déjà sa coquille. Une page ne peut plus « oublier » d'être la
 * console.
 *
 * ⚠️ NE PAS « RÉPARER » CECI EN PASSANT `ADMIN_URL_PREFIX` EN PROP. Le layout
 * `[locale]` est la racine de TOUT le site : la valeur atterrirait dans le HTML
 * des 17 000 pages publiques, et le préfixe secret cesserait d'être secret.
 */
interface SpeculationRulesProps {
  /** Locale courant (fr / en). Passé depuis le Server Layout via prop. */
  locale: string;
}

const RULES = {
  // prerender — pages à pré-rendre dans un tab caché. `moderate` = déclenche
  // au hover/scroll de plus de 200 ms (économe 4G + lecteurs distraits).
  // `/appel` exclu du prerender : booking client-heavy (iframe Calendly),
  // prerender = double-init analytics. Il reste en prefetch ci-dessous.
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
          "/{LOCALE}/appel",
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

export function SpeculationRules({ locale }: SpeculationRulesProps): null {
  const pathname = usePathname();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;

    // Skip sur la console admin (crash du flux RSC, 2026-05-18). Voir le bloc
    // 2026-09-09 en tête de fichier : la garde d'origine ne fermait rien.
    if (pageEstConsoleAdmin(pathname)) return;
    // Pré-charger une URL à jeton la fait entrer dans les journaux du CDN et du
    // serveur pour une page que le visiteur n'ouvrira peut-être jamais.
    if (urlPorteUnSecret(pathname)) return;

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
  }, [pathname, locale]);

  return null;
}
