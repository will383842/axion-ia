"use client";
// use-client: panneaux dépliants (modifier / remplacer le fichier) + confirmation
// de suppression, tous interactifs.

// Les trois gestes de la vie d'une pièce administrative, sur une même ligne.
//
// « Remplacer le fichier » est séparé de « Modifier » à dessein : ce sont deux
// intentions différentes. Corriger une date mal saisie ne doit pas obliger à
// re-déposer un PDF, et déposer le Kbis du trimestre suivant ne doit pas
// obliger à retaper le titre.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  remplacerFichierSocieteDocAction,
  supprimerSocieteDocAction,
} from "@/server/actions/societe-documents/documents.actions";
import { useConfirmation } from "@/components/admin/ui/useConfirmation";
import type { SocieteDocTypeDef } from "@/server/societe-documents/rubriques";
import { SocieteDocForm, type PieceEditable } from "./SocieteDocForm";

interface Props {
  piece: PieceEditable;
  types: ReadonlyArray<SocieteDocTypeDef>;
}

const LIEN = "text-terracotta text-xs font-medium underline disabled:opacity-60";

export function SocieteDocActions({ piece, types }: Props): React.ReactElement {
  const router = useRouter();
  const [panneau, setPanneau] = useState<"aucun" | "modifier" | "remplacer">("aucun");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { demander, dialogue } = useConfirmation();

  function onRemplacer(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("id", piece.id);
    startTransition(async () => {
      const res = await remplacerFichierSocieteDocAction(fd);
      if (res.ok) {
        setPanneau("aucun");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function onSupprimer(): void {
    demander(
      {
        titre: `Supprimer définitivement « ${piece.titre} » ?`,
        description:
          "La pièce et son fichier disparaissent. L'action reste tracée au journal d'activité.",
        destructif: true,
        libelleConfirmer: "Supprimer",
      },
      () => {
        setError(null);
        const fd = new FormData();
        fd.set("id", piece.id);
        startTransition(async () => {
          const res = await supprimerSocieteDocAction(fd);
          if (res.ok) router.refresh();
          else setError(res.error);
        });
      },
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {dialogue}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setPanneau(panneau === "modifier" ? "aucun" : "modifier")}
          className={LIEN}
        >
          {panneau === "modifier" ? "Fermer" : "Modifier"}
        </button>
        <button
          type="button"
          onClick={() => setPanneau(panneau === "remplacer" ? "aucun" : "remplacer")}
          className={LIEN}
        >
          {panneau === "remplacer" ? "Fermer" : "Remplacer le fichier"}
        </button>
        <button
          type="button"
          onClick={onSupprimer}
          disabled={pending}
          className="text-fg-muted text-xs underline hover:text-[color:var(--color-admin-destructive-fg)] disabled:opacity-60"
        >
          {pending ? "…" : "Supprimer"}
        </button>
      </div>

      {error ? (
        <p className="text-xs text-[color:var(--color-admin-destructive-fg)]">{error}</p>
      ) : null}

      {panneau === "modifier" ? (
        <div className="w-full min-w-0 sm:w-[32rem]">
          <SocieteDocForm
            types={types}
            piece={piece}
            ouvertParDefaut
            onTermine={() => setPanneau("aucun")}
          />
        </div>
      ) : null}

      {panneau === "remplacer" ? (
        <form
          onSubmit={onRemplacer}
          className="border-border w-full min-w-0 space-y-3 rounded-lg border bg-[color:var(--color-admin-paper)] p-4 text-left sm:w-[32rem]"
        >
          <p className="text-fg-muted text-xs">
            Le nouveau fichier prend la place de l&apos;ancien, qui est effacé du disque. Les dates
            laissées vides restent inchangées.
          </p>
          <div>
            <label
              className="text-mocha mb-1 block text-sm font-medium"
              htmlFor={`rep-file-${piece.id}`}
            >
              Nouveau fichier <span className="text-terracotta">*</span>
            </label>
            <input
              id={`rep-file-${piece.id}`}
              name="file"
              type="file"
              required
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
              className="text-fg-muted block w-full text-sm"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                className="text-mocha mb-1 block text-sm font-medium"
                htmlFor={`rep-em-${piece.id}`}
              >
                Nouvelle date d&apos;émission
              </label>
              <input
                id={`rep-em-${piece.id}`}
                name="dateEmission"
                type="date"
                className="border-border focus:border-terracotta w-full rounded-md border bg-[color:var(--color-admin-paper)] px-3 py-2 text-sm outline-none"
              />
            </div>
            <div>
              <label
                className="text-mocha mb-1 block text-sm font-medium"
                htmlFor={`rep-ex-${piece.id}`}
              >
                Périme le
              </label>
              <input
                id={`rep-ex-${piece.id}`}
                name="dateExpiration"
                type="date"
                className="border-border focus:border-terracotta w-full rounded-md border bg-[color:var(--color-admin-paper)] px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="bg-terracotta inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-white transition disabled:opacity-60"
            >
              {pending ? "Remplacement…" : "Remplacer"}
            </button>
            <button
              type="button"
              onClick={() => setPanneau("aucun")}
              disabled={pending}
              className="text-fg-muted hover:text-mocha px-3 py-2 text-sm"
            >
              Annuler
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
