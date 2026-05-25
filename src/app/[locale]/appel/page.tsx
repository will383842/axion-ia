import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Link } from "@/i18n/navigation";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { buildProductMetadata, buildServiceJsonLd, SITE_URL } from "@/lib/seo";
import { CalendlyInlineWidget } from "@/components/booking/CalendlyInlineWidget";
import { ArrowRight, Phone, Clock, Shield, CheckCircle, Calendar } from "lucide-react";

export const revalidate = 86400;

interface Props {
  params: Promise<{ locale: string }>;
}

/**
 * URL Calendly publique de l'event-type "Appel découverte 30min".
 *
 * À configurer par Will dans Coolify env vars (scope RUN) :
 *   NEXT_PUBLIC_CALENDLY_APPEL_URL=https://calendly.com/{user}/{event-slug}
 *
 * Lecture build-time côté Next.js (NEXT_PUBLIC_*). Si absent, le widget
 * affiche un fallback CTA contact (cf. CalendlyInlineWidget).
 */
const CALENDLY_APPEL_URL = process.env.NEXT_PUBLIC_CALENDLY_APPEL_URL;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  const titleStr = isFr
    ? "Réserver un appel téléphonique · Axion-IA"
    : "Book a phone call · Axion-IA";
  return {
    ...buildProductMetadata({
      locale,
      path: "/appel",
      title: titleStr,
      description: isFr
        ? "Réservez en 1 minute un appel téléphonique gratuit de 30 minutes avec un consultant IA senior d'Axion-IA. Calendrier temps réel, confirmation immédiate, aucun engagement."
        : "Book a free 30-minute phone call with a senior Axion-IA AI consultant in 1 minute. Real-time calendar, instant confirmation, no commitment.",
      alternates: { fr: "/appel", en: "/book-a-call" },
    }),
    title: { absolute: titleStr },
  };
}

export default async function AppelPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const isFr = locale === "fr";

  const jsonLd = buildServiceJsonLd({
    locale: locale as "fr" | "en",
    path: "/appel",
    name: isFr ? "Appel découverte téléphonique Axion-IA" : "Axion-IA discovery phone call",
    description: isFr
      ? "Appel téléphonique gratuit de 30 minutes avec un consultant IA senior Axion-IA. Réservation en ligne via calendrier temps réel, confirmation immédiate."
      : "Free 30-minute phone call with a senior Axion-IA AI consultant. Online booking via real-time calendar, instant confirmation.",
  });

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: isFr ? "Accueil" : "Home",
        item: `${SITE_URL}/${locale}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: isFr ? "Réserver un appel" : "Book a call",
        item: `${SITE_URL}/${locale}/appel`,
      },
    ],
  } as const;

  const benefits = isFr
    ? [
        {
          icon: Clock,
          title: "30 minutes chrono",
          text: "Un échange efficace, focus sur vos enjeux. Pas de discours commercial.",
        },
        {
          icon: Shield,
          title: "Aucun engagement",
          text: "Pas de contrat à signer, pas d'inscription. Vous repartez avec des pistes concrètes.",
        },
        {
          icon: CheckCircle,
          title: "Réponse personnalisée",
          text: "Vos questions, votre contexte, votre métier. Pas un script standardisé.",
        },
        {
          icon: Phone,
          title: "Consultant senior",
          text: "Pris en charge directement par un expert IA, pas un commercial junior.",
        },
      ]
    : [
        {
          icon: Clock,
          title: "30 minutes flat",
          text: "An efficient conversation focused on your challenges. No sales pitch.",
        },
        {
          icon: Shield,
          title: "No commitment",
          text: "No contract to sign, no signup. You leave with concrete leads.",
        },
        {
          icon: CheckCircle,
          title: "Personalised response",
          text: "Your questions, your context, your industry. Not a standard script.",
        },
        {
          icon: Phone,
          title: "Senior consultant",
          text: "Directly handled by an AI expert, not a junior salesperson.",
        },
      ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      <Breadcrumbs
        items={[
          { label: isFr ? "Accueil" : "Home", href: "/" },
          { label: isFr ? "Réserver un appel" : "Book a call", href: "/appel" },
        ]}
        emitJsonLd={false}
      />
      <main id="main-content">
        {/* Hero compact — focus sur le bénéfice + signal de confiance, puis
            laisse rapidement la place au calendrier (l'utilisateur est ici
            pour réserver, pas pour lire). */}
        <section
          aria-labelledby="appel-hero-h1"
          className="bg-canvas pt-16 pb-12 sm:pt-20 sm:pb-16"
        >
          <Container>
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-terracotta mb-4 inline-flex items-center gap-2 text-sm font-semibold tracking-widest uppercase">
                <Calendar className="h-4 w-4" aria-hidden="true" />
                {isFr
                  ? "Calendrier temps réel · Confirmation immédiate"
                  : "Real-time calendar · Instant confirmation"}
              </p>
              <h1
                id="appel-hero-h1"
                className="text-fg text-[clamp(2rem,5vw,3.5rem)] leading-tight font-semibold tracking-tight"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr ? "Réservez votre appel découverte" : "Book your discovery call"}
              </h1>
              <p className="text-fg-soft mx-auto mt-6 max-w-2xl text-lg leading-relaxed">
                {isFr
                  ? "30 minutes avec un consultant IA senior pour comprendre vos enjeux, identifier les leviers concrets et vous orienter vers la solution adaptée. Choisissez le créneau qui vous convient ci-dessous."
                  : "30 minutes with a senior AI consultant to understand your challenges, identify concrete levers and guide you to the right solution. Pick the slot that works for you below."}
              </p>
            </div>
          </Container>
        </section>

        {/* Section calendrier Calendly — élément principal de la page, mis en
            valeur visuellement (ombre + bordure radius + fond canvas clair).
            Le widget se charge en lazyOnload (pas d'impact LCP). */}
        <section aria-labelledby="appel-calendar-h2" className="bg-canvas pb-16 sm:pb-20">
          <Container>
            <h2 id="appel-calendar-h2" className="sr-only">
              {isFr ? "Calendrier de réservation" : "Booking calendar"}
            </h2>
            <CalendlyInlineWidget calendlyUrl={CALENDLY_APPEL_URL} isFr={isFr} height={720} />
          </Container>
        </section>

        {/* Bénéfices — placés APRÈS le calendrier pour les visiteurs qui
            scrollent au lieu de réserver immédiatement (signal de réassurance,
            pas obstacle à la conversion). */}
        <section
          aria-labelledby="appel-benefits-h2"
          className="border-border-strong border-t py-16 sm:py-20"
        >
          <Container>
            <div className="mx-auto max-w-2xl text-center">
              <h2
                id="appel-benefits-h2"
                className="text-fg text-2xl font-semibold tracking-tight sm:text-3xl"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr ? "Ce que vous obtenez" : "What you get"}
              </h2>
              <p className="text-fg-soft mt-3 text-base">
                {isFr
                  ? "Un échange utile, pas un argumentaire commercial."
                  : "A useful conversation, not a sales pitch."}
              </p>
            </div>
            <ul
              role="list"
              className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-2"
            >
              {benefits.map(({ icon: Icon, title, text }) => (
                <li key={title} className="bg-sand flex items-start gap-4 rounded-2xl px-6 py-6">
                  <span className="bg-terracotta/10 text-terracotta flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3
                      className="text-fg text-base font-semibold tracking-tight"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {title}
                    </h3>
                    <p className="text-fg-soft mt-1.5 text-sm leading-relaxed">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Container>
        </section>

        {/* CTA fallback bas de page — pour les visiteurs qui préfèrent un autre
            canal que le calendrier (ex : DSI qui veut un échange par e-mail
            avant de bloquer un créneau). */}
        <section aria-labelledby="appel-cta-h2" className="bg-terracotta py-16 sm:py-20">
          <Container>
            <div className="mx-auto max-w-2xl text-center">
              <h2
                id="appel-cta-h2"
                className="text-paper text-2xl font-semibold tracking-tight sm:text-3xl"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr ? "Vous préférez écrire d'abord ?" : "Prefer to write first?"}
              </h2>
              <p className="text-paper mt-4 text-base leading-relaxed">
                {isFr
                  ? "Décrivez votre projet par message — nous vous répondons sous 24 h ouvrées avec une proposition de créneau ou une réponse écrite directe."
                  : "Describe your project by message — we reply within 24 working hours with a proposed slot or a direct written answer."}
              </p>
              <Link
                href={"/contact" as never}
                data-cta="appel_footer_contact"
                className="bg-paper text-terracotta hover:bg-paper/90 focus-visible:ring-paper focus-visible:ring-offset-terracotta mt-8 inline-flex h-14 items-center gap-2 rounded-full px-8 text-base font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {isFr ? "Écrire un message" : "Send a message"}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </Container>
        </section>
      </main>
      <StickyMobileCta label={isFr ? "Réserver un appel" : "Book a call"} href="/appel" />
    </>
  );
}
