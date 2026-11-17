/**
 * Page de besoin /fr/videos/besoin/[besoin] (SEO-06). Même règle que les thèmes : 404 sous
 * 3 vidéos publiées (jamais de page vide ni mince, donc jamais indexable) ou pour un besoin
 * hors de la liste fermée. Fil d'Ariane, pages proches. Zéro JS client.
 */
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { besoinParSlug } from "@/content/videos/besoins";
import { JsonLd } from "@/components/marketing/JsonLd";
import {
  EnteteListe,
  FilAriane,
  GrilleVideos,
  ListesProches,
} from "@/components/videos/ListesVideos";
import { routing } from "@/i18n/routing";
import { buildProductMetadata, SITE_URL } from "@/lib/seo";
import { buildListeVideosJsonLd } from "@/lib/seo/video-jsonld";
import { SEUIL_PAGE_GROUPE } from "@/server/videos/groupes";
import { listesProches } from "@/server/videos/liees";
import { videosPubliees } from "@/server/videos/lecture";

interface Props {
  params: Promise<{ locale: string; besoin: string }>;
}

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams(): Promise<Array<{ besoin: string }>> {
  return [];
}

async function charger(besoin: string) {
  const def = besoinParSlug(besoin);
  if (!def) return null;
  const toutes = await videosPubliees();
  const videos = toutes.filter((v) => def.themes.includes(v.theme));
  return videos.length >= SEUIL_PAGE_GROUPE ? { def, videos, toutes } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, besoin } = await params;
  if (!hasLocale(routing.locales, locale) || locale !== "fr") return {};
  const b = await charger(besoin);
  if (!b) return {};
  return buildProductMetadata({
    locale,
    path: `/videos/besoin/${b.def.slug}`,
    title: `Vidéos : ${b.def.libelle}`,
    description: b.def.description,
    alternates: { fr: `/videos/besoin/${b.def.slug}`, en: `/videos/besoin/${b.def.slug}` },
  });
}

export default async function PageBesoin({ params }: Props) {
  const { locale, besoin } = await params;
  if (!hasLocale(routing.locales, locale) || locale !== "fr") notFound();
  setRequestLocale(locale);
  const b = await charger(besoin);
  if (!b) notFound();
  const titre = `Vidéos : ${b.def.libelle}`;

  return (
    <>
      <JsonLd
        data={buildListeVideosJsonLd({
          siteUrl: SITE_URL,
          chemin: `/fr/videos/besoin/${b.def.slug}`,
          titre,
          description: b.def.description,
          videos: b.videos,
          fil: [
            { name: "Vidéos", href: "/fr/videos" },
            { name: b.def.libelle, href: `/fr/videos/besoin/${b.def.slug}` },
          ],
        })}
      />
      <div className="mx-auto w-full max-w-5xl px-4 py-8 md:py-12">
        <FilAriane
          etapes={[{ libelle: "Vidéos", href: "/fr/videos" }, { libelle: b.def.libelle }]}
        />
        <EnteteListe titre={titre} intro={b.def.intro} />
        <GrilleVideos videos={b.videos} />
        <ListesProches pages={listesProches({ type: "besoin", slug: b.def.slug }, b.toutes)} />
      </div>
    </>
  );
}
