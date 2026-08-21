import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const meta = await buildProductMetadata({
    locale,
    path: "/mes-donnees",
    title: locale === "fr" ? "Mes données RGPD · Axion-IA" : "My GDPR data · Axion-IA",
    description:
      locale === "fr"
        ? "Exercer vos droits RGPD : accès, rectification, effacement, portabilité, opposition."
        : "Exercise your GDPR rights: access, rectification, erasure, portability, objection.",
    alternates: { fr: "/mes-donnees", en: "/my-data" },
  });
  return { ...meta, robots: { index: false, follow: false } };
}

export default async function MyDataPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [{ href: "/mes-donnees", label: isFr ? "Mes données" : "My data" }];

  const rights = isFr
    ? [
        ["Droit d'accès", "Obtenir une copie de toutes vos données traitées."],
        ["Droit de rectification", "Corriger les données inexactes ou incomplètes."],
        ["Droit d'effacement", "Supprimer vos données (sauf obligations légales)."],
        [
          "Droit à la portabilité",
          "Recevoir vos données dans un format structuré machine-readable.",
        ],
        ["Droit d'opposition", "Vous opposer au traitement à tout moment."],
        ["Droit à la limitation", "Geler le traitement le temps d'une vérification."],
      ]
    : [
        ["Right to access", "Obtain a copy of all your processed data."],
        ["Right to rectification", "Correct inaccurate or incomplete data."],
        ["Right to erasure", "Delete your data (except legal obligations)."],
        ["Right to portability", "Receive your data in a structured machine-readable format."],
        ["Right to object", "Object to processing at any time."],
        ["Right to restriction", "Freeze processing during verification."],
      ];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <Section
        titleAs="h1"
        eyebrow="RGPD · GDPR"
        title={isFr ? "Mes données" : "My"}
        titleEm={isFr ? "RGPD" : "GDPR data"}
        description={
          isFr
            ? "Axion-IA traite vos données conformément au RGPD UE 2016/679. Voici comment exercer vos droits."
            : "Axion-IA processes your data in accordance with EU GDPR 2016/679. Here's how to exercise your rights."
        }
      />
      <Section>
        <Container className="max-w-3xl">
          <ul className="border-border divide-border space-y-0 divide-y border-y">
            {rights.map(([h, p]) => (
              <li key={h} className="py-4">
                <h2 className="text-fg text-base font-semibold tracking-tight">{h}</h2>
                <p className="text-fg-soft mt-1 text-base leading-relaxed">{p}</p>
              </li>
            ))}
          </ul>
          <div className="text-fg-soft mt-10 space-y-4 text-base leading-relaxed">
            <p>
              {isFr ? "Pour exercer un droit, écrivez à" : "To exercise a right, email"}{" "}
              {/* 🔴 a11y 2026-08-21 — même défaut qu'à `/fr/desabonnement` :
                  `link-in-text-block`. Celui-ci n'était PAS dans la liste rendue par la
                  CI — ce run avait été tronqué par son plafond de temps. Il a été trouvé
                  en allant voir les voisins de même nature après le premier correctif.
                  C'est aussi, ici, l'adresse d'exercice des droits RGPD (art. 12). */}
              <a className="text-primary underline" href="mailto:contact@axion-ia.com">
                contact@axion-ia.com
              </a>{" "}
              {isFr
                ? "avec votre identité (copie pièce d'identité acceptée). Réponse sous 30 jours conformément à l'art. 12 RGPD."
                : "with your identity (ID copy accepted). Reply within 30 days per Art. 12 GDPR."}
            </p>
            <p>
              {isFr
                ? "En cas de réponse insatisfaisante, vous pouvez saisir la CNIL (Commission Nationale de l'Informatique et des Libertés — www.cnil.fr) ou l'autorité équivalente de votre État membre UE."
                : "If the response is unsatisfactory, you can file a complaint with the CNIL (Commission Nationale de l'Informatique et des Libertés — www.cnil.fr) or the equivalent authority in your EU member state."}
            </p>
            <Cta href="/rgpd" variant="outline">
              {isFr ? "Voir la politique RGPD complète" : "See full GDPR policy"} →
            </Cta>
          </div>
        </Container>
      </Section>
    </>
  );
}
