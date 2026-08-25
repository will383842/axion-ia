import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Mail, CalendarClock, ArrowUpRight } from "lucide-react";
import { env } from "@/env";
import { routing, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/Container";
import { JsonLd } from "@/components/marketing/JsonLd";
import { UnifiedContactForm } from "@/components/forms/UnifiedContactForm";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildFaqJsonLd, buildProductMetadata, SITE_URL } from "@/lib/seo";
import { buildSpeakableSpecification } from "@/lib/seo/speakable-universal";

interface Props {
  params: Promise<{ locale: string }>;
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

// ---------------------------------------------------------------------------
// Refonte 2026-08-25 (Will) — « la page est trop encombrée, on ne doit pas
// avoir à défiler pour tomber sur le formulaire ».
//
// CE QUI A CHANGÉ
// ---------------
// Avant : deux colonnes au `lg+` (rail de réassurance sticky à gauche, carte
// formulaire à droite) et, sur mobile, un empilement qui plaçait AVANT le
// formulaire une pastille « CONTACT », un H1 de 40 px sur deux lignes et un
// chapô de cinq lignes. Mesuré en production sur 390 px : le premier champ
// saisissable tombait à ~1 100 px du haut.
//
// Après : une colonne unique CENTRÉE, du mobile au desktop. L'en-tête tient en
// trois éléments courts (surtitre d'une ligne, H1 d'une ligne, chapô de deux
// lignes), et tout le reste — réassurance détaillée, canaux de repli, FAQ,
// liens utiles — passe SOUS le formulaire. Le rail de gauche disparaît : c'était
// la moitié du bruit, et il ne servait qu'au desktop.
//
// Ce qui n'a pas changé : le Footer global reste masqué sur cette page (pattern
// `:has()` hérité du shell admin), pour la même raison qu'en juillet — garder
// la page focalisée sur un seul geste. La contrepartie est assumée ici par la
// rangée « liens utiles » en bas de page, qui redonne les entrées légales et
// commerciales que le Footer portait.
//
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
        kicker: "Réponse sous 48 h ouvrées",
        titleLead: "Parlons de ",
        titleEm: "vous",
        subtitle: "Audit, intégration, formation, coaching ou partenariat : un seul formulaire.",
        altLead: "Vous préférez un autre canal ?",
        emailLabel: "Nous écrire",
        callLabel: "Réserver un appel",
        faqTitle: "Ce que les gens nous demandent avant d'écrire",
        linksTitle: "Aussi utile",
        links: [
          { href: "/appel", label: "Réserver un appel" },
          { href: "/tarifs", label: "Tarifs" },
          { href: "/formations", label: "Formations IA" },
          { href: "/audit", label: "Audit IA" },
          { href: "/faq", label: "Questions fréquentes" },
          { href: "/mentions-legales", label: "Mentions légales" },
        ],
        faq: [
          {
            question: "Sous combien de temps Axion-IA répond-il ?",
            answer:
              "Sous 48 heures ouvrées. Chaque message est lu par un consultant senior — jamais par un robot, jamais par un standard externalisé.",
          },
          {
            question: "Le premier échange engage-t-il à quelque chose ?",
            answer:
              "Non. Il sert à cadrer votre besoin et à vérifier que nous vous sommes utiles. Vous restez libre de ne pas donner suite.",
          },
          {
            question: "Que deviennent les informations envoyées par ce formulaire ?",
            answer:
              "Elles sont hébergées dans l'Union européenne et servent uniquement à traiter votre demande : aucune revente, aucun profilage publicitaire. Vous pouvez demander leur suppression à tout moment.",
          },
          {
            question: "Peut-on vous joindre autrement que par ce formulaire ?",
            answer:
              "Oui : par e-mail à contact@axion-ia.com, ou en réservant directement un créneau d'appel. Le formulaire reste le chemin le plus rapide, parce qu'il apporte déjà le contexte.",
          },
          {
            question: "Intervenez-vous en dehors de votre région ?",
            answer:
              "Oui. À distance partout en France, et sur site au départ de Grenoble, en Auvergne-Rhône-Alpes.",
          },
        ],
      }
    : {
        kicker: "Reply within 48 business hours",
        titleLead: "Let's talk about ",
        titleEm: "you",
        subtitle: "Audit, integration, training, coaching or partnership: one single form.",
        altLead: "Prefer another channel?",
        emailLabel: "Email us",
        callLabel: "Book a call",
        faqTitle: "What people ask before writing",
        linksTitle: "Also useful",
        links: [
          { href: "/appel", label: "Book a call" },
          { href: "/tarifs", label: "Pricing" },
          { href: "/formations", label: "AI training" },
          { href: "/audit", label: "AI audit" },
          { href: "/faq", label: "FAQ" },
          { href: "/mentions-legales", label: "Legal notice" },
        ],
        faq: [
          {
            question: "How fast does Axion-IA reply?",
            answer:
              "Within 48 business hours. Every message is read by a senior consultant — never a bot, never an outsourced call centre.",
          },
          {
            question: "Does a first conversation commit me to anything?",
            answer:
              "No. It exists to frame your need and to check that we can actually help. You are free to stop there.",
          },
          {
            question: "What happens to the information sent through this form?",
            answer:
              "It is hosted in the European Union and used only to handle your request: no resale, no advertising profiling. You can ask for its deletion at any time.",
          },
          {
            question: "Can I reach you outside this form?",
            answer:
              "Yes: by email at contact@axion-ia.com, or by booking a call slot directly. The form is still the fastest route, because it carries the context with it.",
          },
          {
            question: "Do you work outside your own region?",
            answer:
              "Yes. Remotely across France, and on site from Grenoble, in the Auvergne-Rhône-Alpes region.",
          },
        ],
      };

  const contactJsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "@id": `${SITE_URL}/${loc}/contact#webpage`,
    url: `${SITE_URL}/${loc}/contact`,
    inLanguage: loc,
    isPartOf: { "@type": "WebSite", "@id": `${SITE_URL}/#website` },
    name: "Contact Axion-IA",
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
      // `telephone` n'est émis que si un numéro public est configuré : déclarer
      // un point de contact téléphonique inexistant est un faux renseignement
      // que les moteurs de réponse recopient tel quel. Même condition que
      // l'`Organization` du graphe global (`buildOrganizationJsonLd`), pour que
      // les deux nœuds ne se contredisent jamais.
      ...(env.COMPANY_PHONE ? { telephone: env.COMPANY_PHONE } : {}),
      url: `${SITE_URL}/${loc}/contact`,
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

  // FAQPage émise SÉPARÉMENT du ContactPage, et non fondue dedans : `mainEntity`
  // de ContactPage porte déjà le ContactPoint, qui est l'entité principale de
  // cette page. Deux nœuds distincts, chacun valide — c'est ce que le validateur
  // Google attend quand une page répond à des questions sans être une FAQ.
  //
  // Les cinq réponses sont VISIBLES plus bas dans la page : une FAQPage dont le
  // texte n'existe que dans le JSON-LD est une infraction aux consignes Google
  // (et un mensonge aux moteurs de réponse). Les attributs `data-faq-q` /
  // `data-faq-a` du balisage sont ceux que vise `buildFaqJsonLd` pour Speakable.
  const faqJsonLd = buildFaqJsonLd({ items: t.faq });

  // Masque le Footer global (rendu dans [locale]/layout.tsx) uniquement sur
  // /contact, via le pattern `:has()` du shell admin (cf. layout admin).
  // bg-mocha-rich = classe racine unique du Footer public.
  const hideFooterCss = `
    body:has(.contact-minimal) footer.bg-mocha-rich { display: none !important; }
  `.trim();

  return (
    <div className="contact-minimal bg-halo-warm">
      <style dangerouslySetInnerHTML={{ __html: hideFooterCss }} />

      <Container className="border-border border-b py-2">
        <Breadcrumbs items={[{ href: "/contact", label: "Contact" }]} />
      </Container>

      <section className="pt-4 pb-14 sm:pt-8 sm:pb-20">
        <Container className="max-w-2xl">
          {/* ---- En-tête : trois éléments courts, rien de plus ----
              Le budget vertical est le sujet de cette refonte. Sur un écran de
              390 px, ce bloc doit tenir sous ~185 px pour que « Nom complet »
              reste dans le premier écran. */}
          <p className="text-terracotta-deep flex items-center gap-2 text-[12.5px] font-semibold tracking-[0.1em] uppercase">
            <span aria-hidden="true" className="bg-terracotta h-1.5 w-1.5 rounded-full" />
            {t.kicker}
          </p>
          {/* H1 volontairement PLUS PETIT que `display-editorial` (40 px mini) au
              mobile : à 40 px, « Parlons de vous » passait sur deux lignes et
              coûtait 40 px de défilement pour rien. Il retrouve sa taille
              éditoriale dès `sm`. */}
          <h1
            className="text-fg mt-3 text-[2rem] leading-[1.05] font-medium tracking-[-0.03em] sm:text-[2.75rem] lg:text-5xl"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {t.titleLead}
            <span className="text-terracotta italic">{t.titleEm}</span>
          </h1>
          <p className="text-fg-soft mt-3 text-[15px] leading-relaxed sm:text-base">{t.subtitle}</p>

          {/* ---- Le formulaire, immédiatement ---- */}
          <div className="border-border bg-paper shadow-card relative mt-5 overflow-hidden rounded-3xl border p-4 sm:mt-8 sm:p-7">
            {/* Liseré des 5 accents Axion-IA — signe la carte et fait écho aux
                5 couleurs d'intention des pastilles juste en dessous. */}
            <div aria-hidden="true" className="absolute inset-x-0 top-0 flex h-1.5">
              <span className="bg-primary flex-1" />
              <span className="bg-sage flex-1" />
              <span className="bg-terracotta flex-1" />
              <span className="bg-ochre flex-1" />
              <span className="bg-plum flex-1" />
            </div>
            <div className="pt-2">
              <UnifiedContactForm source="/contact" />
            </div>
          </div>

          {/* ---- Tout le reste vit SOUS le formulaire ---- */}

          {/* Canaux de repli */}
          <div className="border-border bg-paper mt-6 rounded-2xl border p-5">
            <p className="text-fg-muted text-[13px]">{t.altLead}</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:gap-6">
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

          {/* FAQ visible — le pendant obligatoire du JSON-LD FAQPage ci-dessus.
              `data-faq-q` / `data-faq-a` sont les sélecteurs Speakable. */}
          <section className="mt-10" aria-labelledby="contact-faq-title">
            <h2
              id="contact-faq-title"
              className="text-fg text-xl font-medium tracking-tight sm:text-2xl"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {t.faqTitle}
            </h2>
            <dl className="mt-4 space-y-4">
              {t.faq.map((item) => (
                <div
                  key={item.question}
                  className="border-border bg-paper/60 rounded-2xl border px-4 py-3.5"
                >
                  <dt data-faq-q className="text-fg text-[14.5px] font-semibold">
                    {item.question}
                  </dt>
                  <dd data-faq-a className="text-fg-soft mt-1.5 text-[14px] leading-relaxed">
                    {item.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Liens utiles — le Footer global est masqué sur cette page ; sans
              cette rangée, /contact serait un cul-de-sac pour le visiteur ET
              pour le maillage interne. */}
          <nav className="border-border mt-10 border-t pt-5" aria-label={t.linksTitle}>
            <p className="text-fg-muted text-[11px] font-semibold tracking-[0.14em] uppercase">
              {t.linksTitle}
            </p>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
              {t.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href as never}
                    className="text-fg-soft hover:text-terracotta-deep text-[13.5px] underline-offset-4 transition-colors hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Container>
      </section>

      <JsonLd data={contactJsonLd} />
      <JsonLd data={faqJsonLd} />
    </div>
  );
}
