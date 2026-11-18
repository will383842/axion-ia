/**
 * Mise en page d'une vidéo du site (lot W2). Composant SERVEUR : la seule île
 * cliente est le lecteur (`VslVideo`), dont la balise `<video preload="none">` est
 * dans le HTML dès le départ.
 *
 * Ordre (plan §6.5, « une page jamais pauvre ») : titre → lecteur → résumé → « À retenir »
 * → questions-réponses VISIBLES (la route en émet un FAQPage, champ 25 de la fiche, y compris
 * sur les vidéos sans fiche : repli sur `video.questions`) → lien vers le service ou la formation → vidéos liées
 * → transcription repliée (portée par le lecteur).
 *
 * SEO-05 : quand la fiche de page existe, elle fournit le H1, le résumé citable, le gain,
 * les limites, les questions, le carrousel, l'infographie, l'auteur et la date de mise à jour.
 * Sans fiche, la page est celle d'avant. Ce composant n'écrit aucun balisage :
 * le `FAQPage` est porté par le JSON-LD de la route.
 */
import Image from "next/image";
import { VslVideo } from "@/components/lp/VslVideo";
import { CarteVideo, libelleDuree } from "@/components/videos/CarteVideo";
import { ChapitresVideoDiffere } from "@/components/videos/ChapitresVideoDiffere";
import type { VideoPubliee } from "@/server/videos/lecture";
import { lienAffiche } from "@/server/videos/liens";
import { mentionIa } from "@/server/videos/mention-ia";

const ID_LECTEUR = "lecteur-video";

const LIBELLE_LIEN = {
  service: "Découvrir le service associé",
  formation: "Voir la formation associée",
} as const;

const dateFr = (d: Date) =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);

export function PageVideo({
  video,
  liees,
}: {
  video: VideoPubliee;
  liees: ReadonlyArray<VideoPubliee>;
}) {
  const f = video.fichiers;
  const mention = mentionIa(video);
  const lien = lienAffiche(video.lien);
  const fiche = video.fichePage ?? null;
  const questions = fiche?.questions ?? video.questions;
  const images = fiche?.carrousel ?? [];
  const transcription = video.transcription
    ? video.transcription.split(/\n{2,}/).filter((l) => l.trim().length > 0)
    : [];
  return (
    <article className="mx-auto w-full max-w-4xl px-4 py-8 md:py-12">
      <h1 className="text-fg text-3xl font-bold tracking-tight md:text-4xl">
        {fiche?.h1 ?? video.titre}
      </h1>

      {fiche ? (
        <>
          <p className="text-fg-soft mt-4 text-lg leading-relaxed">{fiche.resumeCitable}</p>
          <p className="text-fg mt-3 font-semibold">{fiche.gain}</p>
          <p className="text-fg-soft mt-3 text-sm">
            Par {fiche.auteur} · Mis à jour le {dateFr(video.modifieeLe)}
          </p>
        </>
      ) : null}

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

      {fiche?.infographie ? (
        <figure className="mt-8">
          <Image
            src={fiche.infographie.chemin}
            alt={fiche.infographie.alt}
            width={fiche.infographie.largeur}
            height={fiche.infographie.hauteur}
            loading="lazy"
            unoptimized
            className="h-auto w-full max-w-md rounded-lg"
          />
        </figure>
      ) : null}

      {images.length > 0 ? (
        <section className="mt-8" aria-labelledby="images-video">
          <h2 id="images-video" className="text-fg text-xl font-bold">
            En images
          </h2>
          <ul className="mt-3 grid gap-4 sm:grid-cols-2">
            {images.map((img) => (
              <li key={img.chemin}>
                <Image
                  src={img.chemin}
                  alt={img.alt}
                  width={img.largeur}
                  height={img.hauteur}
                  loading="lazy"
                  unoptimized
                  className="h-auto w-full rounded-lg"
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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

      {fiche ? (
        <section className="mt-8" aria-labelledby="limites-video">
          <h2 id="limites-video" className="text-fg text-xl font-bold">
            Ce que cette automatisation ne fait pas
          </h2>
          <ul className="text-fg-soft mt-3 list-disc space-y-2 pl-5 leading-relaxed">
            {fiche.limites.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8" aria-labelledby="questions-video">
        <h2 id="questions-video" className="text-fg text-xl font-bold">
          Questions fréquentes
        </h2>
        <dl className="mt-3 space-y-4">
          {questions.map((q) => (
            <div key={q.question}>
              <dt className="text-fg font-semibold">{q.question}</dt>
              <dd className="text-fg-soft mt-1 leading-relaxed">{q.reponse}</dd>
            </div>
          ))}
        </dl>
      </section>

      {lien ? (
        <p className="mt-8">
          <a
            href={lien.chemin}
            className="bg-terracotta text-paper inline-flex rounded-lg px-5 py-3 text-sm font-semibold"
          >
            {LIBELLE_LIEN[lien.type]}
          </a>
        </p>
      ) : null}

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
