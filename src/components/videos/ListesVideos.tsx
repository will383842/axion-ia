/**
 * Mises en page des listes de vidéos (galerie, thème, série) — lot W3. Composants SERVEUR,
 * zéro JS client : cartes `next/image` + liens, jamais de lecteur.
 */
import Link from "next/link";
import { CarteVideo } from "@/components/videos/CarteVideo";
import type { GroupeSerie, GroupeTheme } from "@/server/videos/groupes";
import type { VideoPubliee } from "@/server/videos/lecture";
import type { PageLieeTheme } from "@/content/videos/themes";

export function GrilleVideos({ videos }: { videos: ReadonlyArray<VideoPubliee> }) {
  return (
    <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {videos.map((v) => (
        <CarteVideo key={v.slug} video={v} />
      ))}
    </ul>
  );
}

export function EnteteListe({ titre, intro }: { titre: string; intro?: string | undefined }) {
  return (
    <header>
      <h1 className="text-fg text-3xl font-bold tracking-tight md:text-4xl">{titre}</h1>
      {intro ? <p className="text-fg-soft mt-4 max-w-3xl leading-relaxed">{intro}</p> : null}
    </header>
  );
}

export function SectionsTheme({ groupes }: { groupes: ReadonlyArray<GroupeTheme> }) {
  return (
    <>
      {groupes.map((g) => (
        <section key={g.theme.slug} className="mt-10" aria-labelledby={`theme-${g.theme.slug}`}>
          <h2 id={`theme-${g.theme.slug}`} className="text-fg text-xl font-bold">
            {g.theme.libelle}
          </h2>
          {g.aPage ? (
            <p className="mt-1">
              <Link
                href={`/fr/videos/theme/${g.theme.slug}`}
                className="text-terracotta text-sm font-semibold underline"
              >
                Voir toutes les vidéos « {g.theme.libelle} »
              </Link>
            </p>
          ) : null}
          <GrilleVideos videos={g.videos} />
        </section>
      ))}
    </>
  );
}

export function SectionSeries({ groupes }: { groupes: ReadonlyArray<GroupeSerie> }) {
  if (groupes.length === 0) return null;
  return (
    <section className="mt-12" aria-labelledby="series-videos">
      <h2 id="series-videos" className="text-fg text-xl font-bold">
        Séries
      </h2>
      <ul className="mt-4 space-y-3">
        {groupes.map((g) => (
          <li key={g.slug} className="text-fg-soft">
            {g.aPage ? (
              <Link
                href={`/fr/videos/serie/${g.slug}`}
                className="text-terracotta font-semibold underline"
              >
                {g.titre}
              </Link>
            ) : (
              <span className="text-fg font-semibold">{g.titre}</span>
            )}{" "}
            — {g.videos.length} épisode{g.videos.length > 1 ? "s" : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PagesLiees({ pages }: { pages: ReadonlyArray<PageLieeTheme> }) {
  if (pages.length === 0) return null;
  return (
    <nav className="mt-12" aria-label="Pour aller plus loin">
      <h2 className="text-fg text-xl font-bold">Pour aller plus loin</h2>
      <ul className="mt-3 space-y-2">
        {pages.map((p) => (
          <li key={p.href}>
            <Link href={`/fr${p.href}`} className="text-terracotta font-semibold underline">
              {p.libelle}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
