/**
 * AiContentDisclaimer — Bandeau visible AI Act EU art. 50 disclosure.
 *
 * Méta-cert 2026-05-15 AGENT 20 P0-1 — l'AI Act EU 2024/1689 art. 50 §4
 * impose une divulgation « in a clear and distinguishable manner at the
 * first interaction » pour tout contenu IA-assisté. Le JSON-LD machine-
 * readable (`disambiguatingDescription` + `creator` + `usageInfo` posés
 * par `buildArticleBase`) est nécessaire mais non suffisant — l'utilisateur
 * humain doit voir la mention.
 *
 * Pattern : bloc compact terracotta-soft, placé en bas d'article (après
 * le body et avant CtaBlock), avec lien vers /transparence (hub IA Act
 * EU + persona Manon + sous-processeurs IA).
 *
 * Server component pur — pas de hook, pas de state, bundle impact ~0.
 *
 * Routes couvertes (méta-cert AGENT 20) :
 *  - `/actualites/[slug]` (NewsArticle factory)
 *  - `/blog/[slug]` (BlogPosting factory)
 *  - `/centre-aide/[slug]` (HelpArticle factory)
 *  - `/guides/[slug]` (Guide pilier factory)
 */

import { Link } from "@/i18n/navigation";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AiContentDisclaimerProps {
  readonly locale: "fr" | "en";
  readonly className?: string;
}

export function AiContentDisclaimer({ locale, className }: AiContentDisclaimerProps) {
  const isFr = locale === "fr";
  const headline = isFr ? "Contenu IA-assisté" : "AI-assisted content";
  const body = isFr
    ? "Cet article a été rédigé avec l'assistance de modèles d'IA générative (OpenAI GPT-4o, Anthropic Claude, Perplexity Sonar) puis supervisé par l'équipe Axion-IA avant publication. Conformément à l'article 50 du Règlement européen sur l'IA (AI Act 2024/1689)."
    : "This article was drafted with the assistance of generative AI models (OpenAI GPT-4o, Anthropic Claude, Perplexity Sonar) and then supervised by the Axion-IA team prior to publication. In accordance with article 50 of the EU AI Act (2024/1689).";
  const linkLabel = isFr ? "En savoir plus sur la transparence IA →" : "Learn more about AI transparency →";

  return (
    <aside
      role="doc-tip"
      data-aeo="ai-disclosure"
      className={cn(
        "bg-halo-warm border-terracotta my-8 rounded-2xl border-l-4 px-6 py-5 sm:px-7 sm:py-6",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <Sparkles
          aria-hidden="true"
          className="text-terracotta-deep mt-1 h-5 w-5 shrink-0"
          strokeWidth={2}
        />
        <div className="flex flex-col gap-2">
          <p
            className="text-terracotta-deep text-base leading-none font-medium tracking-tight italic sm:text-lg"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {headline}
          </p>
          <p className="text-fg-soft text-[14px] leading-relaxed sm:text-[15px]">{body}</p>
          <Link
            href="/transparence"
            className="text-terracotta-deep hover:text-terracotta focus-visible:ring-terracotta mt-1 text-sm font-medium underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {linkLabel}
          </Link>
        </div>
      </div>
    </aside>
  );
}
