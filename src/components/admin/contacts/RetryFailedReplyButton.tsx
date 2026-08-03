"use client";
// use-client: bouton interactif pour retry reply failed/bounced.

import { useState, useTransition } from "react";
import { retryFailedReplyAction } from "@/features/admin-submissions/reply-actions";

interface Props {
  readonly replyId: string;
}

export function RetryFailedReplyButton({ replyId }: Props): React.ReactElement {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={isPending || done}
        className="admin-button-ghost"
        onClick={() => {
          startTransition(async () => {
            const r = await retryFailedReplyAction(replyId);
            if (r.ok) {
              setDone(true);
            } else {
              setError(r.error ?? "retry_failed");
            }
          });
        }}
      >
        {done ? "Renvoyée" : isPending ? "Renvoi en cours..." : "Réessayer l'envoi"}
      </button>
      {error && <p className="mt-1 text-xs text-[color:var(--color-admin-danger-fg)]">{error}</p>}
    </div>
  );
}
