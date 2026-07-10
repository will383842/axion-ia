// Page candidature commercial — INDEXABLE (intention « devenir commercial » +
// destination des CTA des pages ville/France). Formulaire = îlot client unique
// (CommercialApplicationForm) ; le reste est server-rendered (Web Vitals).

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { HeroBadge } from "@/components/marketing/HeroBadge";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { CommercialApplicationForm } from "@/components/forms/CommercialApplicationForm";
import { buildCommercialKeywords } from "@/content/recrutement/commercial-offer";
import { buildProductMetadata } from "@/lib/seo";

export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  const title = isFr
    ? "Candidature commercial Axion-IA · rejoignez le réseau"
    : "Axion-IA sales rep application · join the network";
  return {
    ...buildProductMetadata({
      locale,
      path: "/devenir-commercial-ia/candidature",
      title,
      description: isFr
        ? "Candidatez pour devenir commercial indépendant Axion-IA : quelques informations suffisent. Produits IA faciles à vendre, commissions déplafonnées, statut indépendant."
        : "Apply to become an independent Axion-IA sales rep: a few details are enough. Easy-to-sell AI products, uncapped commissions, self-employed status.",
    }),
    title: { absolute: title },
    keywords: buildCommercialKeywords(),
  };
}

export default async function CommercialApplicationPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs
          items={[
            { href: "/devenir-commercial-ia", label: isFr ? "Devenir commercial" : "Become a rep" },
            {
              href: "/devenir-commercial-ia/candidature",
              label: isFr ? "Candidature" : "Application",
            },
          ]}
        />
      </Container>

      <section className="bg-paper py-12 sm:py-16">
        <Container>
          {/* Eyebrow → pastille centrée sur la page, au-dessus du contenu. */}
          <HeroBadge className="mb-8 sm:mb-10">
            <span
              aria-hidden="true"
              className="bg-terracotta inline-block h-1.5 w-1.5 rounded-full"
            />
            {isFr ? "Candidature" : "Application"}
          </HeroBadge>
          <div className="mx-auto max-w-2xl">
            <h1 className="display-editorial text-fg">
              {isFr ? "Devenez commercial" : "Become a sales rep"}{" "}
              <span className="text-terracotta italic" style={{ fontFamily: "var(--font-serif)" }}>
                Axion-IA
              </span>
            </h1>
            <p className="text-fg-soft mt-5 text-lg leading-relaxed">
              {isFr
                ? "Quelques informations suffisent pour postuler. Statut indépendant, produits financés faciles à vendre, revenus déplafonnés — et démarrer ne vous coûte rien."
                : "A few details are enough to apply. Self-employed status, easy-to-sell funded products, uncapped income — and getting started costs you nothing."}
            </p>

            <div className="mt-10">
              <CommercialApplicationForm isFr={isFr} />
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
