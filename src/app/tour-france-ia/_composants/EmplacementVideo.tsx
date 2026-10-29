// Tour France IA — l'emplacement de la vidéo du héros (composant SERVEUR, aucun
// script). La vidéo viendra ; la page est complète sans elle.
//
//   · `video` nul : la boîte est une carte « aperçu » lumineuse (papier dépoli,
//     ombre douce, deux lueurs de marque) qui porte la frise dessinée du héros
//     (`children`), et la page n'a AUCUNE balise `video`. Sur téléphone, la carte
//     prend la hauteur de la frise (~90 px) : réservée en 16/9, elle pousserait le
//     bouton hors du premier écran (360 × 640). Dès 40rem, elle est en 16/9 — la
//     place exacte de la vidéo à venir ;
//   · `video` renseignée : un `<video>` natif en 16/9, `preload="none"` (rien n'est
//     téléchargé avant le clic), muet, lu en ligne sur iPhone, avec son affiche et
//     ses sous-titres français. Jamais de lecteur tiers (ni YouTube ni Vimeo).
//
// La place est réservée par `aspect-ratio` avant toute image : CLS nul.

import type { ReactNode } from "react";

export type VideoHeros = { mp4: string; poster: string; vtt: string };

/** La boîte, vidéo ou non : même largeur, mêmes coins (20 px), même ombre. */
const BOITE = "shadow-elevated w-full max-w-xl overflow-hidden rounded-xl border";
/**
 * Sans vidéo : papier à 72 % sur le halo du héros, flou d'arrière-plan léger, et
 * deux lueurs (terracotta en haut à droite, bleu d'action en bas à gauche).
 */
const APERCU =
  "border-paper bg-paper/72 backdrop-blur-md bg-[radial-gradient(18rem_10rem_at_100%_0%,color-mix(in_srgb,var(--color-terracotta-soft)_90%,transparent),transparent_70%),radial-gradient(18rem_10rem_at_0%_100%,color-mix(in_srgb,var(--color-primary-soft)_90%,transparent),transparent_70%)]";

export function EmplacementVideo({
  video,
  titre,
  children,
}: {
  video: VideoHeros | null;
  /** Le nom accessible du bloc (et de la vidéo, quand elle est là). */
  titre: string;
  /** Ce que la boîte montre tant qu'il n'y a pas de vidéo : la frise du héros. */
  children: ReactNode;
}) {
  if (!video) {
    return (
      <div className={`${BOITE} ${APERCU} grid place-items-center px-3 py-3 sm:aspect-video`}>
        {children}
      </div>
    );
  }
  return (
    <div className={`${BOITE} border-border bg-ink aspect-video`}>
      <video
        className="h-full w-full object-cover"
        controls
        playsInline
        muted
        preload="none"
        poster={video.poster}
        aria-label={titre}
      >
        <source src={video.mp4} type="video/mp4" />
        <track kind="captions" srcLang="fr" label="Français" src={video.vtt} default />
      </video>
    </div>
  );
}
