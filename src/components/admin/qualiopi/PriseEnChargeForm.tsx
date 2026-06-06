"use client";
// use-client: formulaire interactif avec état local (useState) + appel Server Action setPriseEnChargeAction + router.refresh().

/**
 * PriseEnChargeForm — Saisie du barème de prise en charge OPCO par dossier (T18).
 *
 * Relève sur le portail OPCO de la branche du client :
 * - Montant (€) + unité (€/heure, €/jour, €/formation, €/an-salarié)
 * - Plafond par formation (€) et plafond annuel (€) — optionnels
 * - URL source (portail OPCO) — optionnelle
 * - Date de relevé — optionnelle
 *
 * Appelle `setPriseEnChargeAction` (montants saisis en € → convertis en centimes).
 * Pré-remplit avec les valeurs actuelles de la session.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPriseEnChargeAction } from "@/server/actions/qualiopi/financements";
import type { PriseEnChargeUnite } from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types props
// ─────────────────────────────────────────────────────────────────────────────

export interface PriseEnChargeFormProps {
  sessionId: string;
  /** Valeurs initiales issues du Server Component — centimes. */
  priseEnChargeMontantCents: number | null;
  priseEnChargeUnite: PriseEnChargeUnite | null;
  priseEnChargePlafondFormationCents: number | null;
  priseEnChargePlafondAnnuelCents: number | null;
  priseEnChargeSourceUrl: string | null;
  priseEnChargeReleveLe: Date | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Libellés unités
// ─────────────────────────────────────────────────────────────────────────────

const UNITE_OPTIONS: Array<{ value: PriseEnChargeUnite | ""; label: string }> = [
  { value: "", label: "— Choisir une unité —" },
  { value: "euro_heure", label: "€ / heure" },
  { value: "euro_jour", label: "€ / jour" },
  { value: "euro_formation", label: "€ / formation (forfait)" },
  { value: "euro_an_salarie", label: "€ / an / salarié" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function centsToEuros(cents: number | null): string {
  if (cents === null) return "";
  return (cents / 100).toFixed(2);
}

function parseEuros(raw: string): number | null {
  const v = parseFloat(raw.replace(",", "."));
  if (isNaN(v) || v < 0) return null;
  return Math.round(v * 100);
}

function toIsoDateLocal(d: Date | null): string {
  if (!d) return "";
  const dd = new Date(d);
  return dd.toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────────────────────

export function PriseEnChargeForm({
  sessionId,
  priseEnChargeMontantCents,
  priseEnChargeUnite,
  priseEnChargePlafondFormationCents,
  priseEnChargePlafondAnnuelCents,
  priseEnChargeSourceUrl,
  priseEnChargeReleveLe,
}: PriseEnChargeFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [montant, setMontant] = useState<string>(centsToEuros(priseEnChargeMontantCents));
  const [unite, setUnite] = useState<PriseEnChargeUnite | "">(priseEnChargeUnite ?? "");
  const [plafondFormation, setPlafondFormation] = useState<string>(
    centsToEuros(priseEnChargePlafondFormationCents),
  );
  const [plafondAnnuel, setPlafondAnnuel] = useState<string>(
    centsToEuros(priseEnChargePlafondAnnuelCents),
  );
  const [sourceUrl, setSourceUrl] = useState<string>(priseEnChargeSourceUrl ?? "");
  const [releveLe, setReleveLe] = useState<string>(toIsoDateLocal(priseEnChargeReleveLe));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (unite === "") {
      setError("L’unité est obligatoire.");
      return;
    }

    const montantCents = parseEuros(montant);
    if (montantCents === null) {
      setError("Montant invalide (doit être un nombre positif).");
      return;
    }

    const plafondFormationCents =
      plafondFormation.trim() !== "" ? parseEuros(plafondFormation) : undefined;
    if (plafondFormationCents === null) {
      setError("Plafond par formation invalide.");
      return;
    }

    const plafondAnnuelCents = plafondAnnuel.trim() !== "" ? parseEuros(plafondAnnuel) : undefined;
    if (plafondAnnuelCents === null) {
      setError("Plafond annuel invalide.");
      return;
    }

    startTransition(async () => {
      const result = await setPriseEnChargeAction({
        sessionId,
        montantCents,
        unite,
        ...(plafondFormationCents !== undefined ? { plafondFormationCents } : {}),
        ...(plafondAnnuelCents !== undefined ? { plafondAnnuelCents } : {}),
        ...(sourceUrl.trim() !== "" ? { sourceUrl: sourceUrl.trim() } : {}),
        ...(releveLe !== "" ? { releveLe: new Date(releveLe) } : {}),
      });

      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccessMsg("Barème de prise en charge enregistré.");
        router.refresh();
      }
    });
  }

  const labelCls =
    "block text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-[var(--space-admin-1)]";
  const inputCls =
    "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";
  const selectCls = inputCls;
  const fieldCls = "flex flex-col gap-[var(--space-admin-1)]";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]"
    >
      {/* Rappel contextuel */}
      <p className="mb-[var(--space-admin-4)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-warning)] bg-[color:var(--color-admin-bg)] px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        <strong className="text-[color:var(--color-admin-fg)]">
          Barème relevé sur le portail OPCO de la branche du client
        </strong>
        {" — "}saisir la valeur exacte publiée sur le portail + indiquer la source (URL) et la date
        de relevé pour traçabilité auditeur.
      </p>

      <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
        {/* Montant */}
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="pec-montant">
            Montant de prise en charge (€){" "}
            <span className="text-[color:var(--color-admin-error)]">*</span>
          </label>
          <input
            id="pec-montant"
            type="number"
            step="0.01"
            min="0"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            disabled={isPending}
            placeholder="Ex. 25.00"
            required
            className={inputCls}
          />
        </div>

        {/* Unité */}
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="pec-unite">
            Unité <span className="text-[color:var(--color-admin-error)]">*</span>
          </label>
          <select
            id="pec-unite"
            value={unite}
            onChange={(e) => setUnite(e.target.value as PriseEnChargeUnite | "")}
            disabled={isPending}
            required
            className={selectCls}
          >
            {UNITE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Plafond par formation */}
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="pec-plafond-formation">
            Plafond par formation (€)
          </label>
          <input
            id="pec-plafond-formation"
            type="number"
            step="0.01"
            min="0"
            value={plafondFormation}
            onChange={(e) => setPlafondFormation(e.target.value)}
            disabled={isPending}
            placeholder="Ex. 1500.00"
            className={inputCls}
          />
        </div>

        {/* Plafond annuel */}
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="pec-plafond-annuel">
            Plafond annuel (€)
          </label>
          <input
            id="pec-plafond-annuel"
            type="number"
            step="0.01"
            min="0"
            value={plafondAnnuel}
            onChange={(e) => setPlafondAnnuel(e.target.value)}
            disabled={isPending}
            placeholder="Ex. 3000.00"
            className={inputCls}
          />
        </div>

        {/* URL source */}
        <div className={`${fieldCls} sm:col-span-2`}>
          <label className={labelCls} htmlFor="pec-source-url">
            URL source (portail OPCO)
          </label>
          <input
            id="pec-source-url"
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            disabled={isPending}
            placeholder="Ex. https://www.opcoatlas.fr/financement/..."
            maxLength={2048}
            className={inputCls}
          />
        </div>

        {/* Date de relevé */}
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="pec-releve-le">
            Date de relevé
          </label>
          <input
            id="pec-releve-le"
            type="date"
            value={releveLe}
            onChange={(e) => setReleveLe(e.target.value)}
            disabled={isPending}
            className={inputCls}
          />
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <p
          role="alert"
          className="mt-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {successMsg && (
        <p
          role="status"
          className="mt-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {successMsg}
        </p>
      )}

      <div className="mt-[var(--space-admin-5)]">
        <button type="submit" disabled={isPending} className="admin-button">
          {isPending ? "Enregistrement…" : "Enregistrer le barème"}
        </button>
      </div>
    </form>
  );
}
