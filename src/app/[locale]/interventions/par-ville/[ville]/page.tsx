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

// P1-13 (audit re-run 2026-05-15) — ISR sur pSEO villes.
export const revalidate = 86400;
export const dynamicParams = true;

export async function generateMetadata(props: Props): Promise<Metadata> {
  return buildPageMetadata("interventions", props);
}

export default async function InterventionsVillePage({ params }: Props) {
  const { locale, ville } = await params;
  return renderVilleServicePage({ service: "interventions", locale, villeSlug: ville });
}
