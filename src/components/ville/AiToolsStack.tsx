/**
 * AiToolsStack — Stack d'outils IA enseignés par Axion-IA en formation.
 *
 * Sprint Quality 2026 best practices — Will 2026-05-25.
 *
 * Logos officiels téléchargés depuis simpleicons.org / iconify.design (CC0 / MIT).
 * Stockés dans `public/logos/ai-tools/*.svg`. Pour les outils sans logo accessible
 * en CDN open-source (Voyage AI, Sora, Veo, Runway, Pika), on rend un wordmark
 * textuel stylé.
 *
 * Note juridique : enseigner à utiliser ces outils ≠ partenariat. Pas de claim
 * de partenariat sous-entendu dans le composant.
 *
 * SEO / a11y / 2026 best practices appliquées :
 *  - SVG préféré à WebP pour les logos (vectoriel, net à tous DPR/zoom, ~300-1700 B/fichier)
 *  - <img> natif (pas next/image — bloque SVG par défaut sans dangerouslyAllowSVG)
 *  - width/height attributes (anti-CLS)
 *  - loading="lazy" + decoding="async"
 *  - <figure>/<figcaption sr-only> sémantique par logo
 *  - <ul role="list"> + aria-label
 *  - JSON-LD ItemList (Google semantic + AI Overviews)
 *  - Pas de hover-translate (les tiles ne sont pas interactives → pas de fausse affordance)
 */

/* eslint-disable @next/next/no-img-element -- SVG icons servis statiquement, pas besoin de next/image (qui bloque les SVG par défaut sans dangerouslyAllowSVG). */

interface AiTool {
  readonly name: string;
  readonly categoryFr: string;
  readonly categoryEn: string;
  /** Path vers SVG dans /public/logos/ai-tools/. Si absent → wordmark texte. */
  readonly logo?: string;
}

const AI_TOOLS: ReadonlyArray<AiTool> = [
  {
    name: "Claude",
    categoryFr: "Texte & raisonnement",
    categoryEn: "Text & reasoning",
    logo: "/logos/ai-tools/anthropic.svg",
  },
  {
    name: "ChatGPT",
    categoryFr: "Texte & raisonnement",
    categoryEn: "Text & reasoning",
    logo: "/logos/ai-tools/openai.svg",
  },
  {
    name: "Gemini",
    categoryFr: "Texte & multimodal",
    categoryEn: "Text & multimodal",
    logo: "/logos/ai-tools/googlegemini.svg",
  },
  {
    name: "Mistral",
    categoryFr: "Modèles européens",
    categoryEn: "EU models",
    logo: "/logos/ai-tools/mistralai.svg",
  },
  {
    name: "DALL·E",
    categoryFr: "Génération d'images",
    categoryEn: "Image generation",
    logo: "/logos/ai-tools/openai.svg",
  },
  { name: "Sora · Veo · Runway", categoryFr: "Génération vidéo", categoryEn: "Video generation" },
  {
    name: "GitHub Copilot",
    categoryFr: "Code & développement",
    categoryEn: "Code & dev",
    logo: "/logos/ai-tools/githubcopilot.svg",
  },
  { name: "Voyage AI", categoryFr: "Embeddings & search", categoryEn: "Embeddings & search" },
];

/** JSON-LD ItemList — signale à Google + AI Overviews quels outils on enseigne. */
function buildAiToolsItemListJsonLd(isFr: boolean): string {
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: isFr
      ? "Outils IA enseignés par Axion-IA en formation"
      : "AI tools taught by Axion-IA in training",
    description: isFr
      ? "Stack d'outils d'intelligence artificielle pratiques enseignés en formation par Axion-IA (sans relation commerciale avec ces marques)."
      : "Stack of practical AI tools taught in training sessions by Axion-IA (no commercial relationship with these brands).",
    numberOfItems: AI_TOOLS.length,
    itemListElement: AI_TOOLS.map((tool, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      item: {
        "@type": "SoftwareApplication",
        name: tool.name,
        applicationCategory: isFr ? tool.categoryFr : tool.categoryEn,
      },
    })),
  };
  return JSON.stringify(itemList);
}

interface AiToolsStackProps {
  readonly isFr: boolean;
}

export function AiToolsStack({ isFr }: AiToolsStackProps) {
  return (
    <div className="mt-10">
      <p className="text-fg-muted mb-5 text-[12px] font-semibold tracking-[0.16em] uppercase">
        <span className="bg-terracotta mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle" />
        {isFr ? "Outils IA enseignés en formation" : "AI tools taught in training"}
      </p>
      <ul
        role="list"
        aria-label={isFr ? "Outils IA enseignés par Axion-IA" : "AI tools taught by Axion-IA"}
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4"
      >
        {AI_TOOLS.map((tool) => (
          <li
            key={tool.name}
            className="bg-bg border-border-strong/30 flex items-center gap-3 rounded-xl border px-3 py-3 sm:px-4"
          >
            <figure className="bg-paper flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
              {tool.logo ? (
                <img
                  src={tool.logo}
                  alt={`Logo de ${tool.name}`}
                  width={28}
                  height={28}
                  loading="lazy"
                  decoding="async"
                  className="h-7 w-7 object-contain"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="text-fg text-base font-bold"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {tool.name.charAt(0)}
                </span>
              )}
              <figcaption className="sr-only">{tool.name}</figcaption>
            </figure>
            <div className="min-w-0 flex-1">
              <span
                className="text-fg block truncate text-[14px] leading-tight font-semibold tracking-tight"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {tool.name}
              </span>
              <span className="text-fg-muted block truncate text-[10px] leading-snug">
                {isFr ? tool.categoryFr : tool.categoryEn}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-fg-muted mt-4 text-xs leading-relaxed">
        {isFr
          ? "Liste non-exhaustive. Aucun partenariat commercial avec ces marques — nous enseignons à les utiliser."
          : "Non-exhaustive list. No commercial partnership with these brands — we teach how to use them."}
      </p>
      {/* JSON-LD ItemList — Google semantic + AI Overviews + Voice */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildAiToolsItemListJsonLd(isFr) }}
      />
    </div>
  );
}
