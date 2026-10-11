"use client";
// use-client: saisie de la confirmation + appel de Server Action avec retour visuel (useTransition).

/**
 * Effacement art. 17 d'un formateur indépendant (lot L16a) — geste de
 * super-administrateur, sur demande de la personne.
 *
 * PSEUDONYMISATION seulement : la fiche, les pièces et leur contenu sont
 * conservés ; les pièces légales restent intactes, les autres sont masquées.
 * Rien ne part sans la confirmation saisie mot pour mot.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { effacerFormateurIndependantAction } from "@/server/actions/qualiopi/rgpd-formateur-independant";

export interface TrainerEffacementRgpdPanelProps {
  trainerId: string;
  /** Texte à saisir pour confirmer (« EFFACER »). */
  confirmation: string;
}

export function TrainerEffacementRgpdPanel({
  trainerId,
  confirmation,
}: TrainerEffacementRgpdPanelProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saisie, setSaisie] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setMsg(null);
    setError(null);
    startTransition(async () => {
      const r = await effacerFormateurIndependantAction({
        trainerId,
        confirmation: saisie as "EFFACER",
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setMsg(
        r.resultat.formateur === "efface"
          ? `Identité pseudonymisée. ${r.resultat.piecesLegalesIntactes} pièce(s) légale(s) intacte(s), ${r.resultat.piecesMasquees} pièce(s) masquée(s).`
          : `Lien contractuel : identité de facturation conservée, téléphone retiré, accès révoqués. ${r.resultat.piecesMasquees} pièce(s) masquée(s).`,
      );
      setSaisie("");
      router.refresh();
    });
  }

  return (
    <section
      className="admin-card mb-[var(--space-admin-5)] flex flex-col gap-[var(--space-admin-2)]"
      aria-labelledby="effacement-rgpd-titre"
    >
      <h2
        id="effacement-rgpd-titre"
        className="text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]"
      >
        Droit à l&apos;effacement (RGPD art. 17)
      </h2>
      <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        À faire seulement sur demande de la personne. Aucune donnée n&apos;est supprimée :
        l&apos;identité est pseudonymisée, les pièces légales restent intactes, les autres pièces
        sont masquées. Geste irréversible depuis la console.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-[var(--space-admin-2)]">
        <label className="flex flex-col gap-[var(--space-admin-1)] text-[length:var(--text-admin-sm)]">
          Saisir « {confirmation} » pour confirmer
          <input
            type="text"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            autoComplete="off"
            className="admin-input"
          />
        </label>
        <button
          type="submit"
          disabled={isPending || saisie !== confirmation}
          className="admin-button"
        >
          {isPending ? "Effacement…" : "Effacer (pseudonymiser)"}
        </button>
      </form>
      {msg && (
        <p
          role="status"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {msg}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-destructive)]"
        >
          {error}
        </p>
      )}
    </section>
  );
}
