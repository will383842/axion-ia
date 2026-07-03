"use client";

import type { ReactNode } from "react";

/**
 * Bouton de soumission (dans un <form action={serverAction}>) qui demande une
 * confirmation navigateur AVANT d'exécuter l'action serveur. Utilisé pour les
 * actions destructives/irréversibles (suppression définitive de campagne).
 * Minimal : si l'utilisateur annule, on empêche la soumission du formulaire.
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
