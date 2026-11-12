// « Apporteur d'affaires indépendant · formations IA en entreprise » — cible de l'annonce
// jemepropose.com (2026-08-23). L'adresse est gardée (décision de Williams, 09/11/2026).
//
// Refonte du 09/11/2026 : la page affiche la même offre que la page principale
// (`/devenir-commercial-ia`), générée depuis la même maquette validée. Elle n'a plus de contenu qui
// la différencie : son code disait déjà qu'elle devait passer en `noindex` dès qu'elle deviendrait
// une copie. C'est fait : `noindex, follow`, hors sitemap, canonique vers elle-même. Le trafic de
// l'annonce arrive ici et trouve la page complète ; la page principale garde seule le référencement.
//
// 🔴 GATE QUALIOPI — cette page n'affirme AUCUNE certification (décision du 09/11). Le drapeau est
// pourtant lu ici : la page figure au registre `ASSERTION_SURFACES` du test
// `assertion-flag-surfaces.spec.ts`, et toute affirmation future passera par lui.
//
// ⛔ Aucun JobPosting (décision B5). 🔴 Aucun montant en dur : `pricing.ts` seulement.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";

import { routing } from "@/i18n/routing";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { LandingViewTracker } from "@/components/lp/LandingViewTracker";
import { isQualiopiCertificationObtenue } from "@/server/qualiopi/config/flag";
import { buildProductMetadata } from "@/lib/seo";
import { CreditsPhotos } from "@/components/recrutement/landings/CreditsPhotos";
import { ListeFaq, faqPrincipale } from "@/components/recrutement/landings/faq";
import { chiffresApporteurs } from "@/components/recrutement/landings/chiffres";
import { SectionsPrincipale } from "@/components/recrutement/landings/SectionsPrincipale";
import { ShellLanding } from "@/components/recrutement/landings/ShellLanding";

export const revalidate = 3600;

const PATH = "/apporteur-affaires-independant-formation-ia-entreprise";
const DOSSIER = "/devenir-commercial-ia/candidature";
const LANDING_MESURE = "apporteur-independant";

const TITRE = "Apporteur d'affaires indépendant · la Journée IA · Axion-IA";
const DESCRIPTION =
  "Apporteur d'affaires indépendant : présentez la Journée IA à des dirigeants que vous connaissez, nous faisons le reste. Sans CV, sans frais d'entrée.";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return {
    ...(await buildProductMetadata({
      locale,
      path: PATH,
      title: TITRE,
      description: DESCRIPTION,
    })),
    title: { absolute: TITRE },
    robots: { index: false, follow: true },
  };
}

export default async function ApporteurAffairesPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  // Aucune certification affirmée ici : lecture du drapeau pour le registre des surfaces.
  void isQualiopiCertificationObtenue();

  const p = chiffresApporteurs();

  return (
    <>
      <ShellLanding landing={LANDING_MESURE}>
        <SectionsPrincipale p={p} faq={<ListeFaq items={faqPrincipale(p)} />} />
      </ShellLanding>
      <CreditsPhotos />

      <StickyMobileCta
        href={DOSSIER}
        label="Devenir apporteur"
        track="apporteur-sticky-apply"
        threshold={500}
        suivi={{ landing: LANDING_MESURE }}
        couleur="terracotta"
      />
      <LandingViewTracker landing={LANDING_MESURE} />
    </>
  );
}
