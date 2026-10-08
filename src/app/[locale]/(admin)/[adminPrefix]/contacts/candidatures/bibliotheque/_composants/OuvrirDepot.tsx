"use client";
// use-client: bouton qui ouvre le déposeur — celui-ci n'est CHARGÉ qu'au clic (import dynamique).

// Le déposeur (envoi par morceaux, reprise, lien externe) n'entre pas dans le
// JavaScript de la page : il est téléchargé seulement quand on clique sur
// « Ajouter un fichier » (plan L4, [C3] — poids mesuré avant/après).
//
// 🔴 POIDS : ce fichier est le SEUL JavaScript propre à la page, et la somme
// des pages de la console a un plafond. D'où `React.lazy` plutôt que
// `next/dynamic` (dont l'enveloppe se recopie dans la page), et le texte
// d'explication rendu par le SERVEUR (`children`) au lieu d'être écrit ici.

import { lazy, Suspense, useState, type ReactNode } from "react";

const DeposeurFichier = lazy(() => import("./DeposeurFichier"));

export function OuvrirDepot({ children }: { children: ReactNode }) {
  const [ouvert, setOuvert] = useState(false);
  if (ouvert)
    return (
      <Suspense fallback={<p className="admin-meta-small">Chargement…</p>}>
        <DeposeurFichier onFermer={() => setOuvert(false)} />
      </Suspense>
    );
  return (
    <div className="flex flex-wrap items-center justify-between gap-[var(--space-admin-3)]">
      {children}
      <button type="button" className="admin-button" onClick={() => setOuvert(true)}>
        + Ajouter un fichier
      </button>
    </div>
  );
}
