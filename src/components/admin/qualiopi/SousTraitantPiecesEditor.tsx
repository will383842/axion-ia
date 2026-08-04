"use client";
// use-client: saisie interactive des pièces d'un organisme sous-traitant.

/**
 * SousTraitantPiecesEditor — pièces exigées par la procédure de sous-traitance
 * (art. 4 et 8) pour un ORGANISME.
 *
 * 🔴 Pendant de `TrainerSousTraitancePanel`. Les colonnes posées sur
 * `sous_traitants_of` le 2026-08-03 n'avaient aucun écrivain : les alertes les
 * lisaient, rien ne les remplissait.
 *
 * Replié par défaut (`<details>`) : la table des sous-traitants porte déjà huit
 * colonnes, et ces pièces se saisissent une fois par an — les déplier en
 * permanence noierait les informations consultées à chaque visite.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { updateSousTraitantPiecesAction } from "@/server/actions/qualiopi/sous-traitants";

const inputCls =
  "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-2)] py-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-admin-accent)]";
const labelCls =
  "block text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-fg-muted)] mb-1";

/** `Date` → `yyyy-mm-dd` pour un `<input type="date">`, chaîne vide si absente. */
function versChampDate(d: Date | null): string {
  return d === null ? "" : d.toISOString().slice(0, 10);
}

export interface SousTraitantPiecesEditorProps {
  sousTraitantId: string;
  action: typeof updateSousTraitantPiecesAction;
  prochaineVerifAt: Date | null;
  rcProAttestationUrl: string | null;
  rcProEcheanceAt: Date | null;
  cvUrl: string | null;
}

export function SousTraitantPiecesEditor(props: SousTraitantPiecesEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [prochaineVerif, setProchaineVerif] = useState(versChampDate(props.prochaineVerifAt));
  const [rcProUrl, setRcProUrl] = useState(props.rcProAttestationUrl ?? "");
  const [rcProEcheance, setRcProEcheance] = useState(versChampDate(props.rcProEcheanceAt));
  const [cvUrl, setCvUrl] = useState(props.cvUrl ?? "");

  const id = props.sousTraitantId;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    startTransition(async () => {
      // Champ vidé → `null` (pièce retirée). Sans cette conversion, `""`
      // échouerait la validation d'URL et le retrait passerait à la trappe.
      const result = await props.action({
        id,
        prochaineVerifAt: prochaineVerif ? new Date(prochaineVerif) : null,
        rcProAttestationUrl: rcProUrl.trim() || null,
        rcProEcheanceAt: rcProEcheance ? new Date(rcProEcheance) : null,
        cvUrl: cvUrl.trim() || null,
      });

      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccessMsg("Pièces enregistrées.");
        router.refresh();
      }
    });
  }

  return (
    <details className="mt-[var(--space-admin-2)]">
      <summary className="cursor-pointer text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)]">
        Pièces (RC pro, CV, vérification)
      </summary>

      <form onSubmit={handleSubmit} className="mt-[var(--space-admin-2)] flex flex-col gap-2">
        <div>
          <label htmlFor={`st-${id}-verif`} className={labelCls}>
            Prochaine vérification (art. 8)
          </label>
          <input
            id={`st-${id}-verif`}
            type="date"
            value={prochaineVerif}
            onChange={(e) => setProchaineVerif(e.target.value)}
            disabled={isPending}
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor={`st-${id}-rcpro`} className={labelCls}>
            Attestation RC pro (URL) — facultative
          </label>
          <input
            id={`st-${id}-rcpro`}
            type="url"
            value={rcProUrl}
            onChange={(e) => setRcProUrl(e.target.value)}
            disabled={isPending}
            placeholder="https://…"
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor={`st-${id}-rcpro-echeance`} className={labelCls}>
            Échéance RC pro
          </label>
          <input
            id={`st-${id}-rcpro-echeance`}
            type="date"
            value={rcProEcheance}
            onChange={(e) => setRcProEcheance(e.target.value)}
            disabled={isPending}
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor={`st-${id}-cv`} className={labelCls}>
            CV de l&apos;intervenant désigné (URL)
          </label>
          <input
            id={`st-${id}-cv`}
            type="url"
            value={cvUrl}
            onChange={(e) => setCvUrl(e.target.value)}
            disabled={isPending}
            placeholder="https://…"
            className={inputCls}
          />
        </div>

        {error && (
          <p
            role="alert"
            className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
          >
            {error}
          </p>
        )}
        {successMsg && (
          <p
            role="status"
            className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-success)]"
          >
            {successMsg}
          </p>
        )}

        <button type="submit" disabled={isPending} className="admin-button">
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>
    </details>
  );
}
