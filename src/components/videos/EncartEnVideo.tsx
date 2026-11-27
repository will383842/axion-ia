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

import { CarteVideo } from "@/components/videos/CarteVideo";
import { mentionIa } from "@/server/videos/mention-ia";
import { videoPourEncart } from "@/server/videos/encarts";
import type { VideoPubliee } from "@/server/videos/lecture";

export async function EncartEnVideo({
  theme,
  exclure = [],
  video: fournie,
}: {
  theme: string;
  exclure?: ReadonlyArray<string>;
  /** Vidéo déjà choisie par l'appelant (formations : soumise au drapeau OF). */
  video?: VideoPubliee | null;
}) {
  const video = fournie === undefined ? await videoPourEncart(theme, exclure) : fournie;
  if (!video) return null;
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
