// Page MERCI du tunnel Facebook — `/facebook/merci?c=<submissionId>`.
//
// C'est la page la plus rentable du tunnel, et la plus souvent négligée :
// le visiteur vient de donner ses coordonnées, il est au maximum de son
// attention. Elle fait trois choses :
//   1. dit que c'est noté et qu'un e-mail arrive (spams compris) ;
//   2. propose de CHOISIR le moment de l'appel — un candidat qui réserve
//      lui-même se convertit mieux qu'un candidat qu'on rappelle ;
//   3. propose de compléter le dossier (3 min, sans CV), pré-rempli.
//
// Et c'est ici que le pixel Meta compte la conversion (`MerciLeadMeta`), avec
// l'identifiant de la Submission en `eventID`, dédoublonné avec l'envoi serveur.
//
// Le calendrier est celui des APPELS D'APPORTEURS (`NEXT_PUBLIC_CALENDLY_APPORTEUR_URL`),
// distinct de l'appel client de `/appel`. Absent = on dit simplement qu'on
// appelle — jamais un délai chiffré (règle Will 2026-08-23).
//
// `noindex` : page de fin de tunnel, sans contenu à indexer. Statique, mais
// revalidée toutes les 10 min pour que les créneaux du calendrier restent frais.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { CalendarCheck, FileText, MailCheck } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { env } from "@/env";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CalendlyInlineWidget } from "@/components/booking/CalendlyInlineWidget";
import { TunnelFacebookShell } from "@/components/recrutement/TunnelFacebookShell";
import { MerciLeadMeta } from "@/components/recrutement/MerciLeadMeta";
import { MERCI } from "@/content/recrutement/tunnel-facebook";
import { DOSSIER_COMPLET_PATH } from "@/lib/commercial-application/lead-apporteur";

export const revalidate = 600;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return {
    title: { absolute: "C'est noté — Axion-IA" },
    description: MERCI.description,
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale as Locale);
  const isFr = locale === "fr";
  const calendlyUrl = env.NEXT_PUBLIC_CALENDLY_APPORTEUR_URL;

  return (
    <TunnelFacebookShell sousTitre="Apporteurs d'affaires">
      {/* L'île porte sa propre frontière Suspense : la page reste statique. */}
      <MerciLeadMeta />

      <Section tone="halo-warm" className="pt-10 pb-8 sm:pt-14 sm:pb-10 lg:pt-16 lg:pb-12">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="display-editorial text-fg text-balance">{MERCI.title}</h1>
          <p className="text-fg-soft mt-4 text-lg leading-relaxed">{MERCI.description}</p>
          <p className="text-fg-soft bg-paper border-border mx-auto mt-6 inline-flex items-start gap-2.5 rounded-xl border px-4 py-3 text-left text-sm leading-relaxed">
            <MailCheck aria-hidden="true" className="text-sage mt-0.5 h-4 w-4 shrink-0" />
            <span>{MERCI.email}</span>
          </p>
        </div>
      </Section>

      {/* Étape A — choisir le moment de l'appel. */}
      <Section className="py-8 sm:py-12 lg:py-14">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="bg-terracotta-soft text-terracotta-deep flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            >
              <CalendarCheck className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-fg font-serif text-2xl leading-tight font-semibold sm:text-3xl">
                {MERCI.creneauTitre}
              </h2>
              <p className="text-fg-soft mt-2 leading-relaxed">
                {calendlyUrl ? MERCI.creneauTexte : MERCI.creneauAbsent}
              </p>
            </div>
          </div>
          {calendlyUrl ? (
            <div className="bg-paper border-border shadow-card mt-6 rounded-2xl border p-1.5">
              <CalendlyInlineWidget
                calendlyUrl={calendlyUrl}
                isFr={isFr}
                height={640}
                locale={locale}
              />
            </div>
          ) : null}
        </div>
      </Section>

      {/* Étape B — compléter le dossier, pré-rempli. */}
      <Section tone="sand" className="py-10 sm:py-14 lg:py-16">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="bg-terracotta-soft text-terracotta-deep flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            >
              <FileText className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-fg font-serif text-2xl leading-tight font-semibold sm:text-3xl">
                {MERCI.dossierTitre}
              </h2>
              <p className="text-fg-soft mt-2 leading-relaxed">{MERCI.dossierTexte}</p>
              <div className="mt-5">
                <Cta
                  href={DOSSIER_COMPLET_PATH}
                  size="lg"
                  track="facebook-merci-dossier"
                  className="w-full justify-center sm:w-auto"
                >
                  {MERCI.dossierCta} →
                </Cta>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </TunnelFacebookShell>
  );
}
