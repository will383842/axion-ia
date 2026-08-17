// Page candidature commercial — INDEXABLE (intention « devenir commercial » +
// destination des CTA des pages France/memo-isere). Refonte 2026-08-12 :
// tunnel step-by-step SANS CV (brief Mémorial de l'Isère) — un écran par
// question, sauvegarde locale, mobile-first. Le formulaire est un îlot client
// unique (CommercialApplicationWizard) ; la coquille reste server-rendered.
//
// Contenu FR tutoyé uniquement : le locale EN est 301 → FR au runtime
// (cf. AGENTS.md), les métadonnées EN restent pour le jour du re-enable.

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { CommercialApplicationWizard } from "@/components/forms/commercial-application/CommercialApplicationWizard";
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
    ? "Candidature commercial Axion-IA · 3 minutes, sans CV"
    : "Axion-IA sales rep application · 3 minutes, no resume";
  return {
    ...buildProductMetadata({
      locale,
      path: "/devenir-commercial-ia/candidature",
      title,
      description: isFr
        ? "Deviens commercial indépendant Axion-IA : pas de CV, pas de lettre de motivation — quelques questions essentielles, 3 minutes chrono. Produits IA faciles à vendre, commissions déplafonnées, statut indépendant."
        : "Become an independent Axion-IA sales rep: no resume, no cover letter — a few essential questions, 3 minutes flat. Easy-to-sell AI products, uncapped commissions, self-employed status.",
    }),
    title: { absolute: title },
    keywords: buildCommercialKeywords(),
  };
}

export default async function CommercialApplicationPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const isFr = locale === "fr";

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

      <section className="bg-paper py-10 sm:py-16">
        <Container>
          <div className="mx-auto max-w-xl">
            <CommercialApplicationWizard />
          </div>
        </Container>
      </section>
    </>
  );
}
