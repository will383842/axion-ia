/**
 * Console éditoriale — l'aperçu réel d'un média déposé.
 *
 * Server Component pur. Les lecteurs vidéo et audio sont les éléments NATIFS
 * du navigateur : aucun composant client, aucun octet de JavaScript. Une
 * bibliothèque de lecteur aurait coûté un bundle pour faire ce que `<video
 * controls>` fait déjà, sur un écran d'administration consulté par une
 * personne.
 *
 * ── Ce que cet aperçu remplace ────────────────────────────────────────────
 *
 * Une vignette de 40 pixels de côté, et rien d'autre. On ne relit pas un
 * carrousel dans 40 pixels, on ne vérifie pas un montage, et on ne voit pas
 * qu'une incrustation déborde. La fiche montrait qu'un fichier EXISTAIT ;
 * elle ne permettait pas de le REGARDER — donc la vérification se faisait
 * ailleurs, dans l'explorateur de fichiers, et le statut « prêt » se cochait
 * sur la foi d'un nom de fichier.
 *
 * ── Pourquoi le PDF n'a pas de vignette, mais bien un aperçu ──────────────
 *
 * Le dépôt ne sait fabriquer une miniature que pour les IMAGES : `sharp` lit
 * jpg/png/webp, pas les PDF ni les vidéos. Mais un navigateur, lui, sait
 * afficher un PDF — l'aperçu délègue donc, plutôt que de renoncer. Un
 * carrousel de neuf slides se feuillette ici, dans la fiche.
 */

import { FileText, Music } from "lucide-react";

interface Props {
  type: string;
  /** Chemin public du fichier déposé. Absent tant que rien n'est arrivé. */
  url: string | null;
  libelle: string;
}

export function ApercuMedia({ type, url, libelle }: Props): React.ReactElement | null {
  if (!url) return null;

  if (type === "image" || type === "photo") {
    return (
      <div className="mt-2">
        {/*
          Un lien nu vers le fichier, et non une visionneuse : le navigateur
          affiche déjà une image en pleine page, avec son zoom et son
          enregistrement. Réécrire ça en JavaScript coûterait un bundle pour
          un résultat moins bon.
        */}
        <a href={url} target="_blank" rel="noopener noreferrer" title={`Ouvrir ${libelle}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={libelle}
            className="max-h-80 w-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]"
          />
        </a>
        <p className="admin-help">Cliquer pour ouvrir en pleine taille.</p>
      </div>
    );
  }

  if (type === "video") {
    return (
      <div className="mt-2">
        {/*
          `preload="metadata"` et non `auto` : la fiche peut porter plusieurs
          vidéos, et précharger chacune entièrement ferait payer des dizaines
          de mégaoctets à qui vient seulement relire un texte.
        */}
        <video
          src={url}
          controls
          preload="metadata"
          className="max-h-80 w-full rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-black"
        />
      </div>
    );
  }

  if (type === "audio") {
    return (
      <div className="mt-2 flex items-center gap-2">
        <Music size={16} aria-hidden="true" />
        <audio src={url} controls preload="metadata" className="w-full" />
      </div>
    );
  }

  if (type === "carrousel" || type === "document") {
    return (
      <div className="mt-2">
        {/*
          Le navigateur sait afficher un PDF ; le projet ne sait pas en
          fabriquer une miniature. On délègue plutôt que de renoncer — c'est
          la seule façon de feuilleter un carrousel sans quitter la fiche.
        */}
        <object
          data={url}
          type="application/pdf"
          className="h-96 w-full rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]"
          aria-label={`Aperçu de ${libelle}`}
        >
          {/* Le repli compte : certains navigateurs refusent le PDF en ligne,
              et un cadre vide sans explication ressemble à une panne. */}
          <p className="p-3">
            <a href={url} target="_blank" rel="noopener noreferrer" className="admin-link">
              Ouvrir « {libelle} » dans un onglet
            </a>{" "}
            — votre navigateur n&apos;affiche pas les PDF en ligne.
          </p>
        </object>
      </div>
    );
  }

  return (
    <p className="admin-help mt-2 flex items-center gap-1">
      <FileText size={14} aria-hidden="true" />
      <a href={url} target="_blank" rel="noopener noreferrer" className="admin-link">
        Ouvrir le fichier
      </a>
    </p>
  );
}
