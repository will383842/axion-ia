// Landing du tunnel Facebook apporteurs d'affaires — `/apporteur-affaires`.
//
// Refonte du 09/11/2026 : la page est générée depuis la maquette validée par Williams
// (`landings/SectionsPub.tsx`). Elle vend UNE seule chose, la Journée IA, avec UNE seule commission
// indicative par journée payée. Le visiteur vient d'un post, sur son téléphone, sans rien avoir
// décidé : le formulaire court est dans le héros (quatre champs), le dossier complet vient après,
// par l'e-mail. L'échange de 15 minutes part sur invitation (décision Will 2026-09-19).
//
// 🔴 `noindex` : page de réception d'une campagne. L'indexer cannibaliserait la page principale.
//
// 🔴 GATE QUALIOPI — cette page n'affirme AUCUNE certification (décision du 09/11). Le drapeau est
// pourtant lu ici : la page figure au registre `ASSERTION_SURFACES` du test
// `assertion-flag-surfaces.spec.ts`, et toute affirmation future passera par lui.
//
// 🔴 Aucun montant en dur : tout vient de `pricing.ts` (`landings/chiffres.ts`).
//
// Vocabulaire : « apporteur d'affaires », jamais « commercial » / « poste » / « recrute ».

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";

import { routing, type Locale } from "@/i18n/routing";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { LandingViewTracker } from "@/components/lp/LandingViewTracker";
import { isQualiopiCertificationObtenue } from "@/server/qualiopi/config/flag";
import { HERO, TUNNEL_FACEBOOK_META } from "@/content/recrutement/tunnel-facebook";
import { TUNNEL_FACEBOOK_PATH } from "@/lib/commercial-application/lead-apporteur";
import { TunnelFacebookShell } from "./TunnelFacebookShell";
import { LeadApporteurForm } from "./LeadApporteurForm";
import { ShellLanding } from "./landings/ShellLanding";
import { SectionsPub } from "./landings/SectionsPub";
import { chiffresApporteurs } from "./landings/chiffres";

const ANCRE_FORMULAIRE = `${TUNNEL_FACEBOOK_PATH}#contact`;

/**
 * Identifiant de cette page dans la mesure du tunnel (`landing`). Cette page est le TÉMOIN du test
 * contre la page vidéo : on la mesure sans la modifier.
 */
const LANDING_MESURE = "apporteur-court";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function buildFacebookLandingMetadata(locale: string): Promise<Metadata> {
  if (!hasLocale(routing.locales, locale)) return {};
  return {
    title: { absolute: TUNNEL_FACEBOOK_META.title },
    description: TUNNEL_FACEBOOK_META.description,
    robots: { index: false, follow: true },
  };
}

export async function FacebookLandingPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale as Locale);

  // Aucune certification affirmée ici : lecture du drapeau pour le registre des surfaces.
  void isQualiopiCertificationObtenue();

  return (
    <TunnelFacebookShell sousTitre="Apporteurs d'affaires">
      <ShellLanding landing={LANDING_MESURE} variante="pub">
        <SectionsPub p={chiffresApporteurs()} formulaire={<LeadApporteurForm />} />
      </ShellLanding>

      <StickyMobileCta
        href={ANCRE_FORMULAIRE}
        label={`${HERO.cta} →`}
        track="facebook-sticky-cta"
        suivi={{ landing: LANDING_MESURE }}
        couleur="terracotta"
        masquerQuandVisible="contact"
      />
      <LandingViewTracker landing={LANDING_MESURE} />
    </TunnelFacebookShell>
  );
}
