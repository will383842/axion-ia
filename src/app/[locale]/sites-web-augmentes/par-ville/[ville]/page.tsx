// 2026-06-04 (Will) — page « création de site web & SaaS augmentés par l'IA × ville »
// (5e verticale City Domination). Toute la logique est dans
// `VilleServicePageTemplate` (server component partagé par les 5 services).
// Ce fichier ne fait que câbler la route. Tant que `copy.services.sitesWeb`
// est absent pour une ville, le template rend un stub noindex (anti-doorway
// HCU 2024) — la génération de copy longue par ville se fait séparément.
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

// ISR aligné sur les 4 autres verticales par-ville : regénération 24h sans full
// rebuild ; `dynamicParams` sert les villes T3/T4 (pop < 20k) en on-demand SSG.
export const revalidate = 86400;
export const dynamicParams = true;

export async function generateMetadata(props: Props): Promise<Metadata> {
  return buildPageMetadata("sites-web-augmentes", props);
}

export default async function SitesWebAugmentesVillePage({ params }: Props) {
  const { locale, ville } = await params;
  return renderVilleServicePage({ service: "sites-web-augmentes", locale, villeSlug: ville });
}
