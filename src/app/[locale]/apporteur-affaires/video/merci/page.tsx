// Page MERCI de la page VSL apporteurs — `/fr/apporteur-affaires/video/merci`.
//
// La personne vient de laisser son e-mail, son téléphone et sa réponse : elle est
// au maximum de son attention, et l'étape utile est UNE : choisir son créneau de
// 15 minutes (décision du plan 03 : « Calendly tout de suite après l'étape 2 »,
// jamais après la seule étape 1).
//
// ── DYNAMIQUE, et c'est voulu ───────────────────────────────────────────────
// Le lien Calendly vient de `CALENDLY_APPORTEUR_URL`, variable d'EXÉCUTION de
// Coolify, absente au build GitHub Actions : une page statique figerait le lien
// par défaut. `force-dynamic` + lecture de `env` au rendu. Volume faible, un
// rendu serveur par visite est acceptable (le TTFB se surveille).
//
// ── Ce que la page donne, du plus sûr au plus riche ─────────────────────────
//  1. un gros bouton « Choisir mon créneau » : un LIEN, qui marche sans
//     JavaScript et sans consentement (navigation à l'initiative du visiteur) ;
//  2. Calendly intégré, chargé au CLIC (ADR 0034) ;
//  3. la ligne « vous recevez aussi le lien par e-mail » : le secours si la
//     personne ferme la page avant de réserver ;
//  4. le kit (le catalogue) pour découvrir ce qu'on recommandera.
//
// ⛔ Aucun numéro de téléphone, aucun délai de réponse chiffré.
// `noindex` : fin de tunnel, rien à indexer. Hérite du pixel Meta par son chemin
// (`/apporteur-affaires/…`), sans modifier `isRouteTunnelFacebook`.

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { BookOpen, MailCheck } from "lucide-react";

import { routing, type Locale } from "@/i18n/routing";
import { env } from "@/env";
import { SITE_URL } from "@/lib/site-url";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { avecCouleursAxion } from "@/components/booking/calendly-brand";
import { TunnelFacebookShell } from "@/components/recrutement/TunnelFacebookShell";
import { VslMerciCalendly } from "@/components/recrutement/VslMerciCalendly";
import { VSL_MERCI, VSL_MERCI_PATH, VSL_SLUG } from "@/content/recrutement/vsl-apporteur";
import {
  liensKitApporteur,
  estLienCalendlyValide,
} from "@/lib/commercial-application/kit-apporteur";
import { UTM_COOKIE_NAME, deserializeUtmCookie } from "@/lib/utm";
import { URL_CALENDLY_APPORTEUR_PAR_DEFAUT } from "@/server/calendly/type-rendez-vous";
import {
  avecUtmContent,
  lireSuiviArrivee,
  type SuiviArrivee,
} from "@/server/calendly/choix-rendez-vous";

export const dynamic = "force-dynamic";

/** Le « bouton d'origine » transmis à Calendly (`utm_content`) pour cette page. */
const UTM_CONTENT_CALENDLY = "vsl-apporteur";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return {
    title: { absolute: `${VSL_MERCI.title} — Axion-IA` },
    description: VSL_MERCI.description,
    robots: { index: false, follow: false },
  };
}

/** Lien Calendly de l'échange apporteur : la variable d'exécution si elle est valide, sinon le défaut. */
function lienCalendlyApporteur(): string {
  const configure = env.CALENDLY_APPORTEUR_URL?.trim();
  return configure && estLienCalendlyValide(configure)
    ? configure
    : URL_CALENDLY_APPORTEUR_PAR_DEFAUT;
}

/** Adresse d'intégration : mêmes réglages que `CalendlyInlineWidget` (pas de bandeau natif, couleurs du site). */
function adresseIntegree(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("hide_event_type_details", "1");
    // `hide_gdpr_banner` : notre propre écran de consentement (`CalendlyConsentGate`)
    // informe AVANT le chargement ; le bandeau natif arriverait après les cookies.
    u.searchParams.set("hide_gdpr_banner", "1");
    return avecCouleursAxion(u.toString());
  } catch {
    return url;
  }
}

export default async function Page({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale as Locale);

  // Attribution : les UTM de l'adresse d'abord, sinon ceux du cookie posé à l'arrivée.
  const sp = await searchParams;
  let suivi: SuiviArrivee = lireSuiviArrivee(sp);
  if (!suivi.utm_source && !suivi.utm_medium && !suivi.utm_campaign) {
    const cookie = (await cookies()).get(UTM_COOKIE_NAME)?.value;
    if (cookie) {
      const utm = deserializeUtmCookie(cookie);
      suivi = {
        ...(utm.utm_source ? { utm_source: utm.utm_source } : {}),
        ...(utm.utm_medium ? { utm_medium: utm.utm_medium } : {}),
        ...(utm.utm_campaign ? { utm_campaign: utm.utm_campaign } : {}),
      };
    }
  }

  const base = lienCalendlyApporteur();
  const lien = avecUtmContent(base, UTM_CONTENT_CALENDLY, suivi);
  const integre = avecUtmContent(adresseIntegree(base), UTM_CONTENT_CALENDLY, suivi);

  const trackingContext: {
    pageUrl: string;
    utmSource?: string;
    utmCampaign?: string;
    utmMedium?: string;
    utmContent?: string;
  } = {
    pageUrl: `${SITE_URL}/${locale}${VSL_MERCI_PATH}`,
    utmContent: UTM_CONTENT_CALENDLY,
  };
  if (suivi.utm_source) trackingContext.utmSource = suivi.utm_source;
  if (suivi.utm_campaign) trackingContext.utmCampaign = suivi.utm_campaign;
  if (suivi.utm_medium) trackingContext.utmMedium = suivi.utm_medium;

  const kit = liensKitApporteur("fr");

  return (
    <TunnelFacebookShell sousTitre="Apporteurs d'affaires">
      <Section tone="halo-warm" className="pt-10 pb-10 sm:pt-14 sm:pb-12 lg:pt-14 lg:pb-14">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="display-editorial text-fg text-balance">{VSL_MERCI.title}</h1>
          <p className="text-fg-soft mt-4 mb-8 text-lg leading-relaxed">{VSL_MERCI.texte}</p>

          <VslMerciCalendly
            lien={lien}
            integre={integre}
            landing={VSL_SLUG}
            trackingContext={trackingContext}
          />

          <p className="text-fg-soft bg-paper border-border mx-auto mt-8 inline-flex items-start gap-2.5 rounded-xl border px-4 py-3 text-left text-sm leading-relaxed">
            <MailCheck aria-hidden="true" className="text-sage mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {VSL_MERCI.email} {VSL_MERCI.aucunCreneau}
            </span>
          </p>
        </div>
      </Section>

      {/* Le kit : découvrir ce qu'on recommandera. Secondaire : l'action est le créneau. */}
      <Section className="py-10 sm:py-12 lg:py-14">
        <div className="mx-auto flex max-w-xl items-start gap-3">
          <span
            aria-hidden="true"
            className="bg-terracotta-soft text-terracotta-deep flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          >
            <BookOpen className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-fg font-serif text-xl leading-tight font-semibold sm:text-2xl">
              {VSL_MERCI.kitTitre}
            </h2>
            <div className="mt-4">
              <Cta
                href={kit.catalogueUrl}
                size="lg"
                variant="outline"
                external
                track="vsl-merci-catalogue"
                className="w-full justify-center sm:w-auto"
              >
                {VSL_MERCI.kitCatalogue} →
              </Cta>
            </div>
          </div>
        </div>
      </Section>
    </TunnelFacebookShell>
  );
}
