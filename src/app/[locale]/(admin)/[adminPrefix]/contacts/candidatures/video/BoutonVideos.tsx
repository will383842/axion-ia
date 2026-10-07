"use client";
// use-client: bouton « ▶ N vidéos » qui ouvre le panneau de lecture (état ouvert/fermé).
//
// Lot L1 « Candidatures unifiées » (2026-10-07) : voir les vidéos d'un monteur
// SANS ouvrir sa fiche. Ce fichier ne porte que le bouton ; le panneau (lecteur,
// liste des liens) est un morceau séparé, téléchargé au PREMIER clic seulement
// — la liste de 40 lignes ne charge pas 40 lecteurs pour rien.

import dynamic from "next/dynamic";
import { useState } from "react";

import type { LienExemple, VideoDeposee } from "@/features/admin-job-applications/video-freelance";

const PanneauVideos = dynamic(() => import("./PanneauVideos"), { ssr: false });

export interface BoutonVideosProps {
  nom: string;
  /** `/fr/<prefixe>/contacts/candidatures/<id>` : la fiche, et la base des vidéos. */
  ficheHref: string;
  videos: VideoDeposee[];
  liens: LienExemple[];
}

function pluriel(n: number, mot: string): string {
  return `${n} ${mot}${n > 1 ? "s" : ""}`;
}

export function libelleVideos(nbVideos: number, nbLiens: number): string {
  return [
    nbVideos > 0 ? pluriel(nbVideos, "vidéo") : null,
    nbLiens > 0 ? pluriel(nbLiens, "lien") : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function BoutonVideos({ nom, ficheHref, videos, liens }: BoutonVideosProps) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="admin-button-ghost admin-button-tactile"
        aria-haspopup="dialog"
      >
        <span aria-hidden="true">▶</span> {libelleVideos(videos.length, liens.length)}
      </button>
      {ouvert ? (
        <PanneauVideos
          nom={nom}
          ficheHref={ficheHref}
          videos={videos}
          liens={liens}
          onFermer={() => setOuvert(false)}
        />
      ) : null}
    </>
  );
}
