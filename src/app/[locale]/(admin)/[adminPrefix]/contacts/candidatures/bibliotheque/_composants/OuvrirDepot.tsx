"use client";
// use-client: bouton qui ouvre le déposeur — celui-ci n'est CHARGÉ qu'au clic (import dynamique).

// Le déposeur (envoi par morceaux, reprise, lien externe) n'entre pas dans le
// JavaScript de la page : il est téléchargé seulement quand on clique sur
// « Ajouter un fichier » (plan L4, [C3] — poids mesuré avant/après).

import dynamic from "next/dynamic";
import { useState } from "react";

const DeposeurFichier = dynamic(() => import("./DeposeurFichier"), {
  ssr: false,
  loading: () => <p className="admin-meta-small">Chargement…</p>,
});

export function OuvrirDepot() {
  const [ouvert, setOuvert] = useState(false);
  if (ouvert) return <DeposeurFichier onFermer={() => setOuvert(false)} />;
  return (
    <div className="flex flex-wrap items-center justify-between gap-[var(--space-admin-3)]">
      <p className="admin-meta-small">
        Jusqu&apos;à 20 Go par fichier, envoyé directement au stockage en ligne. Un envoi coupé
        reprend où il s&apos;était arrêté.
      </p>
      <button type="button" className="admin-button" onClick={() => setOuvert(true)}>
        + Ajouter un fichier
      </button>
    </div>
  );
}
