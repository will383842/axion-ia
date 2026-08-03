"use client";
// use-client: saisie interactive des pièces de sous-traitance + useTransition.

/**
 * TrainerSousTraitancePanel — pièces exigées par la procédure de sous-traitance
 * (art. 4 et 8, signée le 2026-08-03).
 *
 * 🔴 Ce panneau existe parce que les six colonnes posées par la migration du
 * 2026-08-03 n'avaient AUCUN écran de saisie : les alertes les lisaient, la
 * carte de conformité les comptait, et un sous-traitant serait resté en
 * « contrat-cadre manquant » (critique) à vie sans recours.
 *
 * ## Ce que le panneau dit, et ce qu'il se garde de dire
 *
 * Le contrat-cadre est BLOQUANT (art. 4.1) : sans lui, l'intervenant n'est pas
 * compté conforme à l'indicateur 27. La RC pro ne l'est PAS (art. 4.2, décision
 * Will) : elle est demandée, suivie, et son absence lève une alerte — jamais un
 * refus. Le libellé le dit explicitement, pour qu'une lecture rapide ne
 * transforme pas l'alerte en interdiction.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { updateTrainerSousTraitancePiecesAction } from "@/server/actions/qualiopi/trainers";

const inputCls =
  "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-admin-accent)]";
const labelCls =
  "block text-[length:var(--text-admin-xs)] font-medium uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-1";
const fieldCls = "flex flex-col gap-1";

/** `Date` → `yyyy-mm-dd` pour un `<input type="date">`, chaîne vide si absente. */
function versChampDate(d: Date | null): string {
  return d === null ? "" : d.toISOString().slice(0, 10);
}

export interface TrainerSousTraitancePanelProps {
  trainerId: string;
  action: typeof updateTrainerSousTraitancePiecesAction;
  contratSigneAt: Date | null;
  screenshotUrl: string | null;
  screenshotDate: Date | null;
  prochaineVerifAt: Date | null;
  rcProAttestationUrl: string | null;
  rcProEcheanceAt: Date | null;
}

export function TrainerSousTraitancePanel(props: TrainerSousTraitancePanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [contratSigne, setContratSigne] = useState(versChampDate(props.contratSigneAt));
  const [screenshot, setScreenshot] = useState(props.screenshotUrl ?? "");
  const [prochaineVerif, setProchaineVerif] = useState(versChampDate(props.prochaineVerifAt));
  const [rcProUrl, setRcProUrl] = useState(props.rcProAttestationUrl ?? "");
  const [rcProEcheance, setRcProEcheance] = useState(versChampDate(props.rcProEcheanceAt));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    startTransition(async () => {
      // Chaîne vide → `null` : Will retire une pièce en vidant son champ. Sans
      // cette conversion, un champ effacé partirait en `""` et échouerait la
      // validation d'URL sans que le retrait soit enregistré.
      const result = await props.action({
        id: props.trainerId,
        sousTraitantContratSigneAt: contratSigne ? new Date(contratSigne) : null,
        sousTraitantScreenshotUrl: screenshot.trim() || null,
        sousTraitantProchaineVerifAt: prochaineVerif ? new Date(prochaineVerif) : null,
        rcProAttestationUrl: rcProUrl.trim() || null,
        rcProEcheanceAt: rcProEcheance ? new Date(rcProEcheance) : null,
      });

      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccessMsg("Pièces de sous-traitance enregistrées.");
        router.refresh();
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="admin-card mb-[var(--space-admin-5)]"
      aria-labelledby="sous-traitance-titre"
    >
      <h2
        id="sous-traitance-titre"
        className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]"
      >
        Pièces de sous-traitance (articles 4 et 8)
      </h2>
      <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        Le contrat-cadre signé conditionne la conformité de l&apos;indicateur 27. L&apos;attestation
        RC pro est demandée et suivie, mais son absence n&apos;empêche pas de confier une mission.
      </p>

      <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
        <div className={fieldCls}>
          <label htmlFor="st-contrat-signe" className={labelCls}>
            Contrat-cadre signé le
          </label>
          <input
            id="st-contrat-signe"
            type="date"
            value={contratSigne}
            onChange={(e) => setContratSigne(e.target.value)}
            disabled={isPending}
            className={inputCls}
          />
        </div>

        <div className={fieldCls}>
          <label htmlFor="st-prochaine-verif" className={labelCls}>
            Prochaine vérification annuelle (article 8)
          </label>
          <input
            id="st-prochaine-verif"
            type="date"
            value={prochaineVerif}
            onChange={(e) => setProchaineVerif(e.target.value)}
            disabled={isPending}
            className={inputCls}
          />
        </div>

        <div className={`sm:col-span-2 ${fieldCls}`}>
          <label htmlFor="st-screenshot" className={labelCls}>
            Capture de la consultation data.gouv.fr (URL)
          </label>
          <input
            id="st-screenshot"
            type="url"
            value={screenshot}
            onChange={(e) => setScreenshot(e.target.value)}
            disabled={isPending}
            placeholder="https://…"
            className={inputCls}
          />
          {props.screenshotDate !== null && (
            <p className="admin-meta">
              Capture enregistrée le {props.screenshotDate.toLocaleDateString("fr-FR")}.
            </p>
          )}
        </div>

        <div className={fieldCls}>
          <label htmlFor="st-rcpro-url" className={labelCls}>
            Attestation RC pro (URL) — facultative
          </label>
          <input
            id="st-rcpro-url"
            type="url"
            value={rcProUrl}
            onChange={(e) => setRcProUrl(e.target.value)}
            disabled={isPending}
            placeholder="https://…"
            className={inputCls}
          />
        </div>

        <div className={fieldCls}>
          <label htmlFor="st-rcpro-echeance" className={labelCls}>
            Échéance de la RC pro
          </label>
          <input
            id="st-rcpro-echeance"
            type="date"
            value={rcProEcheance}
            onChange={(e) => setRcProEcheance(e.target.value)}
            disabled={isPending}
            className={inputCls}
          />
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          Erreur : {error}
        </p>
      )}
      {successMsg && (
        <p
          role="status"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {successMsg}
        </p>
      )}

      <button type="submit" disabled={isPending} className="admin-button mt-[var(--space-admin-4)]">
        {isPending ? "Enregistrement…" : "Enregistrer les pièces"}
      </button>
    </form>
  );
}
