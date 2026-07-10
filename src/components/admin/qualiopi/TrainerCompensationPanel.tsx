"use client";
// use-client: saisie interactive du barème versionné (création + clôture d'une
// version), avec useTransition + router.refresh().

/**
 * TrainerCompensationPanel — barème de rémunération d'un formateur.
 *
 * Le barème n'est JAMAIS modifié : créer une nouvelle version CLÔT
 * automatiquement la précédente à sa date d'entrée en vigueur (côté serveur).
 * C'est ce qui garantit qu'augmenter un taux en septembre ne recalcule jamais
 * les sessions de juin.
 *
 * Les montants se saisissent en EUROS et sont convertis en centimes à l'envoi :
 * un opérateur pense en euros, la base stocke des centimes entiers.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  createCompensationRuleAction,
  closeCompensationRuleAction,
} from "@/server/actions/qualiopi/trainer-remuneration";
import type { CompensationModel } from "@/server/qualiopi/remuneration/calcul";

export interface RegleView {
  id: string;
  model: CompensationModel;
  prestationType: string | null;
  interventionSlug: string | null;
  tauxJourneeHtCents: number | null;
  tauxHoraireHtCents: number | null;
  commissionPct: number | null;
  forfaitHtCents: number | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  note: string | null;
}

export interface FormationOption {
  slug: string;
  titre: string;
}

const MODELES: { value: CompensationModel; label: string }[] = [
  { value: "taux_journalier", label: "Taux journalier (€/jour)" },
  { value: "taux_horaire", label: "Taux horaire (€/heure)" },
  { value: "commission_ca_pct", label: "Commission (% du CA)" },
  { value: "forfait_prestation", label: "Forfait (€/prestation)" },
];

const PRESTATION_TYPES: { value: string; label: string }[] = [
  { value: "", label: "Tous types (barème global)" },
  { value: "formation_collective", label: "Formation collective" },
  { value: "coaching_1to1", label: "Coaching 1-to-1" },
  { value: "audit", label: "Audit" },
];

const LIBELLE_MODELE: Record<CompensationModel, string> = {
  taux_journalier: "Taux journalier",
  taux_horaire: "Taux horaire",
  commission_ca_pct: "Commission CA",
  forfait_prestation: "Forfait",
};

/** Centimes → « 1 234,56 € ». */
function euros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/** Euros saisis (chaîne) → centimes entiers, ou `undefined` si vide. */
function enCentimes(valeurEuros: string): number | undefined {
  if (valeurEuros === "") return undefined;
  const n = Number(valeurEuros);
  return Number.isFinite(n) ? Math.round(n * 100) : undefined;
}

interface Props {
  trainerId: string;
  regles: RegleView[];
  formations: FormationOption[];
}

export function TrainerCompensationPanel({
  trainerId,
  regles,
  formations,
}: Props): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [model, setModel] = useState<CompensationModel>("taux_journalier");
  const [prestationType, setPrestationType] = useState("");
  const [interventionSlug, setInterventionSlug] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [montant, setMontant] = useState(""); // euros (journalier/horaire/forfait)
  const [pct, setPct] = useState(""); // pourcentage (commission)
  const [note, setNote] = useState("");

  const estCommission = model === "commission_ca_pct";

  function creer() {
    setError(null);
    startTransition(async () => {
      const r = await createCompensationRuleAction({
        trainerId,
        model,
        prestationType: prestationType === "" ? undefined : (prestationType as never),
        interventionSlug: interventionSlug === "" ? undefined : interventionSlug,
        effectiveFrom,
        // Le taux du modèle choisi, les autres restent vides.
        tauxJourneeHtCents: model === "taux_journalier" ? enCentimes(montant) : undefined,
        tauxHoraireHtCents: model === "taux_horaire" ? enCentimes(montant) : undefined,
        forfaitHtCents: model === "forfait_prestation" ? enCentimes(montant) : undefined,
        commissionPct: estCommission && pct !== "" ? Number(pct) : undefined,
        note: note === "" ? undefined : note,
      });
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setMontant("");
      setPct("");
      setNote("");
      setEffectiveFrom("");
      router.refresh();
    });
  }

  function cloturer(id: string, dateStr: string) {
    setError(null);
    startTransition(async () => {
      const r = await closeCompensationRuleAction({ id, effectiveTo: dateStr });
      if ("error" in r) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
      <h2 className="admin-h2">Barème de rémunération</h2>
      <p className="admin-muted">
        On ne modifie jamais un taux : créer une version clôt automatiquement la précédente à sa
        date d&apos;entrée en vigueur. Augmenter un taux en septembre ne recalcule jamais les
        sessions de juin.
      </p>

      {/* ── Formulaire de création ─────────────────────────────────────────── */}
      <div className="mt-[var(--space-admin-4)] flex flex-wrap items-end gap-[var(--space-admin-3)]">
        <div className="admin-field">
          <label className="admin-label" htmlFor="bareme-model">
            Modèle
          </label>
          <select
            id="bareme-model"
            className="admin-input"
            value={model}
            onChange={(e) => setModel(e.target.value as CompensationModel)}
          >
            {MODELES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-field">
          <label className="admin-label" htmlFor="bareme-type">
            Type de prestation
          </label>
          <select
            id="bareme-type"
            className="admin-input"
            value={prestationType}
            onChange={(e) => setPrestationType(e.target.value)}
          >
            {PRESTATION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-field">
          <label className="admin-label" htmlFor="bareme-slug">
            Intervention (facultatif)
          </label>
          <select
            id="bareme-slug"
            className="admin-input"
            value={interventionSlug}
            onChange={(e) => setInterventionSlug(e.target.value)}
          >
            <option value="">Toutes</option>
            {formations.map((f) => (
              <option key={f.slug} value={f.slug}>
                {f.titre}
              </option>
            ))}
          </select>
        </div>

        {estCommission ? (
          <div className="admin-field">
            <label className="admin-label" htmlFor="bareme-pct">
              Commission (%)
            </label>
            <input
              id="bareme-pct"
              type="number"
              min={0}
              max={100}
              step="0.01"
              className="admin-input"
              value={pct}
              onChange={(e) => setPct(e.target.value)}
            />
          </div>
        ) : (
          <div className="admin-field">
            <label className="admin-label" htmlFor="bareme-montant">
              Montant HT (€)
            </label>
            <input
              id="bareme-montant"
              type="number"
              min={0}
              step="0.01"
              className="admin-input"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
            />
          </div>
        )}

        <div className="admin-field">
          <label className="admin-label" htmlFor="bareme-from">
            En vigueur à partir du
          </label>
          <input
            id="bareme-from"
            type="date"
            className="admin-input"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
          />
        </div>

        <div className="admin-field">
          <label className="admin-label" htmlFor="bareme-note">
            Note (facultatif)
          </label>
          <input
            id="bareme-note"
            className="admin-input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="admin-button"
          disabled={isPending || effectiveFrom === ""}
          onClick={creer}
        >
          {isPending ? "…" : "Créer la version"}
        </button>
      </div>

      {error !== null && (
        <p
          role="alert"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-destructive)]"
        >
          {error}
        </p>
      )}

      {/* ── Historique des versions ────────────────────────────────────────── */}
      {regles.length === 0 ? (
        <p className="admin-muted mt-[var(--space-admin-4)]">
          Aucun barème. Sans version, le run retombe sur le tarif journalier legacy du formateur.
        </p>
      ) : (
        <table className="admin-table mt-[var(--space-admin-4)]">
          <thead>
            <tr>
              <th scope="col">Modèle</th>
              <th scope="col">Cible</th>
              <th scope="col">Valeur</th>
              <th scope="col">Du</th>
              <th scope="col">Au (exclu)</th>
              <th scope="col">
                <span className="sr-only">Clôturer</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {regles.map((r) => (
              <tr key={r.id}>
                <td>{LIBELLE_MODELE[r.model]}</td>
                <td>
                  {r.prestationType ?? "tous types"}
                  {r.interventionSlug !== null && ` · ${r.interventionSlug}`}
                </td>
                <td className="tabular-nums">
                  {r.model === "commission_ca_pct"
                    ? `${r.commissionPct ?? 0} %`
                    : euros(r.tauxJourneeHtCents ?? r.tauxHoraireHtCents ?? r.forfaitHtCents ?? 0)}
                </td>
                <td>{r.effectiveFrom.toLocaleDateString("fr-FR")}</td>
                <td>
                  {r.effectiveTo === null ? (
                    <span className="admin-muted">en vigueur</span>
                  ) : (
                    r.effectiveTo.toLocaleDateString("fr-FR")
                  )}
                </td>
                <td>
                  {r.effectiveTo === null && (
                    <CloturerCell disabled={isPending} onCloturer={(d) => cloturer(r.id, d)} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** Petit sous-formulaire de clôture d'une version en vigueur. */
function CloturerCell({
  disabled,
  onCloturer,
}: {
  disabled: boolean;
  onCloturer: (dateStr: string) => void;
}): React.ReactElement {
  const [date, setDate] = useState("");
  return (
    <span className="flex items-center gap-[var(--space-admin-2)]">
      <input
        type="date"
        className="admin-input"
        value={date}
        aria-label="Date de clôture"
        onChange={(e) => setDate(e.target.value)}
      />
      <button
        type="button"
        className="admin-button-ghost"
        disabled={disabled || date === ""}
        onClick={() => onCloturer(date)}
      >
        Clôturer
      </button>
    </span>
  );
}
