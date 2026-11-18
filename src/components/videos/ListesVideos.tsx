/**
 * Mises en page des listes de vidéos (galerie, thème, série) — lot W3. Composants SERVEUR,
 * zéro JS client : cartes `next/image` + liens, jamais de lecteur.
 */
import { CarteVideo } from "@/components/videos/CarteVideo";
import type { GroupeSerie, GroupeTheme } from "@/server/videos/groupes";
import type { GroupeBesoin, ListeProche } from "@/server/videos/liees";
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
              <a
                href={`/fr/videos/theme/${g.theme.slug}`}
                className="text-terracotta text-sm font-semibold underline"
              >
                Voir toutes les vidéos « {g.theme.libelle} »
              </a>
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
              <a
                href={`/fr/videos/serie/${g.slug}`}
                className="text-terracotta font-semibold underline"
              >
                {g.titre}
              </a>
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
            <a href={`/fr${p.href}`} className="text-terracotta font-semibold underline">
              {p.libelle}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Fil d'Ariane visible (le JSON-LD `BreadcrumbList` est porté par la page). */
export function FilAriane({
  etapes,
}: {
  etapes: ReadonlyArray<{ libelle: string; href?: string | undefined }>;
}) {
  return (
    <nav aria-label="Fil d'Ariane" className="text-fg-muted mb-4 text-sm">
      <ol className="flex flex-wrap gap-x-2">
        <li>
          {/* Lien natif : liste serveur sans JS client, comme les autres liens des listes. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/fr" className="underline">
            Accueil
          </a>
        </li>
        {etapes.map((e, i) => (
          <li key={e.libelle} aria-current={i === etapes.length - 1 ? "page" : undefined}>
            <span aria-hidden="true">› </span>
            {e.href ? (
              <a href={e.href} className="underline">
                {e.libelle}
              </a>
            ) : (
              e.libelle
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Entree({
  id,
  titre,
  lignes,
}: {
  id: string;
  titre: string;
  lignes: ReadonlyArray<{ libelle: string; nb: number; href: string | null }>;
}) {
  return (
    <section className="border-border bg-paper rounded-xl border p-4" aria-labelledby={id}>
      <h3 id={id} className="text-fg font-bold">
        {titre}
      </h3>
      <ul className="mt-2 divide-y">
        {lignes.map((l) => (
          <li key={l.libelle} className="flex justify-between gap-2 py-2">
            {l.href ? (
              <a href={l.href} className="text-terracotta font-semibold underline">
                {l.libelle}
              </a>
            ) : (
              <span className="text-fg font-semibold">{l.libelle}</span>
            )}
            <span className="text-fg-muted text-sm">
              {l.nb} vidéo{l.nb > 1 ? "s" : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Les deux entrées de classement du hub : par type (thème) et par besoin d'entreprise. */
export function EntreesClassement({
  themes,
  besoins,
}: {
  themes: ReadonlyArray<GroupeTheme>;
  besoins: ReadonlyArray<GroupeBesoin>;
}) {
  return (
    <section className="mt-10" aria-labelledby="entrees-classement">
      <h2 id="entrees-classement" className="text-fg text-xl font-bold">
        Choisissez votre entrée
      </h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Entree
          id="entree-type"
          titre="Par thème"
          lignes={themes.map((g) => ({
            libelle: g.theme.libelle,
            nb: g.videos.length,
            href: g.aPage ? `/fr/videos/theme/${g.theme.slug}` : null,
          }))}
        />
        <Entree
          id="entree-besoin"
          titre="Par besoin d'entreprise"
          lignes={besoins.map((g) => ({
            libelle: g.besoin.libelle,
            nb: g.videos.length,
            href: g.aPage ? `/fr/videos/besoin/${g.besoin.slug}` : null,
          }))}
        />
      </div>
    </section>
  );
}

/** Pages de liste voisines (maillage interne) ; rien si aucune n'existe. */
export function ListesProches({ pages }: { pages: ReadonlyArray<ListeProche> }) {
  if (pages.length === 0) return null;
  return (
    <nav className="mt-12" aria-label="Autres classements">
      <h2 className="text-fg text-xl font-bold">Autres façons de parcourir les vidéos</h2>
      <ul className="mt-3 space-y-2">
        {pages.map((p) => (
          <li key={p.href}>
            <a href={p.href} className="text-terracotta font-semibold underline">
              {p.libelle}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
