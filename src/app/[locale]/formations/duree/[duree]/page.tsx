/**
 * Listing des formations par DURÉE (axe 1 du catalogue V2) — /formations/duree/[duree].
 *
 * Public/live (décision Will 2026-06-11) : /formations remplace /interventions
 * et est en ligne immédiatement, SANS mention Qualiopi côté public. Design
 * strictement identique aux anciennes pages durée collectives via le composant
 * `FormationDurationListing`. Contenu 100 % FR. Prix dérivés de la matrice.
 *
 * Contrat build ADR 0026 : early-exit si `DATABASE_URL` contient "stub.invalid"
 * pour `generateStaticParams` (pas d'appel DB ici, mais cohérence pipeline).
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";

import { routing, type Locale } from "@/i18n/routing";
import { FormationDurationListing } from "@/components/formations/FormationDurationListing";
import { FORMATION_DUREES_META, getDureeMetaBySlug } from "@/content/formations/catalog-v2-meta";
import { getFormationsV2ByDuree } from "@/content/formations/catalog-v2";
import { buildProductMetadata } from "@/lib/seo";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
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
  const { locale, duree } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const meta = getDureeMetaBySlug(duree);
  if (!meta) return {};
  const count = getFormationsV2ByDuree(meta.id).length;
  return buildProductMetadata({
    locale,
    path: `/formations/duree/${meta.slug}`,
    title: `Formation IA ${meta.heuresFr} en entreprise · ${count} formats · Axion-IA`,
    description: `${meta.taglineFr} ${count} formation${count > 1 ? "s" : ""} intra-entreprise sur ${meta.heuresFr.toLowerCase()}, dans vos locaux, sur vos cas réels.`,
  });
}

export default async function DureeListingPage({ params }: { params: Promise<PageParams> }) {
  const { locale, duree } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const meta = getDureeMetaBySlug(duree);
  if (!meta) notFound();

  return <FormationDurationListing dureeId={meta.id} locale={locale as Locale} />;
}
