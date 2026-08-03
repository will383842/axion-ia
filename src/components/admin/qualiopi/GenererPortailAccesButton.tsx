"use client";
// use-client: bouton génération accès portail + affichage URL copiable + useTransition.
/**
 * GenererPortailAccesButton — Bouton admin pour générer un accès portail stagiaire.
 *
 * Appelle `genererPortailAccesAction({ traineeId })` (AGENT B).
 * Affiche l&apos;URL résultante (à transmettre au stagiaire) avec copie presse-papiers.
 *
 * Tokens admin var(--color-admin-*) — espace admin uniquement.
 */

import { useState, useTransition } from "react";

type ActionResult<T> = { data: T } | { error: string };

interface GenererPortailAccesButtonProps {
  traineeId: string;
  genererAction: (input: {
    traineeId: string;
    joursValidite?: number;
  }) => Promise<ActionResult<{ id: string; token: string; url: string; expiresAt: Date }>>;
}

export function GenererPortailAccesButton({
  traineeId,
  genererAction,
}: GenererPortailAccesButtonProps): React.ReactElement {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    url: string;
    expiresAt: Date;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleGenerer() {
    setError(null);
    setResult(null);

    startTransition(async () => {
      const res = await genererAction({ traineeId });
      if ("error" in res) {
        setError(res.error);
      } else {
        setResult({ url: res.data.url, expiresAt: new Date(res.data.expiresAt) });
      }
    });
  }

  async function handleCopier() {
    if (!result?.url) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fail-soft : copie impossible (non-HTTPS dev ou permission refusée)
    }
  }

  const expiresLabel = result
    ? result.expiresAt.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div>
      <button type="button" onClick={handleGenerer} disabled={isPending} className="admin-button">
        {isPending ? "Génération…" : "Générer un accès portail"}
      </button>

      {error && (
        <p
          role="alert"
          className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}

      {result && (
        <div className="mt-[var(--space-admin-3)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-3)]">
          <p className="mb-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            Lien d&apos;accès portail (valable jusqu&apos;au {expiresLabel ?? "—"})
          </p>
          <div className="flex items-center gap-[var(--space-admin-2)]">
            <code className="flex-1 overflow-hidden rounded border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-2)] py-1 text-[length:var(--text-admin-xs)] text-ellipsis whitespace-nowrap text-[color:var(--color-admin-fg)]">
              {result.url}
            </code>
            <button
              type="button"
              onClick={handleCopier}
              className="shrink-0 rounded border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-2)] py-1 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg)] hover:bg-[color:var(--color-admin-surface)]"
            >
              {copied ? "Copié !" : "Copier"}
            </button>
          </div>
          <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)]">
            Transmettez ce lien au stagiaire par email. Le lien ne fonctionne qu&apos;une fois pour
            poser la session cookie ; ensuite le stagiaire accède directement à son espace.
          </p>
        </div>
      )}
    </div>
  );
}
