// Aide repliée « ? » : `<details>` natif (clavier et lecteur d'écran gérés par le navigateur).
// Le texte d'aide reste dans le DOM même replié ; le panneau flotte sans déplacer la page (CLS 0).
import type { ReactNode } from "react";

export function AideRepliable({ sujet, children }: { sujet: string; children: ReactNode }) {
  return (
    <details className="relative inline-block">
      <summary
        aria-label={`En savoir plus sur ${sujet}`}
        className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full border border-[color:var(--color-admin-border-strong)] text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg)] select-none hover:bg-[color:var(--color-admin-paper-alt)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-admin-ring)] focus-visible:outline-none"
      >
        <span aria-hidden="true">?</span>
      </summary>
      <div className="absolute top-11 right-0 z-10 w-80 max-w-[85vw] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-3 text-[length:var(--text-admin-sm)] shadow-[var(--shadow-admin-2)]">
        {children}
      </div>
    </details>
  );
}
