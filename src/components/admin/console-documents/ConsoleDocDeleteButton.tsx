"use client";
// use-client: confirm() navigateur + useTransition pour la suppression + router.refresh.

// Bouton de suppression d'un document console (client minimal — confirm + transition).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteConsoleDocAction } from "@/server/actions/console-documents/documents.actions";
import { useConfirmation } from "@/components/admin/ui/useConfirmation";

export function ConsoleDocDeleteButton({
  id,
  title,
}: {
  id: string;
  title: string;
}): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { demander, dialogue } = useConfirmation();

  function onDelete(): void {
    demander(
      {
        titre: `Supprimer définitivement « ${title} » ?`,
        description: "Le document disparaît de la console. L'action reste tracée au journal.",
        destructif: true,
        libelleConfirmer: "Supprimer",
      },
      () => supprimerVraiment(),
    );
  }

  function supprimerVraiment(): void {
    setError(null);
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      const res = await deleteConsoleDocAction(fd);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <span className="inline-flex flex-col items-end">
      {dialogue}
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="text-fg-muted text-xs underline hover:text-[color:var(--color-admin-destructive-fg)] disabled:opacity-60"
      >
        {pending ? "Suppression…" : "Supprimer"}
      </button>
      {error ? (
        <span className="text-xs text-[color:var(--color-admin-destructive-fg)]">{error}</span>
      ) : null}
    </span>
  );
}
