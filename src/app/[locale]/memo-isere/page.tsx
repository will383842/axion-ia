// Landing de la presse locale — `/memo-isere` (l'URL est gardée : elle figure dans une annonce
// déjà publiée, et l'ancre `#postuler` aussi).
//
// Refonte du 09/11/2026 : la page est générée depuis la maquette « annonce » validée par Williams
// (`components/recrutement/landings/SectionsPub.tsx`, variante `annonce`), la même que `/leboncoin`
// et `/indeed` ; seul le badge d'entrée change. Le lecteur du journal vient compléter son dossier :
// un seul geste, le dossier de 3 minutes, sans CV.
//
// Décision de Williams (règle r01) : jamais de nom de grande ville de la région en communication.
// Le badge dit « Vu dans Le Mémo de l'Isère · près de chez vous » ; la zone des 474 communes, qui
// citait Grenoble, n'est plus affichée (`memo-isere-zone.ts` reste pour la console).
//
// 🔴 GATE QUALIOPI — cette page n'affirme AUCUNE certification (décision du 09/11). Le drapeau est
// pourtant lu ici : la page figure au registre `ASSERTION_SURFACES` du test
// `assertion-flag-surfaces.spec.ts`, et toute affirmation future passera par lui.
//
// ⛔ Aucun JobPosting (décision B5 du 2026-09-19). Aucun montant en dur : `pricing.ts` seulement.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";

import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { JsonLd } from "@/components/marketing/JsonLd";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { LandingViewTracker } from "@/components/lp/LandingViewTracker";
import { isQualiopiCertificationObtenue } from "@/server/qualiopi/config/flag";
import { buildProductMetadata } from "@/lib/seo";
import { DOSSIER_COMPLET_PATH } from "@/lib/commercial-application/lead-apporteur";
import { TunnelFacebookShell } from "@/components/recrutement/TunnelFacebookShell";
import { faqApporteurs, webPageApporteurs } from "@/components/recrutement/landings/jsonld";
import { chiffresApporteurs } from "@/components/recrutement/landings/chiffres";
import { SectionsPub } from "@/components/recrutement/landings/SectionsPub";
import { SectionFaq, faqMemoIsere } from "@/components/recrutement/landings/faq-pages";
import { ShellLanding } from "@/components/recrutement/landings/ShellLanding";

export const revalidate = 3600;

const PATH = "/memo-isere";
const LANDING_MESURE = "apporteur-memo-isere";
const CANAL = "Vu dans Le Mémo de l’Isère · près de chez vous";

interface Props {
  params: Promise<{ locale: string }>;
}

/** Titre et description : le montant n'y figure que si l'interrupteur R7 le publie. */
function textesMeta() {
  const p = chiffresApporteurs();
  return p.commissionPublique
    ? {
        title: `Apporteur d'affaires Isère · ${p.commission} HT indicatifs · Axion-IA`,
        description: `Vu dans Le Mémo de l'Isère : présentez la Journée IA aux dirigeants que vous connaissez, nous faisons le reste. ${p.commission} HT indicatifs par journée payée.`,
      }
    : {
        title: "Apporteur d'affaires IA en Isère · Journée IA · Axion-IA",
        description:
          "Vu dans Le Mémo de l'Isère : présentez la Journée IA aux dirigeants que vous connaissez, nous faisons le reste. Une commission sur chaque journée payée.",
      };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const { title, description } = textesMeta();
  return {
    ...(await buildProductMetadata({ locale, path: PATH, title, description })),
    title: { absolute: title },
  };
}

export default async function MemoIserePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  // Aucune certification affirmée ici : lecture du drapeau pour le registre des surfaces.
  void isQualiopiCertificationObtenue();

  const { description } = textesMeta();
  const p = chiffresApporteurs();
  const faq = faqMemoIsere(p);

  return (
    <TunnelFacebookShell sousTitre="Apporteurs d'affaires">
      <Container className="border-border border-b py-3">
        <Breadcrumbs
          items={[{ href: PATH, label: "Apporteurs d'affaires · Le Mémo de l'Isère" }]}
        />
      </Container>

      {/* Ancre publiée dans une annonce : à ne pas retirer. */}
      <span id="postuler" />
      <ShellLanding landing={LANDING_MESURE} variante="pub annonce">
        <SectionsPub p={p} annonce canal={CANAL} />
        <SectionFaq items={faq} id="questions" />
      </ShellLanding>

      <JsonLd
        data={webPageApporteurs({
          locale: locale as Locale,
          path: PATH,
          name: "Apporteur d'affaires IA en Isère · Axion-IA",
          description,
          speakable: ["h1", ".h-sous"],
          ariane: true,
        })}
        scriptId="jsonld-memo-webpage"
      />
      <JsonLd data={faqApporteurs(faq)} scriptId="jsonld-memo-faq" />

      <StickyMobileCta
        href={`${DOSSIER_COMPLET_PATH}?depuis=memo-isere`}
        label="Compléter mon dossier →"
        track="memo-sticky-apply"
        suivi={{ landing: LANDING_MESURE }}
        couleur="terracotta"
      />
      <LandingViewTracker landing={LANDING_MESURE} />
    </TunnelFacebookShell>
  );
}
