"use client";
// use-client: formulaire interactif (date + aperçu puis confirmation, useTransition)
// de la présentation de la méthode payée (lot L12i).

/**
 * « Présentation faite le … » — la présentation de la méthode payée (lot L12i).
 *
 * Rendu par la fiche formateur SEULEMENT quand l'interrupteur
 * `formateurs.presentation_payee` est allumé, et pour un sous-traitant. Deux
 * temps, comme tout geste d'argent : l'aperçu (montants calculés côté serveur,
 * mention de TVA du régime de la fiche, échéance), puis la confirmation. Rien
 * n'est validé ni payé ici : le relevé hors mission part « à valider ».
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  enregistrerPresentationMethodeAction,
  type ResultatPresentation,
} from "@/server/actions/qualiopi/formateur-presentation-methode";

function euros(c: number): string {
  return (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function PresentationMethodePanel({ trainerId }: { trainerId: string }) {
  const router = useRouter();
  const [jour, setJour] = useState("");
  const [apercu, setApercu] = useState<Extract<ResultatPresentation, { etape: "apercu" }> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function lancer(confirmer: boolean) {
    setError(null);
    setOk(null);
    startTransition(async () => {
      const r = await enregistrerPresentationMethodeAction({
        trainerId,
        jour,
        ...(confirmer ? { confirmer: "oui" as const } : {}),
      });
      if ("error" in r) {
        setError(r.error);
        setApercu(null);
        return;
      }
      if (r.data.etape === "apercu") {
        setApercu(r.data);
        return;
      }
      setApercu(null);
      setOk(`Enregistrée : relevé hors mission à valider, ${euros(r.data.totalTtcCents)} TTC.`);
      router.refresh();
    });
  }

  const labelCls =
    "block text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-[var(--space-admin-1)]";
  const inputCls =
    "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";

  return (
    <section className="admin-card mb-[var(--space-admin-5)] flex flex-col gap-[var(--space-admin-4)]">
      <h2 className="text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        Présentation de la méthode
      </h2>
      <p className="admin-muted">
        Une demi-journée payée, une seule fois, après la signature du contrat-cadre. Le relevé part
        « à valider » : la validation et le virement restent à faire.
      </p>
      <div className="flex flex-col gap-[var(--space-admin-1)] sm:max-w-xs">
        <label className={labelCls} htmlFor="presentation-jour">
          Présentation faite le
        </label>
        <input
          id="presentation-jour"
          type="date"
          className={inputCls}
          value={jour}
          onChange={(e) => {
            setJour(e.target.value);
            setApercu(null);
          }}
        />
      </div>

      {apercu !== null && (
        <div className="admin-alert admin-alert-warning" role="status">
          {euros(apercu.totalHtCents)} HT · TVA {euros(apercu.tvaCents)} ·{" "}
          {euros(apercu.totalTtcCents)} TTC — {apercu.mentionTva} — échéance le{" "}
          {new Date(`${apercu.echeance}T12:00:00Z`).toLocaleDateString("fr-FR")}.
        </div>
      )}
      {error !== null && (
        <div className="admin-alert admin-alert-error" role="alert">
          {error}
        </div>
      )}
      {ok !== null && (
        <div className="admin-alert admin-alert-success" role="status">
          {ok}
        </div>
      )}

      <div className="flex flex-wrap gap-[var(--space-admin-3)]">
        <button
          type="button"
          className="admin-button"
          disabled={isPending || jour === ""}
          onClick={() => lancer(false)}
        >
          Voir l&apos;aperçu
        </button>
        {apercu !== null && (
          <button
            type="button"
            className="admin-button"
            disabled={isPending}
            onClick={() => lancer(true)}
          >
            Confirmer la présentation
          </button>
        )}
      </div>
    </section>
  );
}
