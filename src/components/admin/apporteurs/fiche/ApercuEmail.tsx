"use client";
// use-client: aperçu d'e-mail à la demande (état local, Server Action d'aperçu)

// L'aperçu EXACT d'un e-mail avant envoi (même motif que l'issue de l'échange apporteur).
// Will peut RÉÉCRIRE le texte principal (« Modifier le texte ») : l'aperçu se rafraîchit
// avec le rendu exact, et l'envoi utilise ce texte.

import { useState } from "react";

/** Même borne que le serveur (`TEXTE_LIBRE_MAX`, `lib/email/templates/texte-libre-reseau`). */
const TEXTE_MAX = 4000;

export interface EmailApercu {
  gabarit?: string;
  sujet: string;
  html: string;
  destinataire: string;
  /** Texte principal par défaut (texte brut) ; absent = non modifiable. */
  texteDefaut?: string;
}

/**
 * Zone « Modifier le texte » : pré-remplie du texte par défaut. `texte` = le texte
 * actuellement appliqué à l'aperçu (null = texte d'origine). `onActualiser(null)` rend le
 * texte d'origine ; sinon le texte modifié.
 */
export function EditeurTexte({
  texteDefaut,
  texte,
  occupe,
  onActualiser,
}: {
  texteDefaut: string;
  texte: string | null;
  occupe: boolean;
  onActualiser: (texte: string | null) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [brouillon, setBrouillon] = useState(texte ?? texteDefaut);
  const vide = brouillon.trim() === "";
  if (!ouvert) {
    return (
      <div>
        <button
          type="button"
          className="admin-button-secondary"
          disabled={occupe}
          onClick={() => {
            setBrouillon(texte ?? texteDefaut);
            setOuvert(true);
          }}
        >
          Modifier le texte
        </button>
        {texte !== null ? (
          <span className="ml-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Texte modifié
          </span>
        ) : null}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-[var(--space-admin-2)]">
      <label className="flex flex-col gap-[var(--space-admin-1)]">
        <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Texte de l&apos;e-mail (une ligne vide sépare deux paragraphes ; le « Bonjour », le bouton
          et la signature sont conservés)
        </span>
        <textarea
          className="admin-textarea min-h-[220px]"
          value={brouillon}
          maxLength={TEXTE_MAX}
          disabled={occupe}
          onChange={(e) => setBrouillon(e.target.value)}
        />
      </label>
      <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        {brouillon.length} / {TEXTE_MAX} caractères
      </p>
      <div className="flex flex-wrap gap-[var(--space-admin-2)]">
        <button
          type="button"
          className="admin-button"
          disabled={occupe || vide}
          onClick={() => onActualiser(brouillon.trim() === texteDefaut.trim() ? null : brouillon)}
        >
          Actualiser l&apos;aperçu
        </button>
        <button
          type="button"
          className="admin-button-secondary"
          disabled={occupe}
          onClick={() => {
            setBrouillon(texteDefaut);
            setOuvert(false);
            onActualiser(null);
          }}
        >
          Revenir au texte d&apos;origine
        </button>
        <button
          type="button"
          className="admin-button-secondary"
          disabled={occupe}
          onClick={() => setOuvert(false)}
        >
          Fermer
        </button>
      </div>
    </div>
  );
}

export function ApercuEmail({
  email,
  libelleEnvoyer,
  occupe,
  onEnvoyer,
  onAnnuler,
  texte = null,
  onActualiserTexte,
}: {
  email: EmailApercu;
  libelleEnvoyer: string;
  occupe: boolean;
  onEnvoyer: () => void;
  onAnnuler: () => void;
  /** Texte réécrit actuellement appliqué à l'aperçu (null = texte d'origine). */
  texte?: string | null;
  /** Fourni = le texte est modifiable ; rend l'aperçu avec le texte donné. */
  onActualiserTexte?: (texte: string | null) => void;
}) {
  return (
    <section
      aria-label="Aperçu de l'e-mail"
      className="flex flex-col gap-[var(--space-admin-3)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-3)]"
    >
      <p className="text-[length:var(--text-admin-sm)]">
        <span className="text-[color:var(--color-admin-fg-muted)]">À : </span>
        {email.destinataire}
        <br />
        <span className="text-[color:var(--color-admin-fg-muted)]">Objet : </span>
        <strong>{email.sujet}</strong>
      </p>
      <iframe
        title="Aperçu de l'e-mail"
        srcDoc={email.html}
        sandbox=""
        referrerPolicy="no-referrer"
        className="h-[60vh] w-full max-w-[680px] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-white"
      />
      {onActualiserTexte && email.texteDefaut !== undefined ? (
        <EditeurTexte
          texteDefaut={email.texteDefaut}
          texte={texte}
          occupe={occupe}
          onActualiser={onActualiserTexte}
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
        <button type="button" className="admin-button" disabled={occupe} onClick={onEnvoyer}>
          {occupe ? "Envoi…" : libelleEnvoyer}
        </button>
        <button
          type="button"
          className="admin-button-secondary"
          disabled={occupe}
          onClick={onAnnuler}
        >
          Annuler
        </button>
      </div>
    </section>
  );
}

export function MessageRetour({ retour }: { retour: { ok: boolean; message: string } | null }) {
  if (!retour) return null;
  return (
    <p
      role={retour.ok ? "status" : "alert"}
      className={
        retour.ok
          ? "text-[color:var(--color-admin-success)]"
          : "text-[color:var(--color-admin-destructive)]"
      }
    >
      {retour.message}
    </p>
  );
}
