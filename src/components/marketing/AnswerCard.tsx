/**
 * AnswerCard — Canonical Answer / TL;DR block (AEO/GEO 2026).
 *
 * Pattern « Canonical Answer » : encart court (50-80 mots) placé en haut
 * de page, optimisé pour extraction par LLMs (Perplexity, ChatGPT, Bing
 * Copilot, Google AI Overviews / SGE).
 *
 * Signaux émis :
 * - `<aside role="doc-tip" data-aeo="tldr">` — rôle DPub + attribut data-aeo
 *   custom (signal extraction LLM, picked up par Perplexity AEO heuristics).
 * - Classes `.tldr-answer` + `[data-aeo="tldr"]` référencées dans le
 *   Speakable `cssSelector` (`buildSpeakableSpec` / Article + QAPage JSON-LD)
 *   → Google Assistant + Alexa peuvent vocaliser la réponse.
 * - Heading visible « TL;DR » / « In short » (Fraunces serif italique) +
 *   corps sans-serif lisible (Hauteur de lecture courte volontaire).
 *
 * Server component pur — pas d'état, pas de hook client. Bundle impact ~0.
 *
 * Source : audit AEO/GEO 2026-05-15 § 3.5 (Canonical Answers Pattern).
 * Perte estimée sans TL;DR : -25 à -40 % citation rate Perplexity.
 *
 * NB : la page `/faq/[slug]` n'utilise PAS ce composant — la réponse FAQ
 * EST déjà la TL;DR (voir `data-aeo="answer"` dans `/faq/[slug]/page.tsx`).
 */

import { cn } from "@/lib/utils";

interface AnswerCardProps {
  /**
   * Contenu TL;DR — cible 50-80 mots (extraction LLM optimale). Au-delà
   * de ~120 mots, Perplexity tronque et le signal se dilue. Accepte JSX
   * (peut contenir `<strong>`, liens, etc.) ou string.
   */
  readonly children: React.ReactNode;
  /**
   * Question canonique optionnelle — affichée en tête de la carte.
   * Booste signal AEO (pair Q→R explicite, pattern QAPage).
   */
  readonly question?: string;
  /**
   * Label source visible (ex. « Source : doctrine Axion-IA », « INSEE 2024 »).
   * Requis pour citations LLM E-E-A-T 2026 — si la TL;DR cite un chiffre,
   * la source doit être présente sinon Perplexity la flag « unsourced ».
   */
  readonly sourceLabel?: string;
  /**
   * URL source canonique (ex. lien INSEE, article tier-1). Si fourni,
   * `sourceLabel` devient lien — sinon texte simple.
   */
  readonly sourceUrl?: string;
  /**
   * Locale d'affichage — détermine le label heading.
   * - `fr` → « TL;DR »
   * - `en` → « In short »
   * Defaults à `fr` (FR-first doctrine v1.2).
   */
  readonly locale?: "fr" | "en";
  /** Classes additionnelles (rare — la carte est déjà self-contained). */
  readonly className?: string;
}

export function AnswerCard({
  children,
  question,
  sourceLabel,
  sourceUrl,
  locale = "fr",
  className,
}: AnswerCardProps) {
  const isFr = locale === "fr";
  const headingLabel = isFr ? "TL;DR" : "In short";
  const sourcePrefix = isFr ? "Source" : "Source";

  return (
    <aside
      role="doc-tip"
      data-aeo="tldr"
      data-answer
      className={cn(
        // Distinct visuellement du body : bord gauche terracotta 4px
        // + halo warm subtle background + arrondi paper card.
        "bg-halo-warm border-terracotta tldr-answer relative my-8 rounded-2xl border-l-4 px-6 py-5 sm:px-7 sm:py-6",
        className,
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline gap-3">
          <span
            className="text-terracotta-deep text-base leading-none font-medium tracking-tight italic sm:text-lg"
            style={{ fontFamily: "var(--font-serif)" }}
            aria-label={isFr ? "Réponse en bref" : "Short answer"}
          >
            {headingLabel}
          </span>
          {question ? (
            <span className="text-fg-muted text-xs font-medium tracking-wide uppercase">
              {isFr ? "Question" : "Q."}
            </span>
          ) : null}
        </div>
        {question ? (
          <p className="text-fg text-[15px] leading-snug font-semibold tracking-tight">
            {question}
          </p>
        ) : null}
        <div className="text-fg text-[15px] leading-relaxed sm:text-base">{children}</div>
        {sourceLabel ? (
          <p className="text-fg-muted mt-1 text-xs">
            <span aria-hidden="true">↳ </span>
            {sourcePrefix} :{" "}
            {sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-terracotta-deep focus-visible:ring-terracotta rounded-sm underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {sourceLabel}
              </a>
            ) : (
              <span>{sourceLabel}</span>
            )}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
