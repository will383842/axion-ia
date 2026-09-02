"use client";
// use-client: confirmation navigateur (onClick + window.confirm) avant une action serveur destructive ou de masse.

import type { ReactNode } from "react";

/**
 * Bouton de soumission (dans un <form action={serverAction}>) qui demande une
 * confirmation navigateur AVANT d'exécuter l'action serveur.
 *
 * Né dans `content-gen/coverage` pour la suppression définitive de campagne ;
 * partagé depuis le 2026-09-02 (audit UI de la console) pour toutes les
 * actions de masse ou irréversibles qui partaient au premier clic :
 * « Relancer tous les échecs » (1 462 jobs), « Approuver / Rejeter en masse »,
 * « Tout annuler », « Régénérer le lot tier-1 », « Synchroniser les villes ».
 * Minimal : si l'utilisateur annule, on empêche la soumission du formulaire.
 *
 * ⚠️ `window.confirm` n'apparaît pas dans le DOM : un audit par lecture de la
 * page conclut « aucune confirmation » à tort. La garde est là.
 */
export function ConfirmSubmitButton({
  confirmMessage,
  className,
  title,
  ariaLabel,
  children,
}: {
  confirmMessage: string;
  className?: string;
  title?: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      title={title}
      aria-label={ariaLabel}
      className={className}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
