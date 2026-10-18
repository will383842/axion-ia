/**
 * Mise en page d'une vidéo du site (lot W2). Composant SERVEUR : la seule île
 * cliente est le lecteur (`VslVideo`), dont la balise `<video preload="none">` est
 * dans le HTML dès le départ.
 *
 * Ordre (plan §6.5, « une page jamais pauvre ») : titre → lecteur → résumé → « À retenir »
 * → questions-réponses VISIBLES (sans balisage FAQPage : Google le réserve aux sites
 * gouvernementaux et de santé) → lien vers le service ou la formation → vidéos liées
 * → transcription repliée (portée par le lecteur).
 */
import { VslVideo } from "@/components/lp/VslVideo";
import { CarteVideo, libelleDuree } from "@/components/videos/CarteVideo";
import { ChapitresVideoDiffere } from "@/components/videos/ChapitresVideoDiffere";
import type { VideoPubliee } from "@/server/videos/lecture";
import { mentionIa } from "@/server/videos/mention-ia";

const ID_LECTEUR = "lecteur-video";

const LIBELLE_LIEN = {
  service: "Découvrir le service associé",
  formation: "Voir la formation associée",
} as const;

export function PageVideo({
  video,
  liees,
}: {
  video: VideoPubliee;
  liees: ReadonlyArray<VideoPubliee>;
}) {
  const f = video.fichiers;
  const mention = mentionIa(video);
  const transcription = video.transcription
    ? video.transcription.split(/\n{2,}/).filter((l) => l.trim().length > 0)
    : [];
  return (
    <article className="mx-auto w-full max-w-4xl px-4 py-8 md:py-12">
      <h1 className="text-fg text-3xl font-bold tracking-tight md:text-4xl">{video.titre}</h1>

      {mention ? (
        <p className="bg-paper border-border text-fg-soft mt-4 rounded-lg border px-3 py-2 text-sm">
          {mention}
        </p>
      ) : null}

      <div className="mt-6">
        <VslVideo
          src={f.video.chemin}
          poster={f.affiche169.chemin}
          durationLabel={libelleDuree(video.dureeSecondes)}
          label={video.titre}
          landing="videos"
          videoSlug={video.slug}
          videoId={ID_LECTEUR}
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
          {...(transcription.length > 0 ? { transcription } : {})}
        />
        <ChapitresVideoDiffere
          videoId={ID_LECTEUR}
          videoSlug={video.slug}
          dureeSecondes={video.dureeSecondes}
          chapitres={video.chapitres}
          lireDebutDansUrl
        />
      </div>

      <section className="mt-8" aria-labelledby="resume-video">
        <h2 id="resume-video" className="text-fg text-xl font-bold">
          En résumé
        </h2>
        <p className="text-fg-soft mt-3 leading-relaxed">{video.resume}</p>
      </section>

      <section className="mt-8" aria-labelledby="a-retenir-video">
        <h2 id="a-retenir-video" className="text-fg text-xl font-bold">
          À retenir
        </h2>
        <ul className="text-fg-soft mt-3 list-disc space-y-2 pl-5 leading-relaxed">
          {video.aRetenir.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>

      <section className="mt-8" aria-labelledby="questions-video">
        <h2 id="questions-video" className="text-fg text-xl font-bold">
          Questions fréquentes
        </h2>
        <dl className="mt-3 space-y-4">
          {video.questions.map((q) => (
            <div key={q.question}>
              <dt className="text-fg font-semibold">{q.question}</dt>
              <dd className="text-fg-soft mt-1 leading-relaxed">{q.reponse}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="mt-8">
        <a
          href={video.lien.chemin}
          className="bg-terracotta text-paper inline-flex rounded-lg px-5 py-3 text-sm font-semibold"
        >
          {LIBELLE_LIEN[video.lien.type]}
        </a>
      </p>

      {liees.length > 0 ? (
        <section className="mt-10" aria-labelledby="liees-video">
          <h2 id="liees-video" className="text-fg text-xl font-bold">
            À voir aussi
          </h2>
          <ul className="mt-3 grid gap-4 sm:grid-cols-3">
            {liees.map((l) => (
              <CarteVideo key={l.slug} video={l} />
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
