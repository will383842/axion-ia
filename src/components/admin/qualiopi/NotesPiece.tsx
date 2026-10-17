"use client";
// use-client: formulaire d'ajout d'une note (useTransition + router.refresh).

// CHANTIER QNC, L13 — les notes d'une pièce générée, et le geste d'en ajouter
// une. Affiché SOUS la pièce, y compris sur un dossier clos : la note ne touche
// pas la pièce. Les dates arrivent déjà formatées par le serveur, à l'heure de
// Paris — ce composant n'en calcule aucune.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ajouterNotePieceAction } from "@/server/actions/qualiopi/notes-pieces";
import { MENTIONS_PIECE } from "@/server/documents-organisme/documents-organisme-pur";

export interface NotePieceAffichee {
  id: string;
  libelleMention: string;
  texte: string;
  auteurNom: string;
  /** « le 17/10/2026 à 09:42 », heure de Paris, posé par le serveur. */
  horodatage: string;
}

interface Props {
  documentId: string;
  numero: string;
  notes: NotePieceAffichee[];
}

const PETIT = "text-[length:var(--text-admin-xs)]";

export function NotesPiece({ documentId, numero, notes }: Props): React.ReactElement {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [mention, setMention] = useState<string>(MENTIONS_PIECE[0].key);
  const [texte, setTexte] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function enregistrer(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setErreur(null);
    startTransition(async () => {
      const res = await ajouterNotePieceAction({ documentId, mention, texte });
      if (res.ok) {
        setTexte("");
        setOuvert(false);
        router.refresh();
      } else {
        setErreur(res.error);
      }
    });
  }

  const aide = MENTIONS_PIECE.find((m) => m.key === mention)?.aide;

  return (
    <div className="mt-[var(--space-admin-1)]">
      {notes.length > 0 && (
        <ul className="space-y-[var(--space-admin-1)]" aria-label={`Notes sur la pièce ${numero}`}>
          {notes.map((n) => (
            <li
              key={n.id}
              className={`${PETIT} rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-2)] py-[var(--space-admin-1)] text-[color:var(--color-admin-fg)]`}
            >
              <span className="font-semibold">{n.libelleMention}</span>
              {` — ${n.texte}`}
              <span className="block text-[color:var(--color-admin-fg-muted)]">
                {`Note de ${n.auteurNom}, ${n.horodatage} (heure de Paris)`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {ouvert ? (
        <form
          onSubmit={enregistrer}
          className="mt-[var(--space-admin-2)] space-y-[var(--space-admin-2)]"
        >
          <label className={`${PETIT} block text-[color:var(--color-admin-fg-muted)]`}>
            Mention
            <select
              value={mention}
              onChange={(e) => setMention(e.target.value)}
              className="mt-[var(--space-admin-1)] block w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-2)] py-[var(--space-admin-1)] text-[color:var(--color-admin-fg)]"
            >
              {MENTIONS_PIECE.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          {aide && <p className={`${PETIT} text-[color:var(--color-admin-fg-muted)]`}>{aide}</p>}
          <label className={`${PETIT} block text-[color:var(--color-admin-fg-muted)]`}>
            Note (dix caractères au moins)
            <textarea
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              rows={2}
              required
              minLength={10}
              maxLength={2000}
              className="mt-[var(--space-admin-1)] block w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-2)] py-[var(--space-admin-1)] text-[color:var(--color-admin-fg)]"
            />
          </label>
          <p className={`${PETIT} text-[color:var(--color-admin-fg-muted)]`}>
            La pièce n&apos;est pas modifiée. La note est datée par le serveur, signée de votre nom,
            et ne se corrige que par une note suivante.
          </p>
          {erreur && (
            <p className={`${PETIT} text-[color:var(--color-admin-destructive-fg)]`}>{erreur}</p>
          )}
          <span className="flex gap-[var(--space-admin-2)]">
            <button type="submit" disabled={pending} className="admin-button-ghost">
              {pending ? "Enregistrement…" : "Ajouter la note"}
            </button>
            <button
              type="button"
              onClick={() => setOuvert(false)}
              disabled={pending}
              className="admin-button-ghost"
            >
              Annuler
            </button>
          </span>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOuvert(true)}
          className={`${PETIT} mt-[var(--space-admin-1)] text-[color:var(--color-admin-accent)] underline`}
          aria-label={`Ajouter une note à la pièce ${numero}`}
        >
          Ajouter une note
        </button>
      )}
    </div>
  );
}
