"use client";
// use-client: île cliente de la page vidéo (boutons de chapitres, lecture de `?t=`).

/**
 * Chapitres et `?t=` entrant d'une vidéo du site. Île PROPRE à la page vidéo : le lecteur
 * partagé `VslVideo` (aussi chargé par /diagnostic et la page vidéo de l'apporteur) ne
 * porte pas ce code. L'île retrouve la balise `<video>` par son `id`, sans état partagé.
 */
import * as React from "react";
import { trackFunnel } from "@/lib/tracking";
import {
  chapitresAffichables,
  horodatageLisible,
  type ChapitreVideo,
} from "@/content/videos/chapitres";

interface ChapitresVideoProps {
  /** `id` de la balise `<video>` du lecteur. */
  videoId: string;
  videoSlug: string;
  /** Durée réelle, en secondes : seuil des chapitres (30 s) et borne d'un `?t=` entrant. */
  dureeSecondes: number;
  chapitres?: ReadonlyArray<ChapitreVideo>;
  /** Lit un `?t=<secondes>` ENTRANT (lien de Clip suivi depuis Google). */
  lireDebutDansUrl?: boolean;
}

export function ChapitresVideo({
  videoId,
  videoSlug,
  dureeSecondes,
  chapitres,
  lireDebutDansUrl = false,
}: ChapitresVideoProps) {
  const visibles = chapitresAffichables(dureeSecondes, chapitres);

  // `?t=` entrant : entier strictement positif, avant la fin. Le navigateur retient
  // la position même avant le chargement des métadonnées (`preload="none"`).
  React.useEffect(() => {
    if (!lireDebutDansUrl) return;
    const brut = new URLSearchParams(window.location.search).get("t");
    if (brut === null || !/^[0-9]+$/.test(brut)) return;
    const t = Number(brut);
    if (t <= 0 || t >= dureeSecondes) return;
    const video = document.getElementById(videoId) as HTMLVideoElement | null;
    if (video) video.currentTime = t;
  }, [lireDebutDansUrl, dureeSecondes, videoId]);

  // Aller à un chapitre : ni `pushState` ni `?t=` — aucune adresse de ce type n'est
  // jamais produite par la page (la canonique reste sans paramètre).
  const allerA = (secondes: number) => {
    const video = document.getElementById(videoId) as HTMLVideoElement | null;
    if (!video) return;
    video.currentTime = secondes;
    trackFunnel("Landing Video Played", { landing: "videos", video: videoSlug });
    void video.play().catch(() => undefined);
  };

  if (visibles.length === 0) return null;
  return (
    <nav aria-label="Chapitres" className="mt-3">
      <ol className="space-y-1">
        {visibles.map((c) => (
          <li key={c.debutSecondes}>
            <button
              type="button"
              onClick={() => allerA(c.debutSecondes)}
              className="text-fg hover:text-terracotta focus-visible:ring-terracotta flex w-full gap-3 rounded-lg px-2 py-1.5 text-left text-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              <span className="text-fg-muted w-10 shrink-0 tabular-nums">
                {horodatageLisible(c.debutSecondes)}
              </span>
              <span>{c.titre}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
