"use client";
// use-client: navigator.clipboard + sélection du champ — copier le lien du questionnaire en ligne.

/**
 * Le lien du questionnaire en ligne, dans un champ sélectionnable, avec
 * « Copier » (questionnaire en ligne, 2026-10-01). Sans presse-papiers
 * (contexte non sécurisé, navigateur qui refuse), le champ reste sélectionné :
 * Ctrl+C suffit. Aucun texte embarqué hors des deux libellés du bouton.
 */

import { useRef, useState } from "react";

export function CopierLienQuestionnaire({
  url,
  classeChamp,
  classeBouton,
}: {
  readonly url: string;
  readonly classeChamp: string;
  readonly classeBouton: string;
}): React.ReactElement {
  const champ = useRef<HTMLInputElement>(null);
  const [copie, setCopie] = useState(false);

  async function copier(): Promise<void> {
    champ.current?.select();
    try {
      await navigator.clipboard.writeText(url);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      // Le champ est sélectionné : la copie au clavier reste possible.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
      <input
        ref={champ}
        id="questionnaire-lien"
        type="text"
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className={`${classeChamp} min-w-0 flex-1 font-mono`}
      />
      <button type="button" onClick={copier} className={classeBouton}>
        <span aria-live="polite">{copie ? "Copié" : "Copier"}</span>
      </button>
    </div>
  );
}
