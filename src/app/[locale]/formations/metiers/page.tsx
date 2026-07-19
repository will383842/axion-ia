/**
 * Listing des formations PAR MÉTIER — /formations/metiers (refonte 2026-07-19).
 *
 * Remplace l'axe durée (/formations/duree/*, supprimé + 301 → hub). Public/live,
 * contenu 100 % FR (EN 301→FR). Prix publics dérivés de la matrice pricing.ts.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";

import { routing, type Locale } from "@/i18n/routing";
import { FormationCategorieListing } from "@/components/formations/FormationCategorieListing";
import {
  getFormationsV2ByCategorie,
  getFormationV2EntryPrice,
} from "@/content/formations/catalog-v2";
import { formatAmount } from "@/content/pricing";
import { buildProductMetadata } from "@/lib/seo";

export const revalidate = 3600;

interface PageParams {
  locale: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const formations = getFormationsV2ByCategorie("metier");
  const prix = formations
    .map((f) => getFormationV2EntryPrice(f))
    .filter((p): p is number => typeof p === "number");
  const min = prix.length ? Math.min(...prix) : undefined;
  return buildProductMetadata({
    locale,
    path: "/formations/metiers",
    title:
      locale === "fr"
        ? "Formations IA par métier · Axion-IA"
        : "Role-specific AI trainings · Axion-IA",
    description:
      locale === "fr"
        ? `${formations.length} formations IA par métier — RH, marketing, commerciaux, finance, juridique, production, achats, relation client, IT. Intra-entreprise, prix par groupe${typeof min === "number" ? ` dès ${formatAmount(min, "fr")}` : ""}.`
        : `${formations.length} role-specific AI trainings — HR, marketing, sales, finance, legal, operations, procurement, customer service, IT. In-house, priced per group.`,
  });
}

export default async function FormationsMetiersPage({ params }: { params: Promise<PageParams> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return <FormationCategorieListing categorie="metier" locale={locale as Locale} />;
}
