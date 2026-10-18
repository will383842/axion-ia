/**
 * Page de série /fr/videos/serie/[serie] (lot W3). 404 sous 3 épisodes publiés (décision
 * D3, le même seuil que les thèmes). Épisodes dans l'ordre de leur rang. Zéro JS client.
 */
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/marketing/JsonLd";
import { EnteteListe, GrilleVideos } from "@/components/videos/ListesVideos";
import { routing } from "@/i18n/routing";
import { buildProductMetadata, SITE_URL } from "@/lib/seo";
import { buildListeVideosJsonLd } from "@/lib/seo/video-jsonld";
import { groupesParSerie } from "@/server/videos/groupes";
import { videosPubliees } from "@/server/videos/lecture";

interface Props {
  params: Promise<{ locale: string; serie: string }>;
}

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams(): Promise<Array<{ serie: string }>> {
  return [];
}

async function charger(serie: string) {
  const g = groupesParSerie(await videosPubliees()).find((x) => x.slug === serie);
  return g?.aPage ? g : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, serie } = await params;
  if (!hasLocale(routing.locales, locale) || locale !== "fr") return {};
  const g = await charger(serie);
  if (!g) return {};
  return buildProductMetadata({
    locale,
    path: `/videos/serie/${g.slug}`,
    title: `Série : ${g.titre}`,
    description: `Les ${g.videos.length} épisodes de la série « ${g.titre} », à regarder dans l'ordre, chacun résumé par écrit.`,
    alternates: { fr: `/videos/serie/${g.slug}`, en: `/videos/serie/${g.slug}` },
  });
}

export default async function PageSerie({ params }: Props) {
  const { locale, serie } = await params;
  if (!hasLocale(routing.locales, locale) || locale !== "fr") notFound();
  setRequestLocale(locale);
  const g = await charger(serie);
  if (!g) notFound();
  const description = `Les ${g.videos.length} épisodes de la série « ${g.titre} », à regarder dans l'ordre, chacun résumé par écrit.`;

  return (
    <>
      <JsonLd
        data={buildListeVideosJsonLd({
          siteUrl: SITE_URL,
          chemin: `/fr/videos/serie/${g.slug}`,
          titre: `Série : ${g.titre}`,
          description,
          videos: g.videos,
          fil: [
            { name: "Vidéos", href: "/fr/videos" },
            { name: g.titre, href: `/fr/videos/serie/${g.slug}` },
          ],
        })}
      />
      <div className="mx-auto w-full max-w-5xl px-4 py-8 md:py-12">
        <EnteteListe titre={`Série : ${g.titre}`} intro={description} />
        <GrilleVideos videos={g.videos} />
      </div>
    </>
  );
}
