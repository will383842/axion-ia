/**
 * Hub catalogue formations V2 — /formations. Vue 2 axes : sections par DURÉE
 * (4h/1j/2j/3j) + blocs des GAMMES thématiques (Claude, Agents). Gated Phase A
 * (`OF_PUBLIC_DISCLOSURE_ENABLED`) → notFound() tant que l'agrément OF n'est pas
 * obtenu (site public actuel inchangé). Contenu 100 % FR.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { ArrowRight } from "lucide-react";

import { routing } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { FormationCardV2 } from "@/components/formations/FormationCardV2";
import { isQualiopiPublicDisclosureEnabled } from "@/server/qualiopi/config/flag";
import { FORMATIONS_V2, getFormationsV2ByDuree } from "@/content/formations/catalog-v2";
import { FORMATION_DUREES_META, getGammesThematiques } from "@/content/formations/catalog-v2-meta";
import { formatAmount, getFormationCatalogPriceRange } from "@/content/pricing";
import { buildItemListJsonLd, buildProductMetadata, SITE_URL } from "@/lib/seo";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  if (!isQualiopiPublicDisclosureEnabled()) return {};
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const { minEur } = getFormationCatalogPriceRange();
  return buildProductMetadata({
    locale,
    path: "/formations",
    title: "Formations IA intra-entreprise — 17 formations | Axion-IA",
    description: `17 formations IA en intra-entreprise (4 h à 3 jours, par durée et par gamme) : vos équipes apprennent à faire, sur vos cas réels, dans vos locaux. Dès ${formatAmount(minEur, "fr")}.`,
  });
}

export default async function FormationsHubPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  if (!isQualiopiPublicDisclosureEnabled()) notFound();
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const gammes = getGammesThematiques();
  const featured = FORMATIONS_V2.find((f) => f.featured);

  const itemListJsonLd = buildItemListJsonLd({
    locale,
    path: "/formations",
    name: "Catalogue de formations IA intra-entreprise Axion-IA",
    items: FORMATIONS_V2.map((f, i) => ({
      position: i + 1,
      name: f.titreFr,
      url: `${SITE_URL}/${locale}/formations/${f.slugFr}`,
      description: f.accrocheFr,
    })),
  });

  return (
    <>
      <JsonLd data={itemListJsonLd} />

      {/* HERO */}
      <section className="bg-halo-warm text-fg py-14 sm:py-16 lg:py-20">
        <Container>
          <div className="max-w-3xl">
            <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
              <span
                aria-hidden="true"
                className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
              />
              Formations intra-entreprise
            </p>
            <h1 className="display-editorial text-fg mt-5">Nos formations IA</h1>
            <p className="text-fg-soft mt-5 max-w-2xl text-lg leading-relaxed sm:text-xl">
              17 formations en intra-entreprise, par durée (4 h à 3 jours) et par gamme. Vos équipes
              apprennent à faire elles-mêmes, sur vos cas réels, dans vos locaux — et repartent avec
              du travail déjà fait.
            </p>
            {featured ? (
              <div className="border-border bg-paper shadow-subtle mt-7 rounded-2xl border p-5">
                <p className="text-terracotta-deep text-[12px] font-semibold tracking-wide uppercase">
                  <span aria-hidden="true">★</span> La formation par laquelle commencer
                </p>
                <a
                  href={`/${locale}/formations/${featured.slugFr}`}
                  className="text-fg hover:text-terracotta mt-1 inline-flex items-center gap-2 text-lg font-semibold"
                >
                  {featured.titreFr} — {featured.accrocheFr}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </a>
              </div>
            ) : null}
            <div className="mt-7">
              <Cta href="/formations/tarifs" size="lg" track="formations-hub-tarifs">
                Voir tous les tarifs
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Cta>
            </div>
          </div>
        </Container>
      </section>

      {/* SECTIONS PAR DURÉE */}
      {FORMATION_DUREES_META.map((d, idx) => {
        const formations = getFormationsV2ByDuree(d.id);
        if (formations.length === 0) return null;
        return (
          <Section
            key={d.id}
            tone={idx % 2 === 0 ? "canvas" : "paper"}
            eyebrow={`Axe durée · ${d.shortFr}`}
            title={d.labelFr}
            description={d.taglineFr}
          >
            <Container>
              <div className="grid gap-6 lg:grid-cols-2 lg:gap-7">
                {formations.map((f) => (
                  <FormationCardV2
                    key={f.id}
                    formation={f}
                    locale={locale}
                    showDuree={false}
                    showGamme
                  />
                ))}
              </div>
              <div className="mt-6">
                <Cta
                  href={`/formations/duree/${d.slug}`}
                  variant="outline"
                  size="md"
                  track={`formations-hub-duree-${d.slug}`}
                >
                  Tout voir en {d.shortFr}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Cta>
              </div>
            </Container>
          </Section>
        );
      })}

      {/* BLOCS GAMMES THÉMATIQUES */}
      <Section
        tone="sand"
        eyebrow="Axe gamme"
        title="Deux gammes"
        titleEm="thématiques"
        description="Au-delà des formats par durée, deux gammes spécialisées avec leur propre logique et leur tarif dédié."
      >
        <Container>
          <div className="grid gap-6 sm:grid-cols-2">
            {gammes.map((g) => (
              <a
                key={g.id}
                href={`/${locale}/formations/gamme/${g.slug}`}
                className="group border-border-strong bg-paper hover:border-terracotta hover:shadow-card flex flex-col rounded-3xl border p-7 transition-all"
              >
                <h3 className="text-fg text-xl font-semibold tracking-tight">{g.labelFr}</h3>
                <p className="text-fg-soft mt-2 text-[15px] leading-relaxed">{g.taglineFr}</p>
                <span className="text-terracotta group-hover:text-terracotta-deep mt-5 inline-flex items-center gap-1 text-sm font-semibold">
                  Découvrir la gamme
                  <ArrowRight
                    aria-hidden="true"
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  />
                </span>
              </a>
            ))}
          </div>
        </Container>
      </Section>

      <CtaBlock
        eyebrow="Besoin d'aide pour choisir ?"
        title="On cadre votre besoin en un appel"
        description="Vous nous exposez votre contexte, on vous oriente vers le bon format — ou on construit du sur-mesure. Sans engagement. Vous pouvez aussi nous écrire ou réserver au calendrier."
        cta={
          <Cta
            href="/appel"
            size="lg"
            className="bg-primary text-primary-fg hover:bg-primary-hover"
            track="formations-hub-ctablock"
          >
            Réserver un appel →
          </Cta>
        }
        tone="dark"
      />
    </>
  );
}
