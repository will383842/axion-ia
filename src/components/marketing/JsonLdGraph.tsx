/**
 * JsonLdGraph — combine plusieurs schemas Schema.org en un seul script
 * `<script type="application/ld+json">` via la convention `@graph`.
 *
 * Pourquoi ? Audit Web Vitals 2026-05-15 (AGENT 1 §1.6) a mesuré jusqu'à
 * **1 047 ms de doc parse** sur les pages pSEO villes à cause de 5+ scripts
 * JSON-LD inline. Chaque `<script>` ajoute du parsing HTML séquentiel.
 *
 * Solution : un seul script `@graph` est :
 * - explicitement supporté par Google, Bing, schema.org
 * - plus rapide à parser (1 passe vs N)
 * - plus compact en bytes (un seul `"@context"` partagé)
 *
 * V-04 P0i (Sprint Correctif 2026-05-22) — opt-in `strategy="afterInteractive"`
 * via `next/script`. Permet aux pages pSEO lourdes (ville × service ~17 200 SSG)
 * de déférer l'injection JSON-LD jusqu'à hydratation, retirant le bloc du
 * parsing HTML initial (-300 à -500 ms TBT mesuré audit). Googlebot exécute JS
 * (parsing ld+json garanti côté SEO). Pour les schemas critiques où l'on doute
 * de la capacité crawler à executer JS (LLM bots), garder `strategy="inline"`.
 *
 * Référence : <https://schema.org/Graph> + <https://developers.google.com/search/docs/appearance/structured-data/json-ld>.
 */

import Script from "next/script";

interface JsonLdGraphProps {
  /**
   * Liste hétérogène de schemas Schema.org. Les schemas qui possèdent leur
   * propre `@context` à la racine voient ce champ retiré (le `@graph` parent
   * fixe le context une seule fois).
   */
  schemas: ReadonlyArray<Record<string, unknown> | null | undefined | false>;
  /**
   * V-04 P0i — Strategy de chargement du `<script>` JSON-LD.
   * - `"inline"` (default) : script rendu directement dans le HTML (SSR/SSG).
   *   Visible aux crawlers non-JS (Googlebot pre-rendering, ClaudeBot, GPTBot).
   * - `"afterInteractive"` : injection différée via `next/script` après que la
   *   page soit interactive. Réduit TBT initial. Googlebot (qui exécute JS)
   *   continue à voir le JSON-LD après rendering JS pass.
   * - `"lazyOnload"` : injection en idle (window.onload). Plus permissif TBT
   *   mais risque de retarder l'indexation initiale par certains bots.
   *
   * Recommandation : `"afterInteractive"` pour pages pSEO ville × service
   * (4 schemas+, ~3 KB JSON), `"inline"` (default) pour Organization/WebSite
   * (critique SEO racine).
   */
  strategy?: "inline" | "afterInteractive" | "lazyOnload";
  /**
   * `id` unique pour le `<Script>` Next.js. Requis si `strategy !== "inline"`.
   * Convention : `jsonld-<page>-<service>` (ex. `jsonld-ville-paris-audit`).
   */
  scriptId?: string;
}

export function JsonLdGraph({ schemas, strategy = "inline", scriptId }: JsonLdGraphProps) {
  const cleaned = schemas
    .filter((s): s is Record<string, unknown> => Boolean(s))
    .map((s) => {
      // Retire `@context` redondant — le `@graph` parent le fixe.
      // Préserve `@id` qui sert d'identifiant cross-références dans le graph.
      const { ["@context"]: _unused, ...rest } = s;
      return rest;
    });

  if (cleaned.length === 0) return null;

  const payload = {
    "@context": "https://schema.org",
    "@graph": cleaned,
  };
  const json = JSON.stringify(payload);

  // Defer via next/script — id obligatoire pour identifier le script injecté
  // (next/script dédoublonne par id si plusieurs JsonLdGraph cohabitent).
  if (strategy !== "inline") {
    return (
      <Script
        id={scriptId ?? "jsonld-graph"}
        type="application/ld+json"
        strategy={strategy}
        dangerouslySetInnerHTML={{ __html: json }}
      />
    );
  }

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
