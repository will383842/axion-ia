// Carte « Notes » du Résumé (lot B4) : épinglées d'abord, puis les 3 plus récentes. Composant
// serveur, formulaires sans JavaScript. Le texte est déjà déchiffré par `lireNotes`.

import { Pin, PinOff, StickyNote } from "lucide-react";

import { AdminBloc } from "@/components/admin/ui/AdminBloc";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { formatDateFr } from "@/lib/format-date-fr";
import {
  ajouterNoteFormAction,
  basculerEpingleFormAction,
} from "@/features/dossier-client/fiche/actions-notes";
import { NOTE_LONGUEUR_MAX, type NoteAffichee } from "@/features/dossier-client/fiche/notes";

export interface PrestationChoisissable {
  readonly id: string;
  readonly titre: string;
}

export function CarteNotes(props: {
  clientId: string;
  notes: readonly NoteAffichee[];
  total: number;
  prestations: readonly PrestationChoisissable[];
  peutEcrire: boolean;
}): React.ReactElement {
  const { clientId, notes, total, prestations, peutEcrire } = props;
  const titres = new Map(prestations.map((p) => [p.id, p.titre]));
  return (
    <AdminBloc
      teinte="gris"
      niveau={2}
      titre={
        <span className="inline-flex items-center gap-[var(--space-admin-2)]">
          <StickyNote aria-hidden="true" className="h-4 w-4" />
          Notes
        </span>
      }
    >
      {notes.length === 0 ? (
        <p className="text-[length:var(--text-admin-sm)]">Aucune note pour le moment.</p>
      ) : (
        <ul className="space-y-[var(--space-admin-3)]">
          {notes.map((n) => (
            <li
              key={n.id}
              data-note={n.id}
              className="border-b border-[color:var(--color-admin-border)] pb-[var(--space-admin-3)]"
            >
              <div className="flex flex-wrap items-center gap-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                <span>{formatDateFr(n.createdAt)}</span>
                <span>{n.auteurLabel}</span>
                {n.projetId !== null && titres.has(n.projetId) ? (
                  <span>{`Prestation : ${titres.get(n.projetId)}`}</span>
                ) : null}
                {n.epinglee ? (
                  <span className="inline-flex items-center gap-[var(--space-admin-1)] font-semibold">
                    <Pin aria-hidden="true" className="h-4 w-4" />
                    Épinglée
                  </span>
                ) : null}
              </div>
              <p className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] whitespace-pre-wrap">
                {n.texte ?? "Texte illisible : la clé de chiffrement est absente."}
              </p>
              {peutEcrire ? (
                <form action={basculerEpingleFormAction} className="mt-[var(--space-admin-2)]">
                  <input type="hidden" name="clientId" value={clientId} />
                  <input type="hidden" name="noteId" value={n.id} />
                  <AdminButton
                    type="submit"
                    variant="secondary"
                    icon={n.epinglee ? PinOff : Pin}
                    className="min-h-11"
                  >
                    {n.epinglee ? "Détacher" : "Épingler"}
                  </AdminButton>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {total > notes.length ? (
        <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          {`${total} notes au total : les épinglées et les 3 plus récentes sont affichées.`}
        </p>
      ) : null}
      {peutEcrire ? (
        <details className="mt-[var(--space-admin-3)]">
          <summary className="flex min-h-11 cursor-pointer items-center text-[length:var(--text-admin-sm)] font-semibold">
            Ajouter une note
          </summary>
          <form
            action={ajouterNoteFormAction}
            className="mt-[var(--space-admin-2)] space-y-[var(--space-admin-2)]"
          >
            <input type="hidden" name="clientId" value={clientId} />
            <label className="block text-[length:var(--text-admin-sm)]">
              Texte de la note
              <textarea
                name="texte"
                required
                maxLength={NOTE_LONGUEUR_MAX}
                rows={4}
                className="mt-[var(--space-admin-1)] block w-full rounded-md border border-[color:var(--color-admin-border)] p-[var(--space-admin-2)]"
              />
            </label>
            {prestations.length > 0 ? (
              <label className="block text-[length:var(--text-admin-sm)]">
                Prestation (facultatif)
                <select
                  name="projetId"
                  defaultValue=""
                  className="mt-[var(--space-admin-1)] block min-h-11 w-full rounded-md border border-[color:var(--color-admin-border)] p-[var(--space-admin-2)]"
                >
                  <option value="">Aucune prestation</option>
                  {prestations.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.titre}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <AdminButton type="submit" variant="secondary" className="min-h-11">
              Enregistrer la note
            </AdminButton>
            <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
              La note est chiffrée. Elle ne se modifie pas : pour corriger, ajoutez une nouvelle
              note.
            </p>
          </form>
        </details>
      ) : null}
    </AdminBloc>
  );
}
