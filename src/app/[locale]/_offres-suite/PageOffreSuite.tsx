// Gabarit commun des quatre pages d'offre de la suite (GEO V2-05 / V2-06). Server Component :
// aucun JS client ajouté, aucune base. L'anglais est désactivé : toute autre locale part vers /fr.

import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { CalendarDays } from "lucide-react";

import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { lienDiagnostic } from "@/content/journee-ia-commun";
import { DATE_MISE_A_JOUR_OFFRES_SUITE, PHRASE_SUR_DEVIS } from "@/content/offres-suite";
import { buildProductMetadata } from "@/lib/seo";

import { TEXTES, type PageOffreSuite } from "./contenu";
import { jsonLdOffreSuite } from "./jsonld";

const H2 = "mb-4 text-[1.5rem] leading-tight font-extrabold tracking-[-0.02em] md:text-[2rem]";
const SECTION = "py-8 md:py-12";
const LIEN =
  "text-terracotta-deep inline-flex min-h-12 items-center font-bold underline underline-offset-4 hover:no-underline";

export async function metadonneesOffreSuite(
  p: PageOffreSuite,
  params: Promise<{ locale: string }>,
): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: p.path,
    title: p.titre,
    description: p.descriptionMeta,
    alternates: { fr: p.path, en: p.path },
    ogImageAlt: `${p.nom} · Axion-IA`,
  });
}

export async function PageOffreSuiteRendue({
  p,
  params,
}: {
  p: PageOffreSuite;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  if (locale !== "fr") permanentRedirect(`/fr${p.path}`);
  setRequestLocale(locale);

  const [service, webPage, faq] = jsonLdOffreSuite(p);
  const dateMaj = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${DATE_MISE_A_JOUR_OFFRES_SUITE}T00:00:00Z`),
  );
  const lienRdv = lienDiagnostic(p.cle);

  return (
    <>
      <section aria-labelledby="hero-heading" className="pt-3 pb-4 sm:pt-6">
        <Container className="max-w-[860px]">
          <Breadcrumbs items={[{ href: p.path, label: p.nom }]} />
          <p className="text-terracotta-deep mt-3 mb-2 text-sm font-bold tracking-wide uppercase">
            {p.surtitre}
          </p>
          <h1
            id="hero-heading"
            className="text-[1.875rem] leading-[1.12] font-extrabold tracking-[-0.025em] text-balance sm:text-[2.75rem]"
          >
            {p.h1}
          </h1>
          <p data-definition className="text-fg mt-4 text-lg leading-snug font-semibold">
            {p.definition}
          </p>
          <p className="text-fg-soft mt-3 text-base leading-snug">{PHRASE_SUR_DEVIS}</p>
          <div className="mt-5">
            <Cta
              href={lienRdv}
              track={`${p.cle}-haut`}
              variant="terracotta"
              size="xl"
              className="w-full sm:w-auto"
            >
              <CalendarDays className="size-5" aria-hidden="true" />
              {TEXTES.cta}
            </Cta>
          </div>
        </Container>
      </section>

      <section aria-labelledby="h-pour-qui" className={SECTION}>
        <Container className="max-w-[860px]">
          <h2 id="h-pour-qui" className={H2}>
            {TEXTES.pourQui}
          </h2>
          <p className="text-fg-soft leading-relaxed">{p.pourQui}</p>
        </Container>
      </section>

      <section aria-labelledby="h-deroule" className={SECTION}>
        <Container className="max-w-[860px]">
          <h2 id="h-deroule" className={H2}>
            {TEXTES.deroule}
          </h2>
          <ol className="list-decimal space-y-2 pl-5 leading-relaxed">
            {p.deroule.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ol>
        </Container>
      </section>

      <section aria-labelledby="h-livrables" className={SECTION}>
        <Container className="max-w-[860px]">
          <h2 id="h-livrables" className={H2}>
            {TEXTES.livrables}
          </h2>
          <ul className="list-disc space-y-2 pl-5 leading-relaxed">
            {p.livrables.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="h-duree" className={SECTION}>
        <Container className="max-w-[860px]">
          <h2 id="h-duree" className={H2}>
            {TEXTES.duree}
          </h2>
          <p className="text-fg-soft leading-relaxed">{p.duree}</p>
          <h2 className={`${H2} mt-8`}>{TEXTES.prix}</h2>
          <p className="text-fg-soft leading-relaxed">{PHRASE_SUR_DEVIS}</p>
        </Container>
      </section>

      <section aria-labelledby="h-faq" className={SECTION}>
        <Container className="max-w-[860px]">
          <h2 id="h-faq" className={H2}>
            Questions fréquentes
          </h2>
          <FaqAccordion
            items={p.faq.map((f) => ({ id: f.id, question: f.question, answer: f.reponse }))}
            emitJsonLd={false}
            ancres
          />
        </Container>
      </section>

      <section aria-labelledby="h-liens" className={SECTION}>
        <Container className="max-w-[860px]">
          <h2 id="h-liens" className={H2}>
            {TEXTES.liens}
          </h2>
          <ul className="flex flex-col">
            <li>
              <Link href="/journee-ia" className={LIEN}>
                {TEXTES.lienJournee}
              </Link>
            </li>
            <li>
              <Link href={lienRdv as never} className={LIEN} data-cta={`${p.cle}-bas`}>
                {TEXTES.lienDiagnostic}
              </Link>
            </li>
          </ul>
          <p className="text-fg-soft mt-6 text-sm">
            {TEXTES.miseAJour} <time dateTime={DATE_MISE_A_JOUR_OFFRES_SUITE}>{dateMaj}</time>.
          </p>
        </Container>
      </section>

      <JsonLd data={service} />
      <JsonLd data={webPage} />
      <JsonLd data={faq} />
    </>
  );
}
