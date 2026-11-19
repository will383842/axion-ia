// Gabarit des landings de RÉCEPTION D'ANNONCE (`/leboncoin`, `/indeed`) — refonte du 09/11/2026.
//
// La page est générée depuis la maquette « annonce » validée par Williams
// (`landings/SectionsPub.tsx`, variante `annonce`) : le visiteur a lu une annonce, il vient
// compléter son dossier. Un seul geste : le dossier de 3 minutes, sans CV. Seul le badge d'entrée
// change par canal (`PARTENAIRE_LANDINGS`) ; l'offre est la même partout (la Journée IA, une
// commission indicative par journée payée).
//
// 🔴 `noindex` : 100 % de leur trafic vient de l'annonce. Les indexer cannibaliserait la page
// principale pour un gain nul (cf. `partenaire-landings.ts`).
//
// 🔴 GATE QUALIOPI — cette page n'affirme AUCUNE certification (décision du 09/11). Le drapeau est
// pourtant lu ici : la page figure au registre `ASSERTION_SURFACES` du test
// `assertion-flag-surfaces.spec.ts`, et toute affirmation future passera par lui.
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
import {
  PARTENAIRE_LANDINGS,
  type PartenaireSource,
} from "@/content/recrutement/partenaire-landings";
import { DOSSIER_COMPLET_PATH } from "@/lib/commercial-application/lead-apporteur";
import { TunnelFacebookShell } from "./TunnelFacebookShell";
import { ShellLanding } from "./landings/ShellLanding";
import { SectionsPub } from "./landings/SectionsPub";
import { chiffresApporteurs } from "./landings/chiffres";

interface Props {
  params: Promise<{ locale: string }>;
  source: PartenaireSource;
}

/** Métadonnées d'une landing de réception — appelée par la route de chaque canal. */
export async function buildPartenaireMetadata(
  locale: string,
  source: PartenaireSource,
): Promise<Metadata> {
  if (!hasLocale(routing.locales, locale)) return {};
  const l = PARTENAIRE_LANDINGS[source];

  // Pas de `buildProductMetadata` ici : ce helper pose les canoniques et les hreflang d'une page
  // destinée au crawl. Celle-ci ne l'est pas.
  return {
    title: { absolute: l.metaTitle },
    description: l.metaDescription,
    robots: { index: false, follow: true },
  };
}

export async function PartenaireLandingPage({ params, source }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale as Locale);

  // Aucune certification affirmée ici : lecture du drapeau pour le registre des surfaces.
  void isQualiopiCertificationObtenue();

  const l = PARTENAIRE_LANDINGS[source];
  const landing = `apporteur-${source}`;

  return (
    <TunnelFacebookShell sousTitre="Apporteurs d'affaires">
      <ShellLanding landing={landing} variante="pub annonce">
        <SectionsPub p={chiffresApporteurs()} annonce canal={l.canal} />
      </ShellLanding>

      <StickyMobileCta
        href={`${DOSSIER_COMPLET_PATH}?depuis=${source}`}
        label="Compléter mon dossier →"
        track={`${source}-sticky-cta`}
        suivi={{ landing }}
        couleur="terracotta"
      />
      <LandingViewTracker landing={landing} />
    </TunnelFacebookShell>
  );
}
