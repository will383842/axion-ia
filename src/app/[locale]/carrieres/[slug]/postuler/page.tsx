// Page candidature /carrieres/[slug]/postuler — formulaire pré-rempli par offre.
// noindex,follow (page formulaire). Server Component + JobApplicationForm (client).

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata } from "@/lib/seo";
import { getJobOfferBySlug, isOfferOpen } from "@/lib/careers/job-offers";
import {
  JobApplicationForm,
  type ScreeningQuestion,
} from "@/components/forms/JobApplicationForm";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  const offer = await getJobOfferBySlug(slug);
  const title = offer
    ? isFr
      ? offer.titleFr
      : offer.titleEn
    : isFr
      ? "offre"
      : "role";
  const base = buildProductMetadata({
    locale: locale as Locale,
    path: `/carrieres/${slug}/postuler`,
    title: isFr
      ? `Postuler · ${title} · Axion-IA`
      : `Apply · ${title} · Axion-IA`,
    description: isFr
      ? "Postulez en quelques minutes — CV optionnel."
      : "Apply in a few minutes — CV optional.",
  });
  return { ...base, robots: { index: false, follow: true } };
}

export default async function PostulerPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const isFr = locale === "fr";

  const offer = await getJobOfferBySlug(slug);
  if (!offer || !isOfferOpen(offer)) notFound();

  const title = isFr ? offer.titleFr : offer.titleEn;
  const screeningQuestions: ScreeningQuestion[] = Array.isArray(
    offer.screeningQuestions,
  )
    ? (offer.screeningQuestions as unknown as ScreeningQuestion[])
    : [];

  return (
    <Section tone="paper">
      <Container>
        <Breadcrumbs
          items={[
            { href: "/carrieres", label: isFr ? "Carrières" : "Careers" },
            { href: `/carrieres/${offer.slug}`, label: title },
            {
              href: `/carrieres/${offer.slug}/postuler`,
              label: isFr ? "Candidature" : "Application",
            },
          ]}
        />
        <h1 className="mt-6 font-serif text-3xl font-semibold sm:text-4xl">
          {isFr ? "Postuler" : "Apply"}
        </h1>
        <p className="text-fg-muted mt-2">
          {isFr ? "Tu postules à :" : "You're applying to:"}{" "}
          <strong>{title}</strong>
        </p>
        <div className="mt-8 max-w-2xl">
          <JobApplicationForm
            offerId={offer.id}
            offerTitle={title}
            requiresDriverLicense={offer.requiresDriverLicense}
            requiresVehicle={offer.requiresVehicle}
            screeningQuestions={screeningQuestions}
          />
        </div>
      </Container>
    </Section>
  );
}
