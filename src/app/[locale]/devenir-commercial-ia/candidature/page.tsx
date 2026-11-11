// Dossier d'apporteur d'affaires — `/devenir-commercial-ia/candidature` (l'URL est gardée : elle
// est la destination de tous les boutons des landings et des e-mails de relance).
//
// Refonte du 09/11/2026 : la page est générée depuis la maquette validée par Williams
// (`landings/SectionsDossier.tsx`). Le formulaire est celui qui existe déjà — une question par
// écran, brouillon enregistré, reprise par e-mail — posé là où la maquette montrait l'écran 1.
//
// Vocabulaire : « apporteur d'affaires », jamais « commercial » / « candidature » dans le texte.
// 🔴 Aucun montant en dur : tout vient de `pricing.ts` (`landings/chiffres.ts`).

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { JsonLd } from "@/components/marketing/JsonLd";
import { CommercialApplicationWizard } from "@/components/forms/commercial-application/CommercialApplicationWizard";
import { buildCommercialKeywords } from "@/content/recrutement/commercial-offer";
import { isQualiopiCertificationObtenue } from "@/server/qualiopi/config/flag";
import { buildProductMetadata } from "@/lib/seo";
import { faqApporteurs, webPageApporteurs } from "@/components/recrutement/landings/jsonld";
import { chiffresApporteurs } from "@/components/recrutement/landings/chiffres";
import { SectionsDossier } from "@/components/recrutement/landings/SectionsDossier";
import { SectionFaq, faqDossier } from "@/components/recrutement/landings/faq-pages";
import { ShellLanding } from "@/components/recrutement/landings/ShellLanding";

export const revalidate = 3600;

const PATH = "/devenir-commercial-ia/candidature";
const LANDING_MESURE = "apporteur-dossier";

const TITRE = "Dossier apporteur d'affaires : 3 minutes, sans CV · Axion-IA";
const DESCRIPTION =
  "Trois minutes, une question par écran, sans CV. Un e-mail de confirmation, puis une invitation à un échange de 15 minutes en visio. Nous répondons à tous.";

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
    keywords: buildCommercialKeywords({ financementAffichable: isQualiopiCertificationObtenue() }),
  };
}

export default async function DossierApporteurPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const p = chiffresApporteurs();
  const faq = faqDossier(p);

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs
          items={[
            { href: "/devenir-commercial-ia", label: "Devenir apporteur d'affaires" },
            { href: PATH, label: "Dossier" },
          ]}
        />
      </Container>

      <ShellLanding landing={LANDING_MESURE}>
        <SectionsDossier p={p} formulaire={<CommercialApplicationWizard />} />
        <SectionFaq items={faq} id="questions" />
      </ShellLanding>

      <JsonLd
        data={webPageApporteurs({
          locale: locale as Locale,
          path: PATH,
          name: "Dossier apporteur d'affaires · Axion-IA",
          description: DESCRIPTION,
          speakable: ["h1", ".h-sous"],
          ariane: true,
        })}
        scriptId="jsonld-dossier-webpage"
      />
      <JsonLd data={faqApporteurs(faq)} scriptId="jsonld-dossier-faq" />
    </>
  );
}
