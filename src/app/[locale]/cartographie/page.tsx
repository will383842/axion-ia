// Cartographie de l'entreprise : page statique, serveur seulement (aucun composant client, aucune base).
// Tout le texte vient de `contenu.ts`, qui importe les sources uniques (Journée IA, accueil). Aucun
// prix, aucun témoignage. La langue anglaise est désactivée : toute autre locale part vers /fr.

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
import { lienDiagnostic, remplacerJetons } from "@/content/journee-ia-commun";
import { buildProductMetadata } from "@/lib/seo";

import {
  DATE_MISE_A_JOUR_CARTOGRAPHIE,
  DEFINITION,
  DESCRIPTION_META,
  FAQ,
  OG_IMAGE_ALT,
  PATH,
  TEXTES,
  TITRE,
} from "./contenu";
import { jsonLdCartographie } from "./jsonld";

export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: PATH,
    title: TITRE,
    description: DESCRIPTION_META,
    alternates: { fr: PATH, en: PATH },
    ogImageAlt: OG_IMAGE_ALT,
  });
}

const H2 = "mb-4 text-[1.5rem] leading-tight font-extrabold tracking-[-0.02em] md:text-[2rem]";
const SECTION = "py-8 md:py-12";
const LIEN =
  "text-terracotta-deep inline-flex min-h-12 items-center font-bold underline underline-offset-4 hover:no-underline";

export default async function CartographiePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  if (locale !== "fr") permanentRedirect(`/fr${PATH}`);
  setRequestLocale(locale);

  const [serviceJsonLd, webPageJsonLd, faqJsonLd] = jsonLdCartographie();
  const dateMaj = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${DATE_MISE_A_JOUR_CARTOGRAPHIE}T00:00:00Z`),
  );
  const faqItems = FAQ.map((f) => ({
    id: f.id,
    question: f.question,
    answer: remplacerJetons(f.reponse),
  }));
  const lienRdv = lienDiagnostic("cartographie");

  return (
    <>
      <section aria-labelledby="hero-heading" className="pt-3 pb-4 sm:pt-6">
        <Container className="max-w-[860px]">
          <Breadcrumbs items={[{ href: PATH, label: TEXTES.filAriane }]} />
          <p className="text-terracotta-deep mt-3 mb-2 text-sm font-bold tracking-wide uppercase">
            {TEXTES.surtitre}
          </p>
          <h1
            id="hero-heading"
            className="text-[1.875rem] leading-[1.12] font-extrabold tracking-[-0.025em] text-balance sm:text-[2.75rem]"
          >
            {TEXTES.h1}
          </h1>
          <p data-definition className="text-fg mt-4 text-lg leading-snug font-semibold">
            {DEFINITION}
          </p>
          <p className="text-fg-soft mt-3 text-base leading-snug">{TEXTES.principe}</p>
          <div className="mt-5">
            <Cta
              href={lienRdv}
              track="cartographie-haut"
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
            {TEXTES.pourQui.titre}
          </h2>
          <p className="text-fg-soft leading-relaxed">{TEXTES.pourQui.texte}</p>
        </Container>
      </section>

      <section aria-labelledby="h-deroule" className={SECTION}>
        <Container className="max-w-[860px]">
          <h2 id="h-deroule" className={H2}>
            {TEXTES.deroule.titre}
          </h2>
          <p className="text-fg-soft mb-4 leading-relaxed">{TEXTES.deroule.intro}</p>
          <ol className="flex flex-col gap-3">
            {TEXTES.deroule.etapes.map((e) => (
              <li key={e.moment} className="border-sand-deep bg-paper rounded-xl border p-4">
                <p className="text-terracotta-deep text-sm font-bold">{e.moment}</p>
                <p className="mt-1 leading-relaxed">{e.texte}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section aria-labelledby="h-recu" className={SECTION}>
        <Container className="max-w-[860px]">
          <h2 id="h-recu" className={H2}>
            {TEXTES.recu.titre}
          </h2>
          <ul className="list-disc space-y-2 pl-5 leading-relaxed">
            {TEXTES.recu.elements.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="h-exemple" className={SECTION}>
        <Container className="max-w-[860px]">
          <h2 id="h-exemple" className={H2}>
            {TEXTES.exemple.titre}
          </h2>
          <p className="text-fg-soft mb-3 leading-relaxed">{TEXTES.exemple.intro}</p>
          <ul className="list-disc space-y-1 pl-5 leading-relaxed">
            {TEXTES.exemple.lignes.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <p className="mt-3 font-semibold">{TEXTES.exemple.total}</p>
        </Container>
      </section>

      <section aria-labelledby="h-faq" className={SECTION}>
        <Container className="max-w-[860px]">
          <h2 id="h-faq" className={H2}>
            Questions fréquentes
          </h2>
          <FaqAccordion items={faqItems} emitJsonLd={false} ancres />
        </Container>
      </section>

      <section aria-labelledby="h-liens" className={SECTION}>
        <Container className="max-w-[860px]">
          <h2 id="h-liens" className={H2}>
            {TEXTES.liens.titre}
          </h2>
          <ul className="flex flex-col">
            <li>
              <Link href="/journee-ia" className={LIEN}>
                {TEXTES.liens.journee}
              </Link>
            </li>
            <li>
              <Link href={lienRdv as never} className={LIEN} data-cta="cartographie-bas">
                {TEXTES.liens.diagnostic}
              </Link>
            </li>
          </ul>
          <p className="text-fg-soft mt-6 text-sm">
            {TEXTES.miseAJour} <time dateTime={DATE_MISE_A_JOUR_CARTOGRAPHIE}>{dateMaj}</time>.
          </p>
        </Container>
      </section>

      <JsonLd data={serviceJsonLd} />
      <JsonLd data={webPageJsonLd} />
      <JsonLd data={faqJsonLd} />
    </>
  );
}
