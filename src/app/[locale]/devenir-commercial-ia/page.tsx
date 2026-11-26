// Page principale des apporteurs d'affaires — `/devenir-commercial-ia` (l'URL historique est
// gardée : elle est indexée).
//
// Refonte du 09/11/2026 : page générée depuis la maquette validée par Williams
// (`components/recrutement/landings/SectionsPrincipale.tsx`). Elle vend UNE seule chose, la Journée
// IA, avec UNE seule commission indicative par journée payée. Depuis le 25/11/2026 (décision de
// Will), tous les boutons mènent à la réservation d'un échange de 15 minutes
// (`/appel/apporteur?depuis=…`). La page `/candidature` reste en place (liens de relance e-mail).
//
// ⚠️ B5 levée pour CETTE SEULE page par décision de Will du 25/11/2026 (risques juridique et Google
// assumés) : un JobPosting prudent, construit hors des dossiers apporteurs
// (`lib/seo/job-posting-apporteur.ts`). `/memo-isere` reste exclue ; la spec
// `plus-d-offre-d-emploi-google-pour-les-apporteurs` verrouille les deux faces.
//
// 🔴 Aucun montant en dur : tout vient de `pricing.ts` (`landings/chiffres.ts`).
// Vocabulaire : « apporteur d'affaires » ; le mot « commercial » ne reste que dans l'adresse.

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { JsonLd } from "@/components/marketing/JsonLd";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { buildCommercialKeywords } from "@/content/recrutement/commercial-offer";
import { isQualiopiCertificationObtenue } from "@/server/qualiopi/config/flag";
import { buildProductMetadata } from "@/lib/seo";
import { buildApporteurJobPostingJsonLd } from "@/lib/seo/job-posting-apporteur";
import { CreditsPhotos } from "@/components/recrutement/landings/CreditsPhotos";
import { ListeFaq, faqPrincipale } from "@/components/recrutement/landings/faq";
import { faqApporteurs, webPageApporteurs } from "@/components/recrutement/landings/jsonld";
import { chiffresApporteurs } from "@/components/recrutement/landings/chiffres";
import { SectionsPrincipale } from "@/components/recrutement/landings/SectionsPrincipale";
import { ShellLanding } from "@/components/recrutement/landings/ShellLanding";

export const revalidate = 3600;

const PATH = "/devenir-commercial-ia";
const RESERVATION = "/appel/apporteur?depuis=mobile";
const LANDING_MESURE = "apporteur-principale";

interface Props {
  params: Promise<{ locale: string }>;
}

/** Titre et description : le montant n'y figure que si l'interrupteur R7 le publie. */
function textesMeta() {
  const p = chiffresApporteurs();
  return p.commissionPublique
    ? {
        title: `Apporteur d'affaires IA · ${p.commission} HT indicatifs · Axion-IA`,
        description: `Vous connaissez des dirigeants de PME ? Présentez-leur la Journée IA, nous faisons le reste. ${p.commission} HT indicatifs par journée payée. Sans CV, sans frais.`,
      }
    : {
        title: "Apporteur d'affaires IA indépendant · Journée IA · Axion-IA",
        description:
          "Vous connaissez des dirigeants de PME ? Présentez-leur la Journée IA, nous faisons le reste. Une commission sur chaque journée payée. Sans CV, sans frais.",
      };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const { title, description } = textesMeta();
  return {
    ...(await buildProductMetadata({ locale, path: PATH, title, description })),
    title: { absolute: title },
    keywords: buildCommercialKeywords({ financementAffichable: isQualiopiCertificationObtenue() }),
  };
}

export default async function DevenirCommercialHub({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;

  const p = chiffresApporteurs();
  const faq = faqPrincipale(p);
  const { description } = textesMeta();
  const jobPosting = buildApporteurJobPostingJsonLd(locale);

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={[{ href: PATH, label: "Devenir apporteur d'affaires" }]} />
      </Container>

      <ShellLanding landing={LANDING_MESURE}>
        <SectionsPrincipale p={p} faq={<ListeFaq items={faq} />} />
      </ShellLanding>
      <CreditsPhotos />

      <JsonLd
        data={webPageApporteurs({
          locale: loc,
          path: PATH,
          name: "Devenir apporteur d'affaires IA · Axion-IA",
          description,
          speakable: [".en-bref p:not(.maj)", "h1"],
          ariane: true,
        })}
        scriptId="jsonld-commercial-webpage"
      />
      <JsonLd data={faqApporteurs(faq)} scriptId="jsonld-commercial-faq" />
      {jobPosting ? <JsonLd data={jobPosting} scriptId="jsonld-commercial-jobposting" /> : null}

      <StickyMobileCta
        href={RESERVATION}
        label="Réserver mon échange"
        track="commercial-sticky-apply"
        threshold={500}
        suivi={{ landing: LANDING_MESURE }}
        couleur="terracotta"
      />
    </>
  );
}
