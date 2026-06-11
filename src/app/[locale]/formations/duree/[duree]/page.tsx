/**
 * Listing des formations par DURÉE (axe 1 du catalogue V2) — /formations/duree/[duree].
 *
 * Gated Phase A (`OF_PUBLIC_DISCLOSURE_ENABLED`) : notFound() tant que l'agrément
 * OF n'est pas obtenu → le site public actuel reste inchangé. Contenu 100 % FR.
 * Prix dérivés de la matrice (pricing.ts). SSOT : catalog-v2 + catalog-v2-meta.
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
import { getFormationsV2ByDuree } from "@/content/formations/catalog-v2";
import {
  FORMATION_DUREES_META,
  getDureeMetaBySlug,
  getSurMesureByDuree,
} from "@/content/formations/catalog-v2-meta";
import { buildItemListJsonLd, buildProductMetadata, SITE_URL } from "@/lib/seo";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  if (process.env.DATABASE_URL?.includes("stub.invalid")) return [];
  if (!isQualiopiPublicDisclosureEnabled()) return [];
  return FORMATION_DUREES_META.map((d) => ({ duree: d.slug }));
}

interface PageParams {
  locale: string;
  duree: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  if (!isQualiopiPublicDisclosureEnabled()) return {};
  const { locale, duree } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const meta = getDureeMetaBySlug(duree);
  if (!meta) return {};
  return buildProductMetadata({
    locale,
    path: `/formations/duree/${meta.slug}`,
    title: `Formations IA ${meta.heuresFr} en entreprise · Axion-IA`,
    description: meta.taglineFr,
  });
}

export default async function DureeListingPage({ params }: { params: Promise<PageParams> }) {
  if (!isQualiopiPublicDisclosureEnabled()) notFound();
  const { locale, duree } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const meta = getDureeMetaBySlug(duree);
  if (!meta) notFound();

  const formations = getFormationsV2ByDuree(meta.id);
  const surMesure = getSurMesureByDuree(meta.id);

  const itemListJsonLd = buildItemListJsonLd({
    locale,
    path: `/formations/duree/${meta.slug}`,
    name: `Formations IA ${meta.heuresFr}`,
    items: formations.map((f, i) => ({
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
              <span className="mx-2 opacity-50">·</span>
              {meta.shortFr}
            </p>
            <h1 className="display-editorial text-fg mt-5">{meta.labelFr}</h1>
            <p className="text-fg-soft mt-5 max-w-2xl text-lg leading-relaxed sm:text-xl">
              {meta.taglineFr}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Cta
                href="/formations"
                variant="outline"
                size="lg"
                track={`formations-duree-${meta.slug}-hub`}
              >
                ← Toutes les formations
              </Cta>
              <Cta
                href="/formations/tarifs"
                variant="outline"
                size="lg"
                track={`formations-duree-${meta.slug}-tarifs`}
              >
                Voir les tarifs
              </Cta>
            </div>
          </div>
        </Container>
      </section>

      {/* GRILLE FORMATIONS */}
      <Section
        eyebrow="Formations disponibles"
        title={`Toutes les formations`}
        titleEm={`en ${meta.shortFr}`}
        description="Chaque formation est intra-entreprise (vos équipes, vos locaux, vos cas réels). Cliquez pour le programme détaillé, le public visé et les tarifs par effectif."
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

          {/* Carte sur-mesure de la durée */}
          {surMesure.length > 0 ? (
            <div className="mt-8">
              {surMesure.map((s) => (
                <div
                  key={s.id}
                  className="border-border bg-sand flex flex-col items-start gap-3 rounded-3xl border border-dashed p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7"
                >
                  <div>
                    <p className="text-fg text-lg font-semibold">{s.labelFr}</p>
                    <p className="text-fg-soft mt-1 text-[15px] leading-relaxed">
                      {s.descriptionFr}
                    </p>
                  </div>
                  <Cta href="/appel" size="lg" track={`formations-duree-${meta.slug}-surmesure`}>
                    Demander un devis
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </Cta>
                </div>
              ))}
            </div>
          ) : null}
        </Container>
      </Section>

      <CtaBlock
        eyebrow="Une question ?"
        title="Parler à quelqu'un avant de réserver"
        description="Un appel pour cadrer votre besoin et choisir le bon format — sans engagement. Vous pouvez aussi nous écrire ou réserver directement au calendrier."
        cta={
          <Cta
            href="/appel"
            size="lg"
            className="bg-primary text-primary-fg hover:bg-primary-hover"
            track={`formations-duree-${meta.slug}-ctablock`}
          >
            Réserver un appel →
          </Cta>
        }
        tone="dark"
      />
    </>
  );
}
