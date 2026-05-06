import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CaseStudyCard } from "@/components/marketing/CaseStudyCard";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { Card, CardContent } from "@/components/ui/card";
import { Price } from "@/components/marketing/Price";
import { JsonLd } from "@/components/marketing/JsonLd";
import { AUDITS } from "@/content/audit";
import { buildProductMetadata, buildBreadcrumbJsonLd } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

const PRICE_MATRIX = [
  { size: "TPE / Artisan (1-9)", remote: 290, onsite: 490 },
  { size: "PME (10-49)", remote: 690, onsite: 990 },
  { size: "Moyenne (50-249)", remote: 1290, onsite: 1990 },
  { size: "Grande (250+)", remote: null, onsite: null }, // on quote
] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/audit",
    title:
      locale === "fr"
        ? "Audit IA · 4 tailles × 2 modalités · à partir de 290 €"
        : "AI audit · 4 sizes × 2 modalities · from €290",
    description:
      locale === "fr"
        ? "Audit IA opérationnel pour entreprises : TPE/PME/Moyenne/Grande × à distance/sur site. Rapport sous 5 jours ouvrés."
        : "Operational AI audit for companies: small/PME/mid/large × remote/on-site. Report within 5 business days.",
  });
}

export default async function AuditListing({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const breadcrumb = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      { name: isFr ? "Audit & optimisation" : "Audit & optimization", href: "/audit" },
    ],
  });

  return (
    <>
      <Section
        titleAs="h1"
        eyebrow={isFr ? "Module 2 · accent orange" : "Module 2 · orange accent"}
        title={isFr ? "Audit & optimisation" : "Audit & optimization"}
        description={
          isFr
            ? "4 tailles d'entreprise × 2 modalités. Rapport audit livré sous 5 jours ouvrés. Plan d'implémentation chiffré inclus."
            : "4 company sizes × 2 modalities. Audit report delivered within 5 business days. Costed implementation plan included."
        }
      />

      <Section eyebrow={isFr ? "Grille tarifaire" : "Price matrix"}>
        <div className="border-border bg-bg overflow-hidden rounded-md border">
          <table className="w-full text-left">
            <thead className="border-border bg-border/30 border-b">
              <tr>
                <th className="text-fg p-4 text-sm font-semibold">{isFr ? "Taille" : "Size"}</th>
                <th className="text-fg p-4 text-sm font-semibold">
                  {isFr ? "À distance" : "Remote"}
                </th>
                <th className="text-fg p-4 text-sm font-semibold">
                  {isFr ? "Sur site" : "On site"}
                </th>
              </tr>
            </thead>
            <tbody>
              {PRICE_MATRIX.map((row) => (
                <tr key={row.size} className="border-border border-b last:border-0">
                  <td className="p-4 text-sm">{row.size}</td>
                  <td className="p-4 text-sm">
                    {row.remote === null ? (
                      <span className="text-gray-700">{isFr ? "Sur devis" : "On quote"}</span>
                    ) : (
                      <Price amount={row.remote} suffix="HT" size="sm" />
                    )}
                  </td>
                  <td className="p-4 text-sm">
                    {row.onsite === null ? (
                      <span className="text-gray-700">{isFr ? "Sur devis" : "On quote"}</span>
                    ) : (
                      <Price amount={row.onsite} suffix="HT" size="sm" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section eyebrow={isFr ? "Choisir un audit" : "Pick an audit"}>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {AUDITS.map((item) => {
            const c = item[loc];
            return (
              <li key={item.slug}>
                <CaseStudyCard
                  href={`/audit/${item.slug}`}
                  title={c.title}
                  excerpt={c.answer.slice(0, 180) + "…"}
                  industry={c.eyebrow}
                />
              </li>
            );
          })}
        </ul>
      </Section>

      <Section eyebrow={isFr ? "Garanties" : "Guarantees"}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-fg text-base font-semibold">
                {isFr ? "Rapport sous 5 jours" : "Report in 5 days"}
              </h3>
              <p className="mt-2 text-sm text-gray-700">
                {isFr
                  ? "Engagement contractuel sur les délais."
                  : "Contractual delivery commitment."}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-fg text-base font-semibold">
                {isFr ? "Quick-wins actionnables" : "Actionable quick-wins"}
              </h3>
              <p className="mt-2 text-sm text-gray-700">
                {isFr ? "Triés par ROI et complexité." : "Sorted by ROI and complexity."}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-fg text-base font-semibold">
                {isFr ? "Plan d'implémentation" : "Implementation plan"}
              </h3>
              <p className="mt-2 text-sm text-gray-700">
                {isFr ? "Roadmap 6-12 mois chiffrée." : "Costed 6-12 month roadmap."}
              </p>
            </CardContent>
          </Card>
        </div>
      </Section>

      <CtaBlock
        eyebrow={isFr ? "Démarrer" : "Start"}
        title={isFr ? "Cartographier vos opportunités IA" : "Map your AI opportunities"}
        description={
          isFr
            ? "Demandez un audit adapté à votre taille — devis sous 48 h ouvrées."
            : "Request an audit sized for you — quote within 48 business hours."
        }
        cta={
          <Cta href="/contact" size="lg">
            {isFr ? "Demander un audit" : "Request an audit"} →
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={breadcrumb} />
    </>
  );
}
