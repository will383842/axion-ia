/**
 * Page de thème /fr/videos/theme/[theme] (lot W3). 404 sous 3 vidéos publiées du thème
 * (jamais de page mince) ou pour un thème hors de la liste fermée. Intro éditoriale de
 * 150 mots et plus, pages liées. Zéro JS client.
 */
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { themeParSlug } from "@/content/videos/themes";
import { JsonLd } from "@/components/marketing/JsonLd";
import { EnteteListe, GrilleVideos, PagesLiees } from "@/components/videos/ListesVideos";
import { routing } from "@/i18n/routing";
import { buildProductMetadata, SITE_URL } from "@/lib/seo";
import { buildListeVideosJsonLd } from "@/lib/seo/video-jsonld";
import { SEUIL_PAGE_GROUPE } from "@/server/videos/groupes";
import { videosPubliees } from "@/server/videos/lecture";

interface Props {
  params: Promise<{ locale: string; theme: string }>;
}

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams(): Promise<Array<{ theme: string }>> {
  return [];
}

async function charger(theme: string) {
  const def = themeParSlug(theme);
  if (!def) return null;
  const videos = (await videosPubliees()).filter((v) => v.theme === def.slug);
  return videos.length >= SEUIL_PAGE_GROUPE ? { def, videos } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, theme } = await params;
  if (!hasLocale(routing.locales, locale) || locale !== "fr") return {};
  const t = await charger(theme);
  if (!t) return {};
  return buildProductMetadata({
    locale,
    path: `/videos/theme/${t.def.slug}`,
    title: `Vidéos ${t.def.libelle}`,
    description: t.def.description,
    alternates: { fr: `/videos/theme/${t.def.slug}`, en: `/videos/theme/${t.def.slug}` },
  });
}

export default async function PageTheme({ params }: Props) {
  const { locale, theme } = await params;
  if (!hasLocale(routing.locales, locale) || locale !== "fr") notFound();
  setRequestLocale(locale);
  const t = await charger(theme);
  if (!t) notFound();

  return (
    <>
      <JsonLd
        data={buildListeVideosJsonLd({
          siteUrl: SITE_URL,
          chemin: `/fr/videos/theme/${t.def.slug}`,
          titre: `Vidéos ${t.def.libelle}`,
          description: t.def.description,
          videos: t.videos,
          fil: [
            { name: "Vidéos", href: "/fr/videos" },
            { name: t.def.libelle, href: `/fr/videos/theme/${t.def.slug}` },
          ],
        })}
      />
      <div className="mx-auto w-full max-w-5xl px-4 py-8 md:py-12">
        <EnteteListe titre={`Vidéos ${t.def.libelle}`} intro={t.def.intro} />
        <GrilleVideos videos={t.videos} />
        <PagesLiees pages={t.def.pagesLiees} />
      </div>
    </>
  );
}
