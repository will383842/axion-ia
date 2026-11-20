// « Combien coûte un audit IA pour une TPE ou une PME ? » (lot GEO V2-28) : page statique, serveur
// seulement (aucun composant client, aucune base). Tout le texte vient de `contenu.ts` ; le seul
// montant est le prix de la Journée IA, lu dans `pricing.ts` via `remplacerJetons()`. Aucun
// paiement ni réservation en ligne : le bouton mène au Diagnostic IA (même lien que le reste du
// site). La langue anglaise est désactivée : toute autre locale part vers /fr.

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
  DATE_MISE_A_JOUR_PRIX_AUDIT_IA,
  DESCRIPTION_META,
  FAQ,
  OG_IMAGE_ALT,
  PATH,
  REPONSE_DIRECTE,
  TEXTES,
  TITRE,
} from "./contenu";
import { jsonLdPrixAuditIa } from "./jsonld";

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
    description: remplacerJetons(DESCRIPTION_META),
    alternates: { fr: PATH, en: PATH },
    ogImageAlt: OG_IMAGE_ALT,
  });
}

const H2 = "mb-4 text-[1.5rem] leading-tight font-extrabold tracking-[-0.02em] md:text-[2rem]";
const SECTION = "py-8 md:py-12";
const LIEN =
  "text-terracotta-deep inline-flex min-h-12 items-center font-bold underline underline-offset-4 hover:no-underline";

export default async function PrixAuditIaPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  if (locale !== "fr") permanentRedirect(`/fr${PATH}`);
  setRequestLocale(locale);

  const [serviceJsonLd, webPageJsonLd, faqJsonLd] = jsonLdPrixAuditIa();
  const dateMaj = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${DATE_MISE_A_JOUR_PRIX_AUDIT_IA}T00:00:00Z`),
  );
  const faqItems = FAQ.map((f) => ({
    id: f.id,
    question: f.question,
    answer: remplacerJetons(f.reponse),
  }));
  const lienRdv = lienDiagnostic("prix-audit-ia");

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
          <p data-reponse-directe className="text-fg mt-4 text-lg leading-snug font-semibold">
            {remplacerJetons(REPONSE_DIRECTE)}
          </p>
          <p className="text-fg-soft mt-3 text-base leading-snug">{TEXTES.tva}</p>
          <div className="mt-5">
            <Cta
              href={lienRdv}
              track="prix-audit-ia-haut"
              variant="terracotta"
              size="xl"
              className="w-full sm:w-auto"
            >
              <CalendarDays className="size-5" aria-hidden="true" />
              {TEXTES.cta}
            </Cta>
            <p className="text-fg-soft mt-2 text-sm">{TEXTES.microTexte}</p>
          </div>
        </Container>
      </section>

      <section aria-labelledby="h-compris" className={SECTION}>
        <Container className="max-w-[860px]">
          <h2 id="h-compris" className={H2}>
            {TEXTES.compris.titre}
          </h2>
          <p className="text-fg-soft mb-3 leading-relaxed">{TEXTES.compris.intro}</p>
          <ul className="list-disc space-y-2 pl-5 leading-relaxed">
            {TEXTES.compris.elements.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="h-sur-devis" className={SECTION}>
        <Container className="max-w-[860px]">
          <h2 id="h-sur-devis" className={H2}>
            {TEXTES.surDevis.titre}
          </h2>
          <ul className="flex flex-col gap-3">
            {[TEXTES.surDevis.formation, TEXTES.surDevis.automatisation].map((p) => (
              <li key={p.nom} className="border-sand-deep bg-paper rounded-xl border p-4">
                <p className="font-bold">{p.nom}</p>
                <p className="text-fg-soft mt-1 leading-relaxed">{p.texte}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="h-variation" className={SECTION}>
        <Container className="max-w-[860px]">
          <h2 id="h-variation" className={H2}>
            {TEXTES.variation.titre}
          </h2>
          <p className="text-fg-soft mb-4 leading-relaxed">{TEXTES.variation.intro}</p>
          {[TEXTES.variation.formation, TEXTES.variation.automatisation].map((bloc) => (
            <div key={bloc.titre} className="mb-4">
              <h3 className="font-bold">{bloc.titre}</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 leading-relaxed">
                {bloc.elements.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          ))}
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
              <Link href="/tarifs" className={LIEN}>
                {TEXTES.liens.tarifs}
              </Link>
            </li>
            <li>
              <Link href="/audit" className={LIEN}>
                {TEXTES.liens.audit}
              </Link>
            </li>
            <li>
              <Link href="/journee-ia" className={LIEN}>
                {TEXTES.liens.journee}
              </Link>
            </li>
            <li>
              <Link href={lienRdv as never} className={LIEN} data-cta="prix-audit-ia-bas">
                {TEXTES.liens.diagnostic}
              </Link>
            </li>
          </ul>
          <p className="text-fg-soft mt-6 text-sm">
            {TEXTES.miseAJour} <time dateTime={DATE_MISE_A_JOUR_PRIX_AUDIT_IA}>{dateMaj}</time>.
          </p>
        </Container>
      </section>

      <JsonLd data={serviceJsonLd} />
      <JsonLd data={webPageJsonLd} />
      <JsonLd data={faqJsonLd} />
    </>
  );
}
