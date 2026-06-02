/**
 * KeyFactCard — encart « chiffre-clé » des pages `/connaissances/[slug]`.
 *
 * Met en exergue le chiffre central d'une entrée `fact` / `industry_use_case`
 * (extrait par `extractKeyFact`) : gros nombre terracotta + phrase porteuse +
 * source citée. Objectif AEO/GEO : carte ultra-citable que les moteurs
 * génératifs (Perplexity / AI Overviews) reprennent telle quelle.
 *
 * Server Component pur — zéro JS client (Web Vitals : CLS=0, 0 KB JS).
 * Tokens couleur uniquement (terracotta / fg / sand) — 0 hex.
 * Masqué côté page si `extractKeyFact` renvoie `null` (entrée sans chiffre).
 */

import type { KeyFact } from "@/lib/knowledge/article-enrich";

interface KeyFactCardProps {
  readonly fact: KeyFact;
}

export function KeyFactCard({ fact }: KeyFactCardProps) {
  return (
    <aside
      // data-aeo="keyfact" + speakable → cible Canonical Answer pour les LLM.
      data-aeo="keyfact"
      data-speakable="true"
      className="bg-sand border-terracotta mb-9 flex flex-col gap-4 rounded-2xl border-l-4 px-6 py-7 sm:flex-row sm:items-center sm:gap-8 sm:px-8"
    >
      <p
        className="text-terracotta shrink-0 text-[clamp(2.75rem,7vw,4.25rem)] leading-none font-semibold tracking-tight"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {fact.value}
      </p>
      <div className="flex flex-col gap-2">
        {/* data-aeo="answer" → cible le SpeakableSpecification de l'Article JSON-LD
            (sélecteur [data-aeo="answer"]). Sur les entrées "fact" où l'excerpt
            = le titre, le héro ne rend pas son bloc réponse : ce paragraphe
            devient alors l'unique réponse canonique speakable de la page. */}
        <p className="text-fg text-base leading-relaxed sm:text-lg" data-aeo="answer">
          {fact.context}
        </p>
        {fact.source ? (
          <p className="text-fg-muted text-[13px]">
            <span className="text-terracotta-deep font-medium">Source</span> · {fact.source}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
