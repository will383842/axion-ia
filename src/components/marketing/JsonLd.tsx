import Script from "next/script";

interface JsonLdProps {
  data: unknown;
  /**
   * V-04 P1 (Sprint Correctif suite 2026-05-22) — Strategy de chargement.
   * - `"inline"` (default) : script SSR/SSG directement dans le HTML.
   *   Visible aux crawlers non-JS (Googlebot pre-rendering, ClaudeBot, GPTBot).
   *   À utiliser pour Organization/WebSite/Article — racine SEO critique.
   * - `"afterInteractive"` : injection différée via next/script après que la
   *   page soit interactive. Réduit TBT/FCP initial. Googlebot (qui exécute
   *   JS) lit le JSON-LD au 2ᵉ pass de rendering. À utiliser pour FAQ,
   *   ItemList, Breadcrumb sur pages secondaires.
   * - `"lazyOnload"` : injection en idle (window.onload). Permissif TBT mais
   *   risque de retarder l'indexation par certains crawlers.
   *
   * Requis si `strategy !== "inline"` : `scriptId` (next/script dédoublonne par id).
   *
   * ⛔ Audit SEO 2026-11-11 (I1) : NE PLUS utiliser `afterInteractive` ni
   * `lazyOnload`. Un JSON-LD injecté après hydratation est ABSENT du HTML servi :
   * les robots qui n'exécutent pas le JavaScript (GPTBot, ClaudeBot,
   * PerplexityBot, première passe de Googlebot) ne le voient pas. Et le gain de
   * TBT invoqué n'existe pas : le navigateur n'exécute pas un script
   * `application/ld+json`. Les valeurs restent typées le temps que les pages
   * villes (autre chantier) migrent ; le verrou
   * `tests/unit/seo/jsonld-dans-le-html-servi.spec.ts` interdit tout nouvel usage.
   */
  strategy?: "inline" | "afterInteractive" | "lazyOnload";
  /**
   * Identifiant unique du `<Script>` injecté. Convention :
   * `jsonld-<page-slug>-<schema-type>` (ex. `jsonld-audit-faq`).
   * Obligatoire dès que `strategy !== "inline"`.
   */
  scriptId?: string;
}

/**
 * Inline Schema.org JSON-LD helper. Server-only (sauf strategy != inline).
 * Emits un seul <script type="application/ld+json"> tag.
 *
 * Par défaut (et seule valeur admise hors pages villes) : script rendu dans le
 * HTML servi, lisible par tout robot, avec ou sans JavaScript.
 */
export function JsonLd({ data, strategy = "inline", scriptId }: JsonLdProps) {
  // « < » échappé : un texte libre (transcription, résumé…) contenant `</script>` ne peut
  // pas fermer la balise. `\u003c` est relu à l'identique par tout parseur JSON.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  if (strategy !== "inline") {
    return (
      <Script
        id={scriptId ?? "jsonld"}
        type="application/ld+json"
        strategy={strategy}
        dangerouslySetInnerHTML={{ __html: json }}
      />
    );
  }

  return (
    <script
      type="application/ld+json"
      // dangerouslySetInnerHTML is the recommended way to inject JSON-LD;
      // we stringify ourselves so React doesn't escape entities.
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
