"use client";
// use-client: <dialog> natif ouvert par showModal(), lecteurs vidéo du navigateur.
//
// Lot L1 « Candidatures unifiées » (2026-10-07). Chargé à la demande par
// `BoutonVideos` (premier clic). Les vidéos passent par la route ADMIN
// existante `[id]/video/[videoId]` — même garde que la fiche, même trace
// « vidéo vue », seule une vidéo `disponible` (passée par l'antivirus) servie.
//  - `preload="none"` : rien ne se télécharge avant que Will appuie sur lecture ;
//  - `playsInline` : sur iPhone, la vidéo se lit dans le panneau au lieu de
//    passer en plein écran forcé.

import Link from "next/link";
import { useEffect, useRef } from "react";

import { tailleLisible } from "@/lib/careers/videos";
import type { BoutonVideosProps } from "./BoutonVideos";

export default function PanneauVideos({
  nom,
  ficheHref,
  videos,
  liens,
  onFermer,
}: BoutonVideosProps & { onFermer: () => void }) {
  const ref = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const d = ref.current;
    // Pas de `close()` au démontage : l'événement `close` rappellerait
    // `onFermer`, et le double montage du mode strict refermerait le panneau.
    if (d && !d.open) d.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onFermer}
      aria-labelledby="panneau-videos-titre"
      className="m-auto max-h-[92dvh] w-[min(34rem,calc(100vw-1rem))] rounded-[var(--radius-admin-xl)] bg-[color:var(--color-admin-paper)] p-0 text-[color:var(--color-admin-fg)] shadow-[var(--shadow-admin-4)] backdrop:bg-black/50"
    >
      <div className="flex items-center gap-3 border-b border-[color:var(--color-admin-border)] px-4 py-2">
        <h2 id="panneau-videos-titre" className="admin-section-title m-0 flex-1 truncate">
          {nom}
        </h2>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          className="admin-button-ghost admin-button-tactile-carre"
          aria-label="Fermer"
        >
          <span aria-hidden="true" className="text-xl leading-none">
            ×
          </span>
        </button>
      </div>

      <div className="space-y-4 px-4 py-4">
        {videos.map((v) => (
          <figure key={v.id} className="m-0">
            <video
              controls
              playsInline
              preload="none"
              src={`${ficheHref}/video/${v.id}`}
              className="mx-auto block max-h-[60dvh] w-full rounded-[var(--radius-admin-md)] bg-black"
            />
            <figcaption className="admin-meta-small mt-1 break-all">
              {v.nom} · {tailleLisible(v.taille)}
            </figcaption>
          </figure>
        ))}

        {liens.length > 0 ? (
          <ul className="m-0 list-none space-y-1 p-0">
            {liens.map((l) => (
              <li key={l.url}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="admin-link flex min-h-11 items-center gap-2 break-all"
                >
                  <span className="shrink-0 font-medium">{l.plateforme}</span>
                  <span className="admin-meta-small truncate">{l.url}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex justify-end border-t border-[color:var(--color-admin-border)] px-4 py-3">
        <Link href={ficheHref} className="admin-button admin-button-tactile">
          Ouvrir la fiche
        </Link>
      </div>
    </dialog>
  );
}
