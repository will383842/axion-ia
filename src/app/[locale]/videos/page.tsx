/**
 * Galerie /fr/videos (lot W3, plan PLAN-W1-W4 §7). Sections par THÈME (une section dès
 * 1 vidéo, mais un lien vers la page de thème seulement à partir de 3), liste des séries.
 * Zéro JS client. ISR 1 h, jamais statique ; 404 sans vidéo publiée ou interrupteur éteint.
 */
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/marketing/JsonLd";
import { EnteteListe, SectionSeries, SectionsTheme } from "@/components/videos/ListesVideos";
import { routing } from "@/i18n/routing";
import { buildProductMetadata, SITE_URL } from "@/lib/seo";
import { buildListeVideosJsonLd } from "@/lib/seo/video-jsonld";
import { groupesParSerie, groupesParTheme } from "@/server/videos/groupes";
import { videosPubliees } from "@/server/videos/lecture";

interface Props {
  params: Promise<{ locale: string }>;
}

export const revalidate = 3600;

const TITRE = "Vidéos Axion-IA : l'IA expliquée simplement";
const DESCRIPTION =
  "Des vidéos courtes pour comprendre ce que l'IA peut faire concrètement dans votre entreprise : formation, audit, automatisation, sites web. Chaque vidéo est résumée par écrit.";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale) || locale !== "fr") return {};
  if ((await videosPubliees()).length === 0) return {};
  return buildProductMetadata({
    locale,
    path: "/videos",
    title: TITRE,
    description: DESCRIPTION,
    alternates: { fr: "/videos", en: "/videos" },
  });
}

export default async function GalerieVideos({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale) || locale !== "fr") notFound();
  setRequestLocale(locale);
  const videos = await videosPubliees();
  if (videos.length === 0) notFound();

  return (
    <>
      <JsonLd
        data={buildListeVideosJsonLd({
          siteUrl: SITE_URL,
          chemin: "/fr/videos",
          titre: TITRE,
          description: DESCRIPTION,
          videos,
          fil: [{ name: "Vidéos", href: "/fr/videos" }],
        })}
      />
      <div className="mx-auto w-full max-w-5xl px-4 py-8 md:py-12">
        <EnteteListe titre={TITRE} intro={DESCRIPTION} />
        <SectionsTheme groupes={groupesParTheme(videos)} />
        <SectionSeries groupes={groupesParSerie(videos)} />
      </div>
    </>
  );
}
