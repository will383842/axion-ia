import type { Metadata } from "next";
import Image from "next/image";
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
    ? "Discutons de votre projet IA · Axion-IA"
    : "Discutons de votre projet IA · Axion-IA";
  return {
    ...buildProductMetadata({
      locale,
      path: "/appel",
      title: titleStr,
      description: isFr
        ? "Un premier échange de 30 minutes pour explorer votre projet IA — formation, accompagnement 1-to-1, audit, automatisation, implémentation complète, SaaS web ou autre. Aucun engagement, aucune pression commerciale."
        : "Un premier échange de 30 minutes pour explorer votre projet IA — formation, accompagnement 1-to-1, audit, automatisation, implémentation complète, SaaS web ou autre. Aucun engagement, aucune pression commerciale.",
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
    name: isFr ? "Premier contact projet IA · Axion-IA" : "Premier contact projet IA · Axion-IA",
    description: isFr
      ? "Premier échange téléphonique de 30 minutes avec un consultant IA Axion-IA pour explorer votre projet — formation, accompagnement 1-to-1, audit, automatisation, implémentation, SaaS web. Aucun engagement."
      : "Premier échange téléphonique de 30 minutes avec un consultant IA Axion-IA pour explorer votre projet — formation, accompagnement 1-to-1, audit, automatisation, implémentation, SaaS web. Aucun engagement.",
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
        name: isFr ? "Premier contact" : "Premier contact",
        item: `${SITE_URL}/${locale}/appel`,
      },
    ],
  } as const;

  const benefits = isFr
    ? [
        {
          icon: Clock,
          title: "Le temps qu'il faut",
          text: "Un appel où l'on prend le temps de cadrer votre projet à la perfection. Pas de chrono, pas de script commercial.",
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
          title: "Time well spent",
          text: "A call where we take the time to scope your project perfectly. No stopwatch, no sales script.",
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
          { label: isFr ? "Premier contact" : "Premier contact", href: "/appel" },
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
                {isFr ? "Premier contact · Sans engagement" : "Premier contact · Sans engagement"}
              </p>
              <h1
                id="appel-hero-h1"
                className="text-fg text-[clamp(2rem,5vw,3.5rem)] leading-tight font-semibold tracking-tight"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr ? "Discutons de votre projet IA" : "Discutons de votre projet IA"}
              </h1>
              <p className="text-fg-soft mx-auto mt-6 max-w-2xl text-lg leading-relaxed">
                {isFr
                  ? "Un premier échange de 30 minutes pour explorer votre projet et comprendre vos besoins — formation, accompagnement 1-to-1, audit, automatisation, implémentation complète, SaaS web ou autre. Aucun engagement, aucune pression commerciale."
                  : "Un premier échange de 30 minutes pour explorer votre projet et comprendre vos besoins — formation, accompagnement 1-to-1, audit, automatisation, implémentation complète, SaaS web ou autre. Aucun engagement, aucune pression commerciale."}
              </p>
            </div>
          </Container>
        </section>

        {/* Section calendrier Calendly — layout 2 colonnes desktop avec sidebar
            sticky "Comment ça marche" + portrait Williams + trust signals à
            gauche, widget Calendly à droite dans un cadre moderne (shadow
            multi-layer + glow décoratif terracotta + ring border).
            Mobile : sidebar empilée au-dessus du widget.
            Le widget se charge en lazyOnload (pas d'impact LCP). */}
        <section aria-labelledby="appel-calendar-h2" className="bg-canvas pb-16 sm:pb-20">
          <Container>
            <h2 id="appel-calendar-h2" className="sr-only">
              Calendrier de réservation
            </h2>
            <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(280px,1fr)_minmax(0,2fr)] lg:gap-10">
              {/* Sidebar : portrait + steps + trust signals (sticky desktop) */}
              <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
                {/* Portrait Williams */}
                <div className="bg-sand flex items-center gap-4 rounded-2xl p-5">
                  <div className="ring-paper relative h-14 w-14 shrink-0 overflow-hidden rounded-full ring-2">
                    <Image
                      src="/images/axion-ia-fondateur-williams-jullin-portrait-professionnel.jpg"
                      alt="William"
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-fg-soft text-[11px] tracking-widest uppercase">Avec</p>
                    <p
                      className="text-fg leading-tight font-semibold"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      William
                    </p>
                    <p className="text-fg-soft mt-0.5 text-xs">Consultant IA · Fondateur</p>
                  </div>
                </div>

                {/* Steps "Comment ça marche" */}
                <div className="bg-paper border-border rounded-2xl border p-5">
                  <h3
                    className="text-fg mb-4 text-sm font-semibold"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    Comment ça marche
                  </h3>
                  <ol className="space-y-3">
                    {[
                      "Choisissez un créneau qui vous convient dans le calendrier.",
                      "Vous recevez une confirmation par email immédiatement.",
                      "On discute de votre projet le jour J, simplement.",
                    ].map((step, i) => (
                      <li key={step} className="flex gap-3">
                        <span className="bg-terracotta text-paper flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                          {i + 1}
                        </span>
                        <p className="text-fg-soft text-sm leading-relaxed">{step}</p>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Trust signals 3 cols */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-paper border-border rounded-xl border p-3 text-center">
                    <Clock className="text-terracotta mx-auto mb-1 h-4 w-4" aria-hidden="true" />
                    <p className="text-fg-soft text-[11px] leading-tight">30 min</p>
                  </div>
                  <div className="bg-paper border-border rounded-xl border p-3 text-center">
                    <Shield className="text-terracotta mx-auto mb-1 h-4 w-4" aria-hidden="true" />
                    <p className="text-fg-soft text-[11px] leading-tight">Sans engagement</p>
                  </div>
                  <div className="bg-paper border-border rounded-xl border p-3 text-center">
                    <CheckCircle
                      className="text-terracotta mx-auto mb-1 h-4 w-4"
                      aria-hidden="true"
                    />
                    <p className="text-fg-soft text-[11px] leading-tight">Confirmation immédiate</p>
                  </div>
                </div>
              </aside>

              {/* Widget Calendly avec cadre moderne (glow + shadow + ring) */}
              <div className="relative">
                {/* Glow décoratif terracotta derrière le widget — pur ornement */}
                <div
                  className="from-terracotta/15 to-terracotta/5 pointer-events-none absolute -inset-3 rounded-[2rem] bg-gradient-to-br via-transparent opacity-60 blur-2xl"
                  aria-hidden="true"
                />
                <div className="bg-paper ring-border shadow-terracotta/10 relative rounded-3xl p-1.5 shadow-2xl ring-1">
                  <CalendlyInlineWidget calendlyUrl={CALENDLY_APPEL_URL} isFr={isFr} height={720} />
                </div>
              </div>
            </div>
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
      <StickyMobileCta label={isFr ? "Premier contact" : "Premier contact"} href="/appel" />
    </>
  );
}
