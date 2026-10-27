// Tour de France IA — l'emplacement de la vidéo du héros (composant SERVEUR, aucun
// script). La vidéo viendra ; la page est complète sans elle.
//
//   · `video` nul : la boîte porte la frise dessinée du héros (`children`), et la
//     page n'a AUCUNE balise `video`. Sur téléphone, la boîte prend la hauteur de
//     la frise (~80 px) : réservée en 16/9, elle pousserait le bouton hors du
//     premier écran (360 × 640). Dès 40rem, elle est en 16/9 ;
//   · `video` renseignée : un `<video>` natif en 16/9, `preload="none"` (rien n'est
//     téléchargé avant le clic), muet, lu en ligne sur iPhone, avec son affiche et
//     ses sous-titres français. Jamais de lecteur tiers (ni YouTube ni Vimeo).
//
// La place est réservée par `aspect-ratio` avant toute image : CLS nul.

import type { ReactNode } from "react";

export type VideoHeros = { mp4: string; poster: string; vtt: string };

const BOITE = "border-mocha-fg/20 bg-ink/35 w-full max-w-xl overflow-hidden rounded-2xl border";

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
      <div className={`${BOITE} grid place-items-center px-3 py-2.5 sm:aspect-video`}>
        {children}
      </div>
    );
  }
  return (
    <div className={`${BOITE} aspect-video`}>
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
