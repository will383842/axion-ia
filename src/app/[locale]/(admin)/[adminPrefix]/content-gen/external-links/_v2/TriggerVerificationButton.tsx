"use client";

import { useState, useTransition } from "react";
import { triggerManualVerification } from "@/server/actions/content-gen/external-links";

export function TriggerVerificationButton() {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  function handleClick() {
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await triggerManualVerification();
        if ("error" in result) {
          setFeedback(`Erreur : ${result.error}`);
        } else {
          setFeedback(`Job enqueued : ${result.jobId}`);
        }
      } catch (err) {
        setFeedback(`Exception : ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className="admin-button"
        onClick={handleClick}
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? "Enqueue..." : "Lancer vérification HEAD"}
      </button>
      {feedback && <small className="admin-meta">{feedback}</small>}
    </div>
  );
}
