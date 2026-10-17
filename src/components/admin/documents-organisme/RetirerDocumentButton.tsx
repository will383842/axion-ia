"use client";
// use-client: saisie du motif + confirmation (useTransition + router.refresh).

// CHANTIER QNC, L13 — « Retirer » un document de l'organisme. Réservé au
// super-administrateur, et rendu seulement quand la base sait l'inscrire au
// journal des effacements (`retraitDocumentDisponible`). Un retrait masque le
// document des listes : il n'efface ni la ligne ni le fichier.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { retirerDocumentOrganismeAction } from "@/server/actions/documents-organisme/retrait.actions";
import type { CibleDocumentOrganisme } from "@/server/documents-organisme/documents-organisme-pur";

export function RetirerDocumentButton({
  cible,
  id,
  titre,
}: {
  cible: CibleDocumentOrganisme;
  id: string;
  titre: string;
}): React.ReactElement {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await retirerDocumentOrganismeAction({ cible, id, motif });
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
        className="text-fg-muted text-xs underline hover:text-[color:var(--color-admin-destructive-fg)]"
      >
        Retirer
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border-border w-full space-y-2 rounded-md border bg-[color:var(--color-admin-paper)] p-3 text-left sm:w-80"
    >
      <p className="text-fg-muted text-xs">
        {`Retirer « ${titre} » des listes. Rien n'est effacé : la pièce et son fichier restent, et le retrait est inscrit au journal des effacements.`}
      </p>
      <textarea
        value={motif}
        onChange={(e) => setMotif(e.target.value)}
        required
        minLength={10}
        maxLength={2000}
        rows={2}
        aria-label={`Motif du retrait de ${titre}`}
        placeholder="Motif (dix caractères au moins)"
        className="border-border w-full rounded-md border bg-[color:var(--color-admin-paper)] px-2 py-1 text-xs"
      />
      {error ? (
        <p className="text-xs text-[color:var(--color-admin-destructive-fg)]">{error}</p>
      ) : null}
      <span className="flex gap-2">
        <button type="submit" disabled={pending} className="text-xs font-medium underline">
          {pending ? "Retrait…" : "Confirmer le retrait"}
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
