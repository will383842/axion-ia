"use client";

/**
 * Bouton « Relancer » du bloc « Retours en attente » (page À traiter).
 *
 * Même email et même trace que la relance automatique du cron — l'action
 * serveur délègue à `envoyerRelanceQuestionnaire`. Pas de confirmation modale :
 * relancer un questionnaire est réversible par nature (au pire, un email de
 * trop), et le compteur affiché à côté informe déjà l'admin.
 */

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { relancerQuestionnaireAction } from "@/server/actions/qualiopi/questionnaires";

export function RelancerQuestionnaireButton({
  questionnaireId,
  destinataire,
}: {
  questionnaireId: string;
  destinataire: string;
}): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [etat, setEtat] = useState<"idle" | "fait" | "erreur">("idle");
  const [message, setMessage] = useState<string | null>(null);

  function handleClick() {
    startTransition(async () => {
      const result = await relancerQuestionnaireAction({ questionnaireId });
      if ("error" in result) {
        setEtat("erreur");
        setMessage(result.error);
        return;
      }
      setEtat("fait");
      setMessage(null);
      router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-[var(--space-admin-2)]">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending || etat === "fait"}
        className="admin-button-ghost"
        aria-label={`Relancer ${destinataire}`}
      >
        {isPending ? "Envoi…" : etat === "fait" ? "Relancé ✓" : "Relancer"}
      </button>
      {etat === "erreur" && message !== null && (
        <span
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          {message}
        </span>
      )}
    </span>
  );
}
