// Page MERCI du tunnel Facebook — `/apporteur-affaires/merci?c=<submissionId>`.
//
// C'est la page la plus rentable du tunnel, et la plus souvent négligée :
// le visiteur vient de donner ses coordonnées, il est au maximum de son
// attention. Elle fait trois choses :
//   1. dit que c'est noté et qu'un e-mail arrive (spams compris) ;
//   2. donne le KIT — document de présentation + catalogue, pour découvrir ce
//      qu'on recommandera (décision Will 2026-09-19) ;
//   3. propose de compléter le dossier (3 min, sans CV), pré-rempli.
//
// Et c'est ici que le pixel Meta compte la conversion (`MerciLeadMeta`), avec
// l'identifiant de la Submission en `eventID`, dédoublonné avec l'envoi serveur.
//
// ⛔ Plus de calendrier ici (2026-09-19). Le lien de réservation de l'échange
// de 15 minutes n'est envoyé qu'aux personnes que Will choisit, depuis la
// console : affiché à chaque personne qui laisse son numéro, il saturerait son
// agenda. La page dit donc simplement qu'on appelle — sans délai chiffré.
//
// `noindex` : page de fin de tunnel, sans contenu à indexer.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { BookOpen, FileText, MailCheck } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { TunnelFacebookShell } from "@/components/recrutement/TunnelFacebookShell";
import { MerciLeadMeta } from "@/components/recrutement/MerciLeadMeta";
import { MERCI } from "@/content/recrutement/tunnel-facebook";
import { DOSSIER_COMPLET_PATH } from "@/lib/commercial-application/lead-apporteur";
import { liensKitApporteur } from "@/lib/commercial-application/kit-apporteur";

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
  const kit = liensKitApporteur(locale === "en" ? "en" : "fr");

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

      {/* Étape A — le kit : découvrir ce qu'on recommandera. Deux boutons
          SECONDAIRES : l'action principale de la page reste le dossier. */}
      <Section className="py-8 sm:py-12 lg:py-14">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="bg-terracotta-soft text-terracotta-deep flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            >
              <BookOpen className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-fg font-serif text-2xl leading-tight font-semibold sm:text-3xl">
                {MERCI.kitTitre}
              </h2>
              <p className="text-fg-soft mt-2 leading-relaxed">{MERCI.kitTexte}</p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Cta
                  href={kit.documentUrl}
                  size="lg"
                  variant="outline"
                  external
                  track="facebook-merci-document"
                  className="w-full justify-center sm:w-auto"
                >
                  {MERCI.kitDocument} →
                </Cta>
                <Cta
                  href={kit.catalogueUrl}
                  size="lg"
                  variant="outline"
                  external
                  track="facebook-merci-catalogue"
                  className="w-full justify-center sm:w-auto"
                >
                  {MERCI.kitCatalogue} →
                </Cta>
              </div>
            </div>
          </div>
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
