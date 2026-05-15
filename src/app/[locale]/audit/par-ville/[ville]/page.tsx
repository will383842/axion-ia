// Sprint 14.10.1 Commit B — page audit IA × ville (~2150 routes SSG).
// Toute la logique est dans `VilleServicePageTemplate` (server component
// partagé par les 3 services). Ce fichier ne fait que câbler la route.
import type { Metadata } from "next";
import {
  buildPageMetadata,
  buildStaticParams,
  renderVilleServicePage,
} from "@/components/sections/VilleServicePageTemplate";

interface Props {
  params: Promise<{ locale: string; ville: string }>;
}

export const generateStaticParams = buildStaticParams;

// P1-13 (audit re-run 2026-05-15) — ISR sur pSEO villes ~2150 routes SSG.
// `revalidate = 86400` (24h) permet à Next 16 de regénérer une page sans
// full rebuild si la copy `copy/<slug>.ts` ou les données INSEE évoluent.
// `dynamicParams = true` permet à de nouvelles villes ajoutées post-build
// (via DB ou enrichissement copy) d'être servies via on-demand SSG.
export const revalidate = 86400;
export const dynamicParams = true;

export async function generateMetadata(props: Props): Promise<Metadata> {
  return buildPageMetadata("audit", props);
}

export default async function AuditVillePage({ params }: Props) {
  const { locale, ville } = await params;
  return renderVilleServicePage({ service: "audit", locale, villeSlug: ville });
}
