/**
 * Page de visionnage /fr/videos/[slug] (lot W2, plan PLAN-W1-W4 §6).
 *
 * ISR 1 h, jamais statique : l'interrupteur et la base sont lus au RUNTIME (incident
 * P3-01). 404 si l'interrupteur est éteint, si le slug est inconnu ou retiré, ou si la
 * locale n'est pas `fr` (l'EN est redirigé 301 par le proxy).
 *
 * ⛔ Cette page ne lit JAMAIS `searchParams` : le faire la ferait quitter l'ISR. Le
 * `?t=` d'un lien de Clip est lu côté navigateur par le lecteur, et la canonique reste
 * `/fr/videos/<slug>` sans paramètre (verrouillé par `__tests__/page.spec.tsx`).
 */
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/marketing/JsonLd";
import { PageVideo } from "@/components/videos/PageVideo";
import { routing } from "@/i18n/routing";
import { buildProductMetadata, SITE_URL } from "@/lib/seo";
import { buildVideoPageJsonLd } from "@/lib/seo/video-jsonld";
import { videoParSlug, videosPubliees } from "@/server/videos/lecture";
import { videosLiees } from "@/server/videos/liees";
import { mentionIa } from "@/server/videos/mention-ia";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale) || locale !== "fr") return {};
  const video = await videoParSlug(slug);
  if (!video) return {};
  const affiche = video.fichiers.affiche169;
  const mention = mentionIa(video);
  const meta = await buildProductMetadata({
    locale,
    path: `/videos/${video.slug}`,
    title: video.titre,
    description: mention ? `${video.description} ${mention}` : video.description,
    alternates: { fr: `/videos/${video.slug}`, en: `/videos/${video.slug}` },
    ogImage: `${SITE_URL}${affiche.chemin}`,
    ...(affiche.largeur && affiche.hauteur
      ? { ogImageWidth: affiche.largeur, ogImageHeight: affiche.hauteur }
      : {}),
  });
  const f = video.fichiers.video;
  const urlVideo = `${SITE_URL}${f.chemin}`;
  return {
    ...meta,
    openGraph: {
      ...meta.openGraph,
      videos: [
        {
          url: urlVideo,
          secureUrl: urlVideo,
          type: f.type,
          ...(f.largeur && f.hauteur ? { width: f.largeur, height: f.hauteur } : {}),
        },
      ],
    },
  };
}

export default async function PageVideoRoute({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale) || locale !== "fr") notFound();
  setRequestLocale(locale);
  const video = await videoParSlug(slug);
  if (!video) notFound();

  return (
    <>
      <JsonLd data={buildVideoPageJsonLd(video, { siteUrl: SITE_URL })} />
      <PageVideo video={video} liees={videosLiees(video, await videosPubliees())} />
    </>
  );
}
