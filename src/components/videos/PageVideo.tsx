/**
 * Mise en page d'une vidéo du site (lot W2). Composant SERVEUR : la seule île
 * cliente est le lecteur (`VslVideo`), dont la balise `<video preload="none">` est
 * dans le HTML dès le départ.
 */
import { VslVideo } from "@/components/lp/VslVideo";
import type { VideoPubliee } from "@/server/videos/lecture";

/** « 3 min 04 » — rassure avant le clic. */
export function libelleDuree(secondes: number): string {
  const m = Math.floor(secondes / 60);
  const s = secondes % 60;
  if (m === 0) return `${s} s`;
  return `${m} min ${String(s).padStart(2, "0")}`;
}

export function PageVideo({ video }: { video: VideoPubliee }) {
  const f = video.fichiers;
  return (
    <article className="mx-auto w-full max-w-4xl px-4 py-8 md:py-12">
      <h1 className="text-fg text-3xl font-bold tracking-tight md:text-4xl">{video.titre}</h1>
      <div className="mt-6">
        <VslVideo
          src={f.video.chemin}
          poster={f.affiche169.chemin}
          durationLabel={libelleDuree(video.dureeSecondes)}
          label={video.titre}
          landing="videos"
          videoSlug={video.slug}
          legendeMasquee
          afficheNonOptimisee
          suiviProgression
          tone="light"
          {...(f.affiche169.largeur && f.affiche169.hauteur
            ? {
                dimensionsAffiche: { largeur: f.affiche169.largeur, hauteur: f.affiche169.hauteur },
              }
            : {})}
          {...(f.sousTitres ? { sousTitres: { src: f.sousTitres.chemin } } : {})}
        />
      </div>
    </article>
  );
}
