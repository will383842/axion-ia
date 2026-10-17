"use client";
// use-client: saisie de la liste blanche des adresses d'essai (QNC L02), envoyée
// à une Server Action, avec retour d'état sans rechargement.

import { useState, useTransition } from "react";
import { definirAdressesDEssaiAction } from "@/server/actions/qualiopi/essai";

export function AdressesEssaiForm({ initiales }: { initiales: string[] }): React.ReactElement {
  const [saisie, setSaisie] = useState(initiales.join("\n"));
  const [message, setMessage] = useState<{ texte: string; erreur: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  function enregistrer() {
    setMessage(null);
    startTransition(async () => {
      const r = await definirAdressesDEssaiAction({ saisie });
      if ("error" in r) {
        setMessage({ texte: r.error, erreur: true });
        return;
      }
      setSaisie(r.data.adresses.join("\n"));
      setMessage({
        texte:
          r.data.adresses.length === 0
            ? "Liste vide : aucun e-mail d'essai ne partira."
            : `${r.data.adresses.length} adresse(s) d'essai enregistrée(s).`,
        erreur: false,
      });
    });
  }

  return (
    <div>
      <label
        htmlFor="adresses-essai"
        className="mb-[var(--space-admin-2)] block text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]"
      >
        Adresses autorisées (une par ligne)
      </label>
      <textarea
        id="adresses-essai"
        value={saisie}
        onChange={(e) => setSaisie(e.target.value)}
        disabled={isPending}
        rows={4}
        className="w-full rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]"
      />
      <div className="mt-[var(--space-admin-3)] flex items-center gap-[var(--space-admin-3)]">
        <button
          type="button"
          onClick={enregistrer}
          disabled={isPending}
          className="rounded-[var(--radius-admin-md)] bg-[color:var(--color-admin-accent)] px-[var(--space-admin-4)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-paper)] disabled:opacity-60"
        >
          {isPending ? "Enregistrement…" : "Enregistrer la liste"}
        </button>
        {message && (
          <p
            role="status"
            className="text-[length:var(--text-admin-sm)]"
            style={{
              color: message.erreur ? "var(--color-admin-error)" : "var(--color-admin-success)",
            }}
          >
            {message.texte}
          </p>
        )}
      </div>
    </div>
  );
}
