import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import {
  Clock,
  UserRound,
  ShieldCheck,
  BadgeCheck,
  Mail,
  CalendarClock,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { ACCENT_CLASSES, type ServiceAccent } from "@/content/services-visual";
import { routing, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/Container";
import { JsonLd } from "@/components/marketing/JsonLd";
import { UnifiedContactForm } from "@/components/forms/UnifiedContactForm";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata, SITE_URL } from "@/lib/seo";
import { buildSpeakableSpecification } from "@/lib/seo/speakable-universal";

interface Props {
  params: Promise<{ locale: string }>;
}

/** Une promesse de réassurance + l'accent de la palette services qui la porte. */
interface Reassurance {
  icon: LucideIcon;
  accent: ServiceAccent;
  label: string;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/contact",
    // Le titre DOIT finir par « · Axion-IA » (sinon le template layout ré-appose
    // la marque → « … · Axion-IA · Axion-IA », bug audit 2026-07-06).
    title:
      locale === "fr"
        ? "Contact · réponse sous 48 h ouvrées · Axion-IA"
        : "Contact · 48 business-hour reply · Axion-IA",
    description:
      locale === "fr"
        ? "Contactez Axion-IA — un formulaire unique pour devis, audit, implémentation, formation, 1-à-1, partenariat. Réponse sous 48 h ouvrées."
        : "Contact Axion-IA — a single form for quote, audit, implementation, training, 1-on-1, partnership. Reply within 48 business hours.",
  });
}

// Page épurée mais chaleureuse : header global + layout éditorial 2 colonnes
// (panneau de réassurance sticky à gauche + carte formulaire à droite) au lg+,
// empilé et form-first sur mobile. Footer global masqué via `<style>`. Les
// sections d'autorité lourdes (3 portes, FAQ) restent hors-page pour garder un
// time-to-form court. Refonte UX 2026-07-09 (Will) : le formulaire unifié couvre
// 12 cas, sélecteur d'objet visuel (grille de chips) au lieu du dropdown caché.
// ISR — la page consomme le layout partagé (bandeau + JSON-LD Qualiopi gated
// Phase B, DB-sourcés au runtime). 24h suffit (formulaire, contenu stable).
export const revalidate = 86400;

export default async function Contact({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const t = isFr
    ? {
        eyebrow: "Contact",
        titleLead: "Parlons de ",
        titleEm: "vous",
        subtitle:
          "Un seul formulaire pour toute demande — audit, intégration, formation, coaching ou partenariat. Chaque message est lu personnellement par un consultant senior.",
        reassure: [
          { icon: Clock, accent: "terracotta", label: "Réponse sous 48 h ouvrées" },
          { icon: UserRound, accent: "ochre", label: "Lu par un consultant senior, jamais un bot" },
          {
            icon: ShieldCheck,
            accent: "primary",
            label: "Données hébergées en UE · RGPD · aucune revente",
          },
          { icon: BadgeCheck, accent: "sage", label: "Échange sans engagement" },
        ] satisfies readonly Reassurance[],
        altLead: "Vous préférez un autre canal ?",
        emailLabel: "Écrire directement",
        callLabel: "Réserver un appel",
      }
    : {
        eyebrow: "Contact",
        titleLead: "Let's talk about ",
        titleEm: "you",
        subtitle:
          "A single form for every request — audit, integration, training, coaching or partnership. Every message is read personally by a senior consultant.",
        reassure: [
          { icon: Clock, accent: "terracotta", label: "Reply within 48 business hours" },
          { icon: UserRound, accent: "ochre", label: "Read by a senior consultant, never a bot" },
          {
            icon: ShieldCheck,
            accent: "primary",
            label: "Data hosted in the EU · GDPR · no resale",
          },
          { icon: BadgeCheck, accent: "sage", label: "No-commitment conversation" },
        ] satisfies readonly Reassurance[],
        altLead: "Prefer another channel?",
        emailLabel: "Email us directly",
        callLabel: "Book a call",
      };

  const contactJsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "@id": `${SITE_URL}/${loc}/contact#webpage`,
    url: `${SITE_URL}/${loc}/contact`,
    inLanguage: loc,
    isPartOf: { "@type": "WebSite", "@id": `${SITE_URL}/#website` },
    name: isFr ? "Contact Axion-IA" : "Contact Axion-IA",
    description: isFr
      ? "Formulaire de contact Axion-IA — réponse sous 48 h ouvrées, sans engagement, données stockées en UE."
      : "Axion-IA contact form — reply within 48 business hours, no commitment, data stored in the EU.",
    publisher: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Axion-IA",
      url: SITE_URL,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Grenoble",
        addressRegion: "Auvergne-Rhône-Alpes",
        addressCountry: "FR",
      },
    },
    mainEntity: {
      "@type": "ContactPoint",
      contactType: isFr ? "Service client" : "Customer service",
      email: "contact@axion-ia.com",
      availableLanguage: ["French", "English"],
      areaServed: ["FR", "EU"],
      hoursAvailable: {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "09:00",
        closes: "18:00",
      },
    },
    // Speakable AEO — ContactPage est un sous-type WebPage : propriété valide.
    speakable: buildSpeakableSpecification(),
  } as const;

  // Masque le Footer global (rendu dans [locale]/layout.tsx) uniquement sur
  // /contact, via le pattern `:has()` du shell admin (cf. layout admin).
  // bg-mocha-rich = classe racine unique du Footer public.
  const hideFooterCss = `
    body:has(.contact-minimal) footer.bg-mocha-rich { display: none !important; }
  `.trim();

  return (
    <div className="contact-minimal bg-halo-warm">
      <style dangerouslySetInnerHTML={{ __html: hideFooterCss }} />

      <Container className="border-border border-b py-3">
        <Breadcrumbs items={[{ href: "/contact", label: isFr ? "Contact" : "Contact" }]} />
      </Container>

      <section className="py-12 sm:py-16 lg:py-24">
        <Container className="max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-start lg:gap-16">
            {/* ---- Colonne gauche : réassurance éditoriale (sticky au lg+) ---- */}
            <div className="lg:sticky lg:top-28">
              <p className="border-terracotta/30 bg-terracotta-soft text-terracotta-deep inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-terracotta inline-block h-1.5 w-1.5 rounded-full"
                />
                {t.eyebrow}
              </p>
              <h1 className="display-editorial text-fg mt-5">
                {t.titleLead}
                <span
                  className="text-terracotta italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {t.titleEm}
                </span>
              </h1>
              <p className="text-fg-soft mt-5 max-w-md text-base leading-relaxed sm:text-lg">
                {t.subtitle}
              </p>

              {/* Réassurance détaillée — desktop only (le bloc `lg:hidden` sous
                  le formulaire en sert l'équivalent mobile).
                  Une couleur par promesse (délai / humain / RGPD / engagement) :
                  quatre points d'ancrage visuels au lieu d'un aplat terracotta. */}
              <ul className="mt-9 hidden space-y-4 lg:block">
                {t.reassure.map(({ icon: Icon, accent, label }) => (
                  <li key={label} className="text-fg-soft flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-sm ${ACCENT_CLASSES[accent].chipSolid}`}
                    >
                      <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <span className="text-[14.5px] leading-relaxed">{label}</span>
                  </li>
                ))}
              </ul>

              {/* Canaux alternatifs — desktop only (cf. bloc `lg:hidden` sous le
                  formulaire pour l'équivalent mobile). */}
              <div className="border-border bg-paper shadow-subtle mt-9 hidden rounded-2xl border p-5 lg:block">
                <p className="text-fg-muted text-[13px]">{t.altLead}</p>
                <div className="mt-3 flex flex-col gap-2.5">
                  <a
                    href="mailto:contact@axion-ia.com"
                    className="text-fg hover:text-terracotta-deep inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[14.5px] font-semibold transition-colors"
                  >
                    <Mail aria-hidden="true" className="text-terracotta h-4 w-4" strokeWidth={2} />
                    {t.emailLabel}
                    <span className="text-fg-muted font-normal">contact@axion-ia.com</span>
                  </a>
                  <Link
                    href="/appel"
                    className="group text-fg hover:text-terracotta-deep inline-flex items-center gap-2 text-[14.5px] font-semibold transition-colors"
                  >
                    <CalendarClock
                      aria-hidden="true"
                      className="text-terracotta h-4 w-4"
                      strokeWidth={2}
                    />
                    {t.callLabel}
                    <ArrowUpRight
                      aria-hidden="true"
                      className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    />
                  </Link>
                </div>
              </div>
            </div>

            {/* ---- Colonne droite : carte formulaire ---- */}
            <div className="border-border bg-paper shadow-card relative overflow-hidden rounded-3xl border p-5 sm:p-7 lg:p-9">
              {/* Liseré des 5 accents Axion-IA — signe la carte et fait écho aux
                  5 couleurs d'intention de la grille juste en dessous. */}
              <div aria-hidden="true" className="absolute inset-x-0 top-0 flex h-1.5">
                <span className="bg-primary flex-1" />
                <span className="bg-sage flex-1" />
                <span className="bg-terracotta flex-1" />
                <span className="bg-ochre flex-1" />
                <span className="bg-plum flex-1" />
              </div>
              <UnifiedContactForm source="/contact" />
            </div>

            {/* ---- Mobile only : réassurance + canaux alternatifs ----
                Placé APRÈS la carte dans le DOM pour préserver le time-to-form
                mobile (form-first). Sans ce bloc, un visiteur mobile n'avait
                aucun canal de repli : la liste et les liens ci-dessus sont
                `lg:block`, et le Footer global est masqué sur cette page. */}
            <div className="lg:hidden">
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {t.reassure.map(({ icon: Icon, accent, label }) => (
                  <li
                    key={label}
                    className="border-border bg-paper text-fg-soft flex items-start gap-2.5 rounded-2xl border p-3"
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${ACCENT_CLASSES[accent].chipSolid}`}
                    >
                      <Icon aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                    <span className="text-[13px] leading-snug">{label}</span>
                  </li>
                ))}
              </ul>

              <div className="border-border bg-paper shadow-subtle mt-4 rounded-2xl border p-5">
                <p className="text-fg-muted text-[13px]">{t.altLead}</p>
                <div className="mt-3 flex flex-col gap-3">
                  <a
                    href="mailto:contact@axion-ia.com"
                    className="text-fg inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[14.5px] font-semibold"
                  >
                    <Mail aria-hidden="true" className="text-terracotta h-4 w-4" strokeWidth={2} />
                    {t.emailLabel}
                    <span className="text-fg-muted font-normal">contact@axion-ia.com</span>
                  </a>
                  <Link
                    href="/appel"
                    className="text-fg inline-flex items-center gap-2 text-[14.5px] font-semibold"
                  >
                    <CalendarClock
                      aria-hidden="true"
                      className="text-terracotta h-4 w-4"
                      strokeWidth={2}
                    />
                    {t.callLabel}
                    <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <JsonLd data={contactJsonLd} />
    </div>
  );
}
