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
import { JobApplicationForm, type ScreeningQuestion } from "@/components/forms/JobApplicationForm";

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
  const title = offer ? (isFr ? offer.titleFr : offer.titleEn) : isFr ? "offre" : "role";
  const base = await buildProductMetadata({
    locale: locale as Locale,
    path: `/carrieres/${slug}/postuler`,
    title: isFr ? `Postuler · ${title} · Axion-IA.com` : `Apply · ${title} · Axion-IA.com`,
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
  const screeningQuestions: ScreeningQuestion[] = Array.isArray(offer.screeningQuestions)
    ? (offer.screeningQuestions as unknown as ScreeningQuestion[])
    : [];

  return (
    <Section tone="halo-cool">
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

        <div className="mx-auto mt-8 max-w-2xl text-center">
          <p className="text-terracotta text-sm font-semibold tracking-wide uppercase">
            {isFr ? "On a hâte de te lire 👀" : "Can't wait to read you 👀"}
          </p>
          <h1 className="mt-3 font-serif text-4xl font-semibold sm:text-5xl">
            {isFr ? (
              <>
                Postule en <em className="text-terracotta italic">quelques minutes</em>
              </>
            ) : (
              <>
                Apply in <em className="text-terracotta italic">a few minutes</em>
              </>
            )}
          </h1>
          <p className="text-fg-muted mt-4 text-lg">
            {isFr ? "Tu postules à " : "You're applying to "}
            <strong className="text-fg">{title}</strong>.
          </p>
          <ul className="text-fg-muted mt-5 flex flex-wrap justify-center gap-2 text-sm">
            {(isFr
              ? [
                  "📄 CV optionnel",
                  "⚡ Réponse rapide",
                  "🙌 Process simple",
                  "🔒 Données protégées",
                ]
              : ["📄 CV optional", "⚡ Fast reply", "🙌 Simple process", "🔒 Data protected"]
            ).map((chip) => (
              <li key={chip} className="border-border bg-paper rounded-full border px-3 py-1">
                {chip}
              </li>
            ))}
          </ul>
        </div>

        <div className="border-border bg-paper shadow-card mx-auto mt-8 max-w-2xl rounded-3xl border p-6 sm:p-9">
          <JobApplicationForm
            offerId={offer.id}
            requiresDriverLicense={offer.requiresDriverLicense}
            requiresVehicle={offer.requiresVehicle}
            screeningQuestions={screeningQuestions}
          />
        </div>
      </Container>
    </Section>
  );
}
