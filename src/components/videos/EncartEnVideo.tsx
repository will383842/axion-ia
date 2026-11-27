/**
 * Encart « En vidéo » posé sur les pages hôtes (services, formations, articles, villes) —
 * lot W4, plan PLAN-W1-W4 §8.1. Composant SERVEUR, ZÉRO JS : une carte (vignette 4:3 en
 * `loading="lazy"` à ratio fixe, titre, durée, mention IA courte) qui mène à la page vidéo.
 *
 * ⛔ JAMAIS de lecteur ici (la page hôte ne charge ni `<video>` ni l'île `VslVideo`) et JAMAIS
 * de JSON-LD `VideoObject` (la page vidéo est l'UNIQUE porteuse de la vidéo : sinon Google voit
 * des centaines de « pages vidéo » concurrentes). Rend `null` — donc rien — si le thème n'a pas
 * de vidéo publiée.
 */
import { useId } from "react";
import { useTranslations } from "next-intl";

import { CarteVideo } from "@/components/videos/CarteVideo";
import { mentionIa } from "@/server/videos/mention-ia";
import { videoPourEncart } from "@/server/videos/encarts";
import type { VideoPubliee } from "@/server/videos/lecture";

export async function EncartEnVideo({
  theme,
  exclure = [],
  video: fournie,
  variante = "defaut",
}: {
  theme: string;
  exclure?: ReadonlyArray<string>;
  /** Vidéo déjà choisie par l'appelant (formations : soumise au drapeau OF). */
  video?: VideoPubliee | null;
  /** `article-v2` : façade des gabarits d'articles (`.encart-video`). Défaut inchangé. */
  variante?: "defaut" | "article-v2";
}) {
  const video = fournie === undefined ? await videoPourEncart(theme, exclure) : fournie;
  if (!video) return null;
  if (variante === "article-v2") return <EncartArticleV2 video={video} />;
  return <EncartRendu video={video} />;
}

/**
 * Partie synchrone : `useId` donne un identifiant unique PAR INSTANCE (deux encarts sur une page
 * ne partagent pas d'id). Un hook ne peut pas vivre dans le composant asynchrone ci-dessus.
 * Toujours composant serveur : aucun JS client.
 */
function EncartRendu({ video }: { video: VideoPubliee }) {
  const idTitre = `${useId()}-titre`;
  const mention = mentionIa(video);
  return (
    <aside aria-labelledby={idTitre} className="mx-auto w-full max-w-5xl px-4 py-8">
      <h2 id={idTitre} className="text-fg text-xl font-bold">
        En vidéo
      </h2>
      <ul className="mt-4 grid max-w-sm gap-4">
        <CarteVideo video={video} />
      </ul>
      {mention ? <p className="text-fg-muted mt-2 text-xs">{mention}</p> : null}
    </aside>
  );
}

/**
 * Façade des gabarits d'articles (option A de la conception) : cadre 16/9 qui MÈNE à la page
 * vidéo, résumé dans un `<details>`. Aucun lecteur, aucun `<iframe>`, aucun `<video>`, aucun
 * `VideoObject`. Image `loading="lazy"`, dimensions fixes, jamais `fetchpriority="high"`.
 */
function EncartArticleV2({ video }: { video: VideoPubliee }) {
  const idTitre = `${useId()}-titre`;
  const t = useTranslations("articleGabarits.commun.video");
  const v = video.fichiers.vignette43;
  return (
    <section className="encart-video" aria-labelledby={idTitre} data-aeo="video-slot">
      <p className="encart-video__repere">{t("repere")}</p>
      <h2 className="encart-video__titre" id={idTitre}>
        {video.titre}
      </h2>
      <a className="encart-video__cadre" href={`/fr/videos/${video.slug}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={v.chemin}
          alt=""
          width={v.largeur ?? 960}
          height={v.hauteur ?? 720}
          loading="lazy"
          decoding="async"
        />
        <span className="encart-video__lire">{t("lire")}</span>
      </a>
      <details className="encart-video__texte">
        <summary>{t("resume")}</summary>
        <p>{video.resume}</p>
      </details>
    </section>
  );
}
