"use client";
// use-client: formulaire d'upload interactif (FormData + useTransition + router.refresh).

// Formulaire d'upload d'un document console (client minimal — useTransition).
// Appelle la Server Action puis rafraîchit la liste SSR via router.refresh().

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadConsoleDocAction } from "@/server/actions/console-documents/documents.actions";

interface Props {
  /** Valeur enum ConsoleDocSection (implementations | sites_web | autres). */
  section: string;
  /** Affiche la case « document sensible » (réservé à « Autres » : casier, etc.). */
  allowSensitive?: boolean;
}

export function ConsoleDocUploader({ section, allowSensitive = false }: Props): React.ReactElement {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("section", section);
    startTransition(async () => {
      const res = await uploadConsoleDocAction(fd);
      if (res.ok) {
        formRef.current?.reset();
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-terracotta text-terracotta hover:bg-terracotta inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition hover:text-white"
      >
        + Ajouter un document
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="border-border space-y-3 rounded-lg border bg-[color:var(--color-admin-paper)] p-4"
    >
      <div>
        <label className="text-mocha mb-1 block text-sm font-medium" htmlFor="cd-title">
          Titre <span className="text-terracotta">*</span>
        </label>
        <input
          id="cd-title"
          name="title"
          required
          maxLength={200}
          className="border-border focus:border-terracotta w-full rounded-md border px-3 py-2 text-sm outline-none"
          placeholder="Ex. Plaquette de présentation 2026"
        />
      </div>

      <div>
        <label className="text-mocha mb-1 block text-sm font-medium" htmlFor="cd-desc">
          Description (optionnel)
        </label>
        <input
          id="cd-desc"
          name="description"
          maxLength={2000}
          className="border-border focus:border-terracotta w-full rounded-md border px-3 py-2 text-sm outline-none"
        />
      </div>

      <div>
        <label className="text-mocha mb-1 block text-sm font-medium" htmlFor="cd-file">
          Fichier <span className="text-terracotta">*</span>
        </label>
        <input
          id="cd-file"
          name="file"
          type="file"
          required
          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
          className="text-fg-muted block w-full text-sm"
        />
        <p className="text-fg-muted mt-1 text-xs">PDF, Office ou image · 10 Mo max.</p>
      </div>

      {allowSensitive ? (
        <label className="text-mocha flex items-center gap-2 text-sm">
          <input name="sensitive" type="checkbox" className="h-4 w-4" />
          Document sensible (donnée personnelle — accès durci, sans aperçu navigateur)
        </label>
      ) : null}

      {error ? <p className="text-sm text-[color:var(--color-admin-destructive-fg)]">{error}</p> : null}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-terracotta inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-white transition disabled:opacity-60"
        >
          {pending ? "Envoi…" : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={pending}
          className="text-fg-muted hover:text-mocha px-3 py-2 text-sm"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
