"use client";
// use-client: minuterie d affichage du temps écoulé (setInterval) côté navigateur.

/**
 * Assistant de devis — zone d'état de la sauvegarde (fiche E07).
 * Largeur minimale réservée (CLS = 0), annonce `aria-live="polite"`. En cas de conflit, la seule
 * issue proposée est de recharger la dernière version : jamais d'écrasement.
 */
import { useEffect, useRef, useState } from "react";

import type { StatutBrouillon } from "./useBrouillonAuto";

export interface StatutSauvegardeProps {
  statut: StatutBrouillon;
  enregistreA: number | null;
  erreur?: string | null | undefined;
  /** Sans lui, aucune issue n'est proposée dans l'alerte (le bouton est masqué, pas inerte). */
  onRecharger?: (() => void) | undefined;
}

function ecoule(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `il y a ${s} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `il y a ${min} min`;
  return `il y a ${Math.floor(min / 60)} h`;
}

export function StatutSauvegarde({
  statut,
  enregistreA,
  erreur,
  onRecharger,
}: StatutSauvegardeProps) {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    if (statut !== "enregistre") return;
    const t = setInterval(() => setMaintenant(Date.now()), 5000);
    return () => clearInterval(t);
  }, [statut, enregistreA]);

  const boite = useRef<HTMLDivElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  const aBouton = onRecharger !== undefined;
  useEffect(() => {
    if (statut !== "conflit") return;
    (bouton.current ?? boite.current)?.focus();
  }, [statut, aBouton]);

  let texte = "";
  let temps = "";
  if (statut === "enCours") texte = "Enregistrement…";
  else if (statut === "enregistre" && enregistreA !== null) {
    texte = "Brouillon enregistré automatiquement";
    temps = ` · ${ecoule(maintenant - enregistreA)}`;
  } else if (statut === "erreur")
    texte = `Enregistrement impossible : ${erreur ?? "erreur inconnue"}`;
  else if (statut === "conflit") texte = "Ce brouillon a été modifié dans un autre onglet.";

  return (
    <>
      <p
        role="status"
        aria-live="polite"
        className="inline-block min-w-[18rem] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]"
      >
        {texte}
      </p>
      {/* Hors de la zone aria-live : le compteur change toutes les 5 s et ne doit pas être annoncé. */}
      <span
        data-testid="temps-ecoule"
        className="inline-block min-w-[6rem] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]"
      >
        {temps}
      </span>
      {statut === "conflit" ? (
        <div
          role="alertdialog"
          aria-label="Conflit de sauvegarde"
          ref={boite}
          tabIndex={-1}
          className="mt-2 rounded border p-3"
        >
          <p>
            Vos dernières modifications n&apos;ont pas été enregistrées, pour ne pas écraser
            l&apos;autre version.
          </p>
          {onRecharger ? (
            <button
              ref={bouton}
              type="button"
              className="mt-2 min-h-[44px] rounded border px-4"
              onClick={onRecharger}
            >
              Recharger la dernière version
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
