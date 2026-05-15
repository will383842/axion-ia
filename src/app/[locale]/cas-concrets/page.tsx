import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  FileText,
  Building2,
  BarChart3,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { CaseStudiesHeroSchema } from "@/components/sections/CaseStudiesHeroSchema";
import { Illustration } from "@/components/visual/Illustration";
import { JsonLd } from "@/components/marketing/JsonLd";
import { CASE_STUDIES } from "@/content/case-studies";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata, buildItemListJsonLd } from "@/lib/seo";
import { INTERVENTION_TIERS, formatAmount, getTierById } from "@/content/pricing";
import {
  CaseStudiesFilteredGrid,
  CaseStudiesFilterPills,
  type CaseDescriptor,
} from "./CaseStudiesFilteredGrid";

// ISR public — la page est purement statique côté serveur, le filtre joue
// uniquement côté client (cf. CaseStudiesFilteredGrid). Cache CDN-friendly :
// `Cache-Control: public, max-age=..., s-maxage=86400, must-revalidate`.
// Audit Edge 2026-05-15 AGENT 5 §5.7.
export const revalidate = 86400;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/cas-concrets",
    title:
      locale === "fr"
        ? "Cas concrets · résultats clients chiffrés · Axion-IA"
        : "Case studies · client results, in numbers · Axion-IA",
    description:
      locale === "fr"
        ? "Études de cas IA opérationnelle : industrie, juridique, retail, banque, artisanat. Résultats chiffrés, témoignages, contexte."
        : "Operational AI case studies: industry, legal, retail, banking, trades. Numerical results, testimonials, context.",
    alternates: { fr: "/cas-concrets", en: "/case-studies" },
  });
}

export default async function CaseStudiesListing({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  // Toutes les cas concrets — exposés côté serveur + au Client Component pour
  // filtrage CSS. Server ne consomme PLUS `searchParams` (qui forçait la page
  // en dynamic SSR `Cache-Control: private`). Audit Edge 2026-05-15 §5.7.
  const allIndustries = Array.from(
    new Set(CASE_STUDIES.map((c) => (isFr ? c.industry : c.industryEn))),
  );

  // Descripteurs sérialisables pour le Client Component (1 fois en payload
  // JSON inline ; excerpt + meta seulement, pas le body complet du cas).
  const caseDescriptors: ReadonlyArray<CaseDescriptor> = CASE_STUDIES.map((c) => {
    const copy = c[loc];
    return {
      slug: c.slug,
      title: copy.title,
      excerpt: copy.excerpt,
      industry: isFr ? c.industry : c.industryEn,
      industryKey: c.industry.toLowerCase(),
      industryKeyEn: c.industryEn.toLowerCase(),
      size: c.size,
      metric: c.metric,
    };
  });
  const allSizes: ReadonlyArray<{ key: string; label: string }> = [
    { key: "tpe", label: isFr ? "TPE" : "Small" },
    { key: "pme", label: "PME" },
    { key: "mid", label: isFr ? "Moyenne" : "Mid" },
    { key: "enterprise", label: isFr ? "Grande" : "Enterprise" },
  ];

  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [
    { href: "/cas-concrets", label: isFr ? "Cas concrets" : "Case studies" },
  ];

  // ItemList JSON-LD — expose tous les cas concrets au crawler depuis l'index
  // (AEO/GEO 2026 : LLMs résolvent « cas clients Axion-IA » avec liens directs).
  const itemListJsonLd = buildItemListJsonLd({
    locale: loc,
    path: "/cas-concrets",
    name: isFr ? "Cas concrets Axion-IA" : "Axion-IA case studies",
    items: CASE_STUDIES.map((c, idx) => {
      const copy = c[loc];
      const desc = copy.excerpt;
      return {
        position: idx + 1,
        name: copy.title,
        url: `https://axion-ia.com/${loc}/cas-concrets/${c.slug}`,
        ...(desc ? { description: desc.slice(0, 200) } : {}),
      };
    }),
  });

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      {/* HERO 2 colonnes — texte à gauche, stack de mini-cards de cas réels
          à droite (CaseStudiesHeroSchema). Aligné sur le pattern audit /
          interventions / implementation. */}
      <section className="bg-halo-warm text-fg relative pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-16 lg:pb-28">
        <Container className="relative">
          <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16">
            {/* Colonne gauche — eyebrow + titre + description */}
            <div className="max-w-xl">
              <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-sage mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
                />
                {isFr
                  ? "Cas réels · de l'artisan au grand groupe"
                  : "Real cases · from artisans to large groups"}
              </p>
              <h1 className="text-fg display-editorial mt-5">
                {isFr ? "Ce qu'ils ont " : "What they've "}
                <span className="text-sage mx-2 italic" style={{ fontFamily: "var(--font-serif)" }}>
                  {isFr ? "concrètement gagné" : "actually gained"}
                </span>
              </h1>
              <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
                {isFr
                  ? "Industrie, juridique, retail, banque, artisanat. Toutes les tailles, toutes les régions, tous les budgets — résultats chiffrés et témoignages anonymisés."
                  : "Industry, legal, retail, banking, trades. All sizes, all regions, all budgets — numerical results and anonymised testimonials."}
              </p>
              {/* Pills réassurance */}
              <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2.5">
                {[
                  {
                    icon: FileText,
                    label: `${CASE_STUDIES.length} ${isFr ? "cas concrets" : "case studies"}`,
                  },
                  {
                    icon: Building2,
                    label: isFr
                      ? `${allIndustries.length} secteurs`
                      : `${allIndustries.length} industries`,
                  },
                  { icon: BarChart3, label: isFr ? "Métriques chiffrées" : "Quantified metrics" },
                  {
                    icon: ShieldCheck,
                    label: isFr ? "Témoignages anonymisés" : "Anonymised testimonials",
                  },
                ].map((pill) => {
                  const Icon = pill.icon;
                  return (
                    <li
                      key={pill.label}
                      className="text-fg-soft inline-flex items-center gap-2 text-sm"
                    >
                      <Icon
                        aria-hidden="true"
                        className="text-terracotta h-4 w-4"
                        strokeWidth={2}
                      />
                      <span>{pill.label}</span>
                    </li>
                  );
                })}
              </ul>
              {/* CTAs hero */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Cta href="#cas" size="lg">
                  {isFr ? "Parcourir les cas" : "Browse cases"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Cta>
                <Cta href="/audit" variant="outline" size="lg">
                  {isFr ? "Demander un audit" : "Request an audit"}
                </Cta>
              </div>
            </div>

            {/* Colonne droite — stack de 3 mini-cards exemples */}
            <CaseStudiesHeroSchema
              isFr={isFr}
              className="hero-schema"
              ariaLabel={
                isFr
                  ? "Exemples de cas concrets : industrie, conseil & juridique, retail multi-sites — chacun avec une métrique chiffrée concrète."
                  : "Concrete case examples: manufacturing, consulting & legal, multi-site retail — each with a concrete numerical metric."
              }
            />
          </div>
        </Container>
      </section>

      {/* Pillar copy — posture cas concrets */}
      <Section eyebrow={isFr ? "Posture" : "Stance"} tone="paper">
        <Container className="max-w-3xl">
          <p className="text-fg-soft text-lg leading-relaxed">
            {isFr
              ? `Chaque cas publié ici représente une mission Axion-IA réellement livrée. Aucune fabrication, aucun pilote théorique. Les noms des clients sont anonymisés à leur demande, mais les chiffres, les délais et la méthode sont fidèles à la réalité du terrain. Vous y verrez des contextes très différents — TPE artisanale, PME industrielle, grand compte juridique — parce que la méthode Axion-IA s'applique à toutes les tailles, à condition de cadrer le bon sujet. Si un cas vous parle, on peut sans doute reproduire l'approche chez vous : commencez par un audit ou par l'Essentielle ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "fr", { compact: true })} pour vérifier.`
              : `Each case study here represents an Axion-IA engagement actually delivered. No fabrication, no theoretical pilot. Client names are anonymised on request, but the numbers, timelines and methodology mirror the real fieldwork. You'll see very different contexts — small artisan business, mid-sized industrial SME, large legal account — because the Axion-IA method scales to all sizes, provided the right scope is framed. If a case resonates, we can probably reproduce the approach for you: start with an audit or the Essential ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "en", { compact: true })} to validate.`}
          </p>
        </Container>
      </Section>

      {/* Section anti-fear — "Choisir son cas" 3 critères */}
      <Section eyebrow={isFr ? "Choisir son cas" : "Pick your case"} tone="sand">
        <Container>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="text-terracotta h-5 w-5" aria-hidden="true" />
                  {isFr ? "Par taille" : "By size"}
                </CardTitle>
                <CardDescription>
                  {isFr
                    ? "TPE, PME, ETI, grand compte. Chacune a sa logique : volume, gouvernance, vélocité décision."
                    : "Small, SME, mid-cap, large account. Each has its logic: volume, governance, decision velocity."}
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="text-terracotta h-5 w-5" aria-hidden="true" />
                  {isFr ? "Par secteur" : "By industry"}
                </CardTitle>
                <CardDescription>
                  {isFr
                    ? "Industrie, juridique, retail, banque, artisanat. La pression IA n'est pas la même partout."
                    : "Industry, legal, retail, banking, trades. AI pressure isn't the same everywhere."}
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="text-terracotta h-5 w-5" aria-hidden="true" />
                  {isFr ? "Par budget" : "By budget"}
                </CardTitle>
                <CardDescription>
                  {/* TODO(pricing): valider avec Will — « audits 3-15 k€ » et « implémentations 5-50 k€ »
                      sont des fourchettes marketing larges qui dépassent la grille pricing.ts officielle
                      (audits 490 → 12 000 €, implémentations 990 → 80 000 €). Ranges laissés intacts
                      car la conversion exacte est ambiguë (fourchettes marketing ≠ tiers SSOT). */}
                  {isFr
                    ? `L'Essentielle ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "fr", { compact: true })}, audits 3-15 k€, implémentations 5-50 k€. ROI documenté à chaque palier.`
                    : `Essential ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "en", { compact: true })}, audits €3-15k, implementations €5-50k. Documented ROI at every tier.`}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </Container>
      </Section>

      <Section id="cas" eyebrow={isFr ? "Filtres" : "Filters"}>
        <CaseStudiesFilterPills
          locale={loc}
          industries={allIndustries.map((ind) => ({ value: ind.toLowerCase(), label: ind }))}
          sizes={allSizes.map((s) => ({ value: s.key, label: s.label }))}
        />
      </Section>

      <CaseStudiesFilteredGrid
        locale={loc}
        cases={caseDescriptors}
        totalCount={CASE_STUDIES.length}
      />


      {/* CLOSING ILLUSTRATION — Sprint Visual Rhythm 2026 */}
      <Section tone="canvas">
        <Container className="max-w-3xl">
          <Illustration
            slot="CAS-02-mid"
            aspectRatio="16:9"
            filenameTarget="public/illustrations/cas-concrets-mid-1.avif"
            caption={
              isFr
                ? "Collection éditoriale d'objets opérationnels — chaque cas, sa preuve"
                : "Editorial collection of operational objects — each case, its proof"
            }
            alt={
              isFr
                ? "Illustration éditoriale d'une collection d'objets opérationnels symbolisant les cas concrets clients Axion-IA."
                : "Editorial illustration of a collection of operational objects symbolizing Axion-IA client case studies."
            }
          />
        </Container>
      </Section>

      <CtaBlock
        eyebrow={isFr ? "Démarrer" : "Start"}
        title={isFr ? "Devenez le prochain cas concret" : "Become the next case study"}
        description={
          isFr
            ? `Démarrez par une intervention Essentielle ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "fr", { compact: true })} pour identifier vos quick-wins.`
            : `Start with an Essential session ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "en", { compact: true })} to identify your quick-wins.`
        }
        cta={
          <Cta href="/interventions/essentielle" size="lg">
            {isFr ? "Voir l'Essentielle" : "See the Essential"} â†’
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={itemListJsonLd} />
    </>
  );
}
