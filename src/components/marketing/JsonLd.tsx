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
 * Par défaut : script SSR inline, parsing HTML séquentiel non bloqué pour
 * un schema unique <1 KB. Pour pages avec 2+ schemas ou schema lourd, opt-in
 * `strategy="afterInteractive"` pour déferer après hydratation.
 */
export function JsonLd({ data, strategy = "inline", scriptId }: JsonLdProps) {
  const json = JSON.stringify(data);

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
