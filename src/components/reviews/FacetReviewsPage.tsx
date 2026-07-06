// Corps partagé des pages facettes d'avis (service / ville / secteur / département).
// Hero + breadcrumb + réponse directe (AEO) + synthèse notes + grille + CTA.
// Server Component. Les pages routes résolvent les données + le JSON-LD et
// délèguent le rendu ici (anti-duplication).

import { Section } from "@/components/layout/Section";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { AnswerCard } from "@/components/marketing/AnswerCard";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { Cta } from "@/components/marketing/Cta";
import { ReviewCard } from "./ReviewCard";
import { RatingBreakdown } from "./RatingBreakdown";
import type { PublicReview, AggregateRatingData } from "@/server/reviews/queries";

interface FacetReviewsPageProps {
  eyebrow: string;
  title: string;
  titleEm?: string;
  description: string;
  /** Question + réponse directe (AEO / position 0). */
  answerQuestion: string;
  answerText: string;
  /** Fil d'ariane : libellé + href (string) de la facette courante. */
  breadcrumbLabel: string;
  breadcrumbHref: string;
  reviews: ReadonlyArray<PublicReview>;
  agg?: AggregateRatingData | null;
}

export function FacetReviewsPage({
  eyebrow,
  title,
  titleEm,
  description,
  answerQuestion,
  answerText,
  breadcrumbLabel,
  breadcrumbHref,
  reviews,
  agg,
}: FacetReviewsPageProps) {
  return (
    <>
      <Section
        eyebrow={eyebrow}
        title={title}
        titleEm={titleEm}
        titleAs="h1"
        tone="halo-warm"
        description={description}
      >
        <Breadcrumbs
          items={[
            { href: "/avis", label: "Avis clients" },
            { href: breadcrumbHref, label: breadcrumbLabel },
          ]}
        />
        <div className="mt-6 max-w-2xl">
          <AnswerCard question={answerQuestion}>{answerText}</AnswerCard>
        </div>
      </Section>

      {agg ? (
        <Section tone="sand">
          <RatingBreakdown agg={agg} />
        </Section>
      ) : null}

      <Section tone="canvas">
        <ul className="grid list-none gap-6 p-0 md:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r) => (
            <li key={r.id}>
              <ReviewCard review={r} />
            </li>
          ))}
        </ul>
      </Section>

      <CtaBlock
        title="Vous aussi,"
        titleEm="partagez votre avis"
        description="Aidez d'autres dirigeants à se décider en partageant votre expérience avec Axion-IA."
        tone="mocha"
        cta={
          <Cta href="/avis/deposer" variant="primary">
            Déposer un avis
          </Cta>
        }
      />
    </>
  );
}
