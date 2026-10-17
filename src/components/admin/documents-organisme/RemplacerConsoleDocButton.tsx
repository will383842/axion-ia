"use client";
// use-client: dépliant + envoi du fichier (FormData + useTransition + router.refresh).

// CHANTIER QNC, L13 — « Remplacer » un document du hub. Le nouveau document
// prend la place de l'ancien dans la liste ; l'ancien est GARDÉ, avec son
// fichier, dans « Versions remplacées ». Affiché seulement interrupteur allumé.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { remplacerConsoleDocAction } from "@/server/actions/console-documents/documents.actions";

export function RemplacerConsoleDocButton({
  id,
  title,
}: {
  id: string;
  title: string;
}): React.ReactElement {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("id", id);
    startTransition(async () => {
      const res = await remplacerConsoleDocAction(fd);
      if (res.ok) {
        setOuvert(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="text-terracotta text-xs font-medium underline"
      >
        Remplacer
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border-border w-full space-y-2 rounded-md border bg-[color:var(--color-admin-paper)] p-3 text-left sm:w-80"
    >
      <p className="text-fg-muted text-xs">
        {`Nouvelle version de « ${title} ». L'ancienne est gardée, avec son fichier, et reste téléchargeable.`}
      </p>
      <input
        name="file"
        type="file"
        required
        aria-label={`Nouveau fichier pour ${title}`}
        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
        className="text-fg-muted block w-full text-xs"
      />
      {error ? (
        <p className="text-xs text-[color:var(--color-admin-destructive-fg)]">{error}</p>
      ) : null}
      <span className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-terracotta rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          {pending ? "Remplacement…" : "Remplacer"}
        </button>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          disabled={pending}
          className="text-fg-muted px-2 text-xs"
        >
          Annuler
        </button>
      </span>
    </form>
  );
}
