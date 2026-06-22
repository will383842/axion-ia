import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { getRealTestimonialsOnly } from "@/server/actions/content-gen/real-testimonials";
import type { Locale } from "@/i18n/routing";

interface ArticleSocialProofProps {
  readonly locale: Locale;
  readonly limit?: number;
}

/**
 * Bloc preuve sociale pour les articles (refonte templates 2026-06-22).
 * Décision Will : pas de Trustpilot → on réutilise les VRAIS témoignages déjà
 * publiés et consentis (`getRealTestimonialsOnly`, `isReal` + status published,
 * mêmes que sur /presse). Aucun service tiers, aucun JS additionnel. Server
 * component, stub-safe au build (getter renvoie [] sous stub.invalid), `return
 * null` si aucun témoignage → zéro CLS.
 */
export async function ArticleSocialProof({ locale, limit = 2 }: ArticleSocialProofProps) {
  const all = await getRealTestimonialsOnly();
  const items = all.slice(0, Math.max(1, limit));
  if (items.length === 0) return null;
  const isFr = locale === "fr";

  return (
    <Section tone="sand">
      <Container className="max-w-3xl">
        <p
          data-aeo="social-proof"
          className="text-fg-muted text-sm font-semibold tracking-wide uppercase"
        >
          {isFr ? "Ils nous font confiance" : "Trusted by"}
        </p>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {items.map((t) => {
            const attribution = [
              `${t.firstName} ${t.lastName}`.trim(),
              t.role ?? "",
              t.company ?? "",
            ]
              .filter((s) => s.trim().length > 0)
              .join(" · ");
            return (
              <li key={t.id} className="border-border bg-paper rounded-lg border p-5">
                <blockquote className="text-fg leading-relaxed italic">
                  «&nbsp;{t.shortQuoteFr}&nbsp;»
                </blockquote>
                <p className="text-fg-muted mt-3 text-sm not-italic">— {attribution}</p>
              </li>
            );
          })}
        </ul>
      </Container>
    </Section>
  );
}
