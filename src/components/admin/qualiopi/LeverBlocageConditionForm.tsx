"use client";
// use-client: formulaire interactif (référence de la renonciation, envoi) en état local, chargé à part par DocumentsSection.

/**
 * INT-T81-A — « Lever le blocage » : ouvre la convocation et l'émargement d'une
 * session dont la convention est encore sous condition suspensive, parce que le
 * client a renoncé PAR ÉCRIT. Une seule fois, journalisé, réservé à un
 * administrateur (le rôle est rejugé côté serveur : l'écran ne fait que refléter).
 *
 * Chargé à la demande (`next/dynamic`) pour ne pas alourdir la page des sessions
 * (cliquet de poids de la console).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { leverBlocageConditionSuspensiveAction } from "@/server/actions/qualiopi/documents";

export function LeverBlocageConditionForm({
  documentId,
}: {
  documentId: string;
}): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [ouvert, setOuvert] = useState(false);
  const [reference, setReference] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function lever() {
    setErreur(null);
    setMessage(null);
    startTransition(async () => {
      let r: Awaited<ReturnType<typeof leverBlocageConditionSuspensiveAction>>;
      try {
        r = await leverBlocageConditionSuspensiveAction({
          documentId,
          motif: "renonciation_ecrite_client",
          referenceRenonciation: reference,
        });
      } catch {
        setErreur("Cet acte est réservé à un administrateur.");
        return;
      }
      if ("error" in r) setErreur(r.error);
      else {
        setMessage(r.data.message);
        setOuvert(false);
        router.refresh();
      }
    });
  }

  return (
    <span className="mt-[var(--space-admin-1)] block">
      {ouvert ? (
        <span className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
          <label className="flex items-center gap-[var(--space-admin-1)]">
            <span>Référence de la renonciation écrite du client</span>
            <input
              type="text"
              value={reference}
              maxLength={80}
              disabled={isPending}
              onChange={(e) => setReference(e.target.value)}
              className="admin-input"
            />
          </label>
          <button
            type="button"
            className="admin-button-ghost"
            disabled={isPending || reference.trim().length < 3}
            onClick={lever}
          >
            Lever le blocage (une seule fois)
          </button>
        </span>
      ) : (
        <button
          type="button"
          className="admin-button-ghost"
          disabled={isPending}
          onClick={() => setOuvert(true)}
        >
          Lever le blocage de la convocation et de l&apos;émargement
        </button>
      )}
      {erreur && (
        <span role="alert" className="block text-[color:var(--color-admin-error)]">
          {erreur}
        </span>
      )}
      {message && (
        <span role="status" className="block text-[color:var(--color-admin-success)]">
          {message}
        </span>
      )}
    </span>
  );
}
