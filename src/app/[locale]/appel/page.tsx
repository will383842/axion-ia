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
import { CalendlyEventCapture } from "@/components/booking/CalendlyEventCapture";
import { ArrowRight, Clock, Shield, CheckCircle, Calendar } from "lucide-react";

/**
 * 15 minutes — la fraîcheur des CRÉNEAUX, pas celle du texte. Aligné sur
 * `SLOTS_REVALIDATE_SECONDS` (`src/server/calendly/availability.ts`) ; la valeur
 * doit être un littéral, Next exige qu'elle soit analysable statiquement.
 *
 * 🔴 CET EXPORT EST INERTE AUJOURD'HUI — rectifié le 2026-08-27. Le paragraphe
 * retiré raisonnait sur une page prérendue qui n'existe pas en production.
 *
 * Cette route est rendue DYNAMIQUEMENT, parce qu'elle `await` `searchParams`
 * (extraction UTM, plus bas) — une API de temps de requête, qui sort la page du
 * prérendu. Mesuré en production le 2026-08-27 :
 * `Cache-Control: private, no-cache, no-store`, `cf-cache-status: BYPASS`,
 * aucun `x-nextjs-cache`. Il n'y a donc AUCUNE entrée de page à revalider, et
 * la seule fraîcheur réelle vient du cache de données du `fetch`, piloté par
 * `CALENDLY_SLOTS_TAG` et par le chemin.
 *
 * ⚠️ ON LE GARDE QUAND MÊME, et c'est délibéré : il est inerte SOUS CONDITION.
 * Le jour où quelqu'un déplace l'extraction UTM côté client, la page redevient
 * prérendable et cet export reprend son sens — l'avoir retiré ferait alors
 * servir un repli figé.
 *
 * ⚠️ RÈGLE D'ORDRE : tout lot qui touche ce fichier rejoue la mesure
 * (`curl -I https://axion-ia.com/fr/appel`) AVANT de fusionner. La prémisse de
 * l'invalidation des créneaux repose sur elle, et un changement de rendu la
 * casserait sans qu'aucune gate ne le voie.
 */
export const revalidate = 900;

interface Props {
  params: Promise<{ locale: string }>;
  /**
   * Sprint Notif Infra 2026-05-26 / fix P1-5 audit 2026-05-27 — searchParams
   * UTM extraits côté Server Component et passés au CalendlyEventCapture
   * pour attribution analytics.
   */
  searchParams: Promise<Record<string, string | undefined>>;
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
  // Le titre reprend l'ancre nav/footer « Réserver un appel » pour aligner le
  // label sitelink sur l'intention de recherche (audit sitelinks 2026-07-06).
  const titleStr = isFr
    ? "Réserver un appel · votre projet IA · Axion-IA"
    : "Book a call · your AI project · Axion-IA";
  return {
    ...(await buildProductMetadata({
      locale,
      path: "/appel",
      title: titleStr,
      description: isFr
        ? "Un premier échange de 30 minutes pour explorer votre projet IA — formation, accompagnement 1-to-1, audit, automatisation, implémentation complète, SaaS web ou autre. Aucun engagement, aucune pression commerciale."
        : "Un premier échange de 30 minutes pour explorer votre projet IA — formation, accompagnement 1-to-1, audit, automatisation, implémentation complète, SaaS web ou autre. Aucun engagement, aucune pression commerciale.",
      alternates: { fr: "/appel", en: "/book-a-call" },
    })),
    title: { absolute: titleStr },
  };
}

export default async function AppelPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const isFr = locale === "fr";

  // Sprint Notif Infra 2026-05-26 / fix P1-5 — extraction UTM côté Server.
  const trackingContext: {
    pageUrl: string;
    utmSource?: string;
    utmCampaign?: string;
    utmMedium?: string;
    referrer?: string;
  } = { pageUrl: `${SITE_URL}/${locale}/appel` };
  if (typeof sp["utm_source"] === "string") trackingContext.utmSource = sp["utm_source"];
  if (typeof sp["utm_campaign"] === "string") trackingContext.utmCampaign = sp["utm_campaign"];
  if (typeof sp["utm_medium"] === "string") trackingContext.utmMedium = sp["utm_medium"];
  if (typeof sp["ref"] === "string") trackingContext.referrer = sp["ref"];

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

  return (
    <>
      <JsonLd data={jsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      {/* Le composant préfixe déjà « Accueil » (fullItems) : le repasser ici
          affichait « Accueil / Accueil / Premier contact » à l'écran. */}
      <Breadcrumbs items={[{ label: "Premier contact", href: "/appel" }]} emitJsonLd={false} />
      {/* GEO-123 (audit GEO/AEO 2026-08-14) — `<div>` et NON `<main>` : le
          layout `[locale]` porte deja `<main id="main">`, cible du lien
          d'evitement. Un second `<main>` imbrique rend le contenu principal
          non identifiable pour les technologies d'assistance ET pour les
          extracteurs de contenu principal des moteurs. L'`id` est retire :
          `main-content` n'etait cible par aucun lien d'evitement. */}
      <div>
        {/* Hero ultra-compact — l'utilisateur est ici pour réserver, pas lire.
            Texte condensé pour que le calendrier soit visible above-the-fold
            (sans scroll initial sur desktop 1366x768+ et mobile iPhone 12+). */}
        <section aria-labelledby="appel-hero-h1" className="bg-canvas pt-6 pb-4 sm:pt-10 sm:pb-6">
          <Container>
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-terracotta mb-2 inline-flex items-center gap-2 text-[11px] font-semibold tracking-widest uppercase sm:text-xs">
                <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                Premier contact · Sans engagement
              </p>
              <h1
                id="appel-hero-h1"
                className="text-fg text-[clamp(1.625rem,4vw,2.5rem)] leading-tight font-semibold tracking-tight"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                Discutons de votre projet IA
              </h1>
              {/* Pas de sous-titre : il redisait ce que la page affiche déjà trois
                  fois — « Sans engagement » est dans le surtitre ET dans les
                  pastilles, « 30 minutes » dans les pastilles ET en tête du
                  calendrier. Retiré sur demande de Will (2026-07-31) ; le
                  calendrier remonte d'autant, ce qui sert le funnel. */}
            </div>
          </Container>
        </section>

        {/* Section calendrier Calendly — layout mobile-first :
            - Mobile (<lg) : widget Calendly EN PREMIER (above-the-fold prio),
              sidebar (portrait + steps + trust) empilée DESSOUS.
            - Desktop (≥lg) : grid 2 cols, sidebar à gauche sticky, widget à
              droite (réordonnés via lg:order-1/lg:order-2).
            Calendrier entouré d'un cadre moderne (shadow multi-layer + glow
            décoratif terracotta + ring border).
            Depuis ADR 0038 le contenu de ce cadre est rendu côté serveur
            (créneaux en HTML statique) : plus rien de Calendly n'est chargé par
            le navigateur tant que le visiteur ne clique pas un créneau. */}
        <section aria-labelledby="appel-calendar-h2" className="bg-canvas pb-12 sm:pb-16">
          <Container>
            <h2 id="appel-calendar-h2" className="sr-only">
              Calendrier de réservation
            </h2>
            <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(280px,1fr)_minmax(0,2fr)] lg:gap-10">
              {/* Sidebar : portrait + steps + trust signals (sticky desktop)
                  - Mobile : order-2 (sous le widget)
                  - Desktop : order-1 (à gauche, sticky) */}
              <aside className="order-2 space-y-5 lg:sticky lg:top-24 lg:order-1 lg:self-start">
                {/* Portrait Williams */}
                <div className="bg-sand flex items-center gap-4 rounded-2xl p-5">
                  <div className="ring-paper relative h-14 w-14 shrink-0 overflow-hidden rounded-full ring-2">
                    <Image
                      src="/images/axion-ia-fondateur-williams-jullin-portrait-professionnel.jpg"
                      alt="Consultant IA Axion-IA"
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
                      L&apos;équipe Axion-IA
                    </p>
                    <p className="text-fg-soft mt-0.5 text-xs">Consultants IA</p>
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
                      // 🔴 Disait « Vous recevez une confirmation par email
                      // immédiatement » — vrai au sens strict (Calendly envoie
                      // l'invitation d'agenda), mais la phrase laissait attendre
                      // un message DE NOUS, qui n'existait pas. On annonce
                      // désormais les deux, et le second est le nôtre.
                      "Vous recevez la confirmation dans votre agenda, puis un rappel de notre part une heure avant.",
                      "On discute de votre projet ou tout autre besoin de renseignements.",
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

              {/* Widget Calendly — cadre moderne (glow + shadow + ring)
                  - Mobile : order-1 (en premier, above-the-fold prio)
                  - Desktop : order-2 (à droite) */}
              <div className="relative order-1 lg:order-2">
                {/* Glow décoratif terracotta derrière le widget — pur ornement */}
                <div
                  className="from-terracotta/15 to-terracotta/5 pointer-events-none absolute -inset-3 rounded-3xl bg-gradient-to-br via-transparent opacity-60 blur-2xl"
                  aria-hidden="true"
                />
                <div className="bg-paper ring-border shadow-terracotta/10 relative rounded-3xl p-1.5 shadow-2xl ring-1">
                  <CalendlyInlineWidget calendlyUrl={CALENDLY_APPEL_URL} isFr={isFr} height={720} />
                </div>
                {/* Sprint Notif Infra 2026-05-26 / Chantier 3 — capture client
                    des events `event_scheduled` emis par l'iframe Calendly.
                    Aucune UI rendue, listener postMessage passif post-mount.

                    CONSERVÉ APRÈS ADR 0038, et ce n'est pas un oubli : le
                    sélecteur de créneaux n'ouvre aucune iframe, donc plus aucun
                    postMessage ne lui parviendra par cette voie. Mais le repli
                    `CalendlyConsentGate` monte toujours l'iframe, et c'est LUI
                    que rendent le build et tout incident d'API. Le retirer
                    rendrait ces réservations-là invisibles.
                    La capture des réservations faites sur calendly.com (nouvel
                    onglet), elle, ne passe pas par ici : elle est assurée par
                    le sondage horaire `api/internal/calendly-refresh`. */}
                {CALENDLY_APPEL_URL && (
                  <CalendlyEventCapture
                    calendlyUrl={CALENDLY_APPEL_URL}
                    trackingContext={trackingContext}
                  />
                )}
              </div>
            </div>
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
                  ? "Décrivez votre projet par message — nous vous répondons sous 48 h ouvrées avec une proposition de créneau ou une réponse écrite directe."
                  : "Describe your project by message — we reply within 48 working hours with a proposed slot or a direct written answer."}
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
      </div>
      <StickyMobileCta label={isFr ? "Premier contact" : "Premier contact"} href="/appel" />
    </>
  );
}
