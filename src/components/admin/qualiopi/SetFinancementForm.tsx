"use client";
// use-client: formulaire interactif avec état local (selects, inputs) + useTransition pour la server action de mise à jour financement.

/**
 * SetFinancementForm — Formulaire de configuration du financement d'une session.
 *
 * Permet de définir : type de financement, statut OPCO, subrogation, numéro de
 * dossier OPCO, dispositif France Travail, payeur du reste à charge CPF.
 *
 * Appelle `setFinancementSessionAction` puis `router.refresh()`.
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setFinancementSessionAction,
  validerAccordOpcoAction,
} from "@/server/actions/qualiopi/financements";
import type {
  FinancementType,
  OpcoStatut,
  FranceTravailDispositif,
} from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types props
// ─────────────────────────────────────────────────────────────────────────────

export interface SetFinancementFormProps {
  sessionId: string;
  /** Valeurs initiales issues du Server Component. */
  financementType: FinancementType | null;
  opcoStatut: OpcoStatut;
  opcoSubrogation: boolean;
  numeroDossierOpco: string | null;
  ftDispositif: FranceTravailDispositif | null;
  cpfPayeurResteCharge: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Libellés
// ─────────────────────────────────────────────────────────────────────────────

const FINANCEMENT_OPTIONS: Array<{ value: FinancementType | ""; label: string }> = [
  { value: "", label: "— Choisir —" },
  { value: "direct", label: "Direct (entreprise)" },
  { value: "opco", label: "OPCO" },
  { value: "cpf", label: "CPF / EDOF" },
  { value: "france_travail", label: "France Travail" },
  { value: "mixte", label: "Mixte" },
];

const OPCO_STATUT_OPTIONS: Array<{ value: OpcoStatut; label: string }> = [
  { value: "non_demande", label: "Non demandé" },
  { value: "demande_en_cours", label: "Demande en cours" },
  { value: "accord_recu", label: "Accord reçu" },
  { value: "refuse", label: "Refusé" },
  { value: "paiement_recu", label: "Paiement reçu" },
];

const FT_DISPOSITIF_OPTIONS: Array<{ value: FranceTravailDispositif | ""; label: string }> = [
  { value: "", label: "— Choisir —" },
  { value: "aif", label: "AIF (Aide Individuelle à la Formation)" },
  { value: "poei", label: "POEI (Préparation Opérationnelle à l'Emploi Individuelle)" },
  { value: "csp", label: "CSP (Contrat de Sécurisation Professionnelle)" },
];

const CPF_PAYEUR_OPTIONS = [
  { value: "", label: "— Choisir —" },
  { value: "stagiaire", label: "Stagiaire" },
  { value: "employeur", label: "Employeur" },
  { value: "opco", label: "OPCO" },
  { value: "france_travail", label: "France Travail" },
  { value: "exonere", label: "Exonéré" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────────────────────

export function SetFinancementForm({
  sessionId,
  financementType,
  opcoStatut,
  opcoSubrogation,
  numeroDossierOpco,
  ftDispositif,
  cpfPayeurResteCharge,
}: SetFinancementFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [selectedType, setSelectedType] = useState<FinancementType | "">(financementType ?? "");
  const [selectedOpcoStatut, setSelectedOpcoStatut] = useState<OpcoStatut>(opcoStatut);
  const [subrogation, setSubrogation] = useState<boolean>(opcoSubrogation);
  const [numeroDossier, setNumeroDossier] = useState<string>(numeroDossierOpco ?? "");
  const [selectedFtDispositif, setSelectedFtDispositif] = useState<FranceTravailDispositif | "">(
    ftDispositif ?? "",
  );
  const [cpfPayeur, setCpfPayeur] = useState<string>(cpfPayeurResteCharge ?? "");

  const showOpco = selectedType === "opco" || selectedType === "mixte";
  const showFT = selectedType === "france_travail";
  const showCPF = selectedType === "cpf";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const result = await setFinancementSessionAction({
        sessionId,
        ...(selectedType !== "" ? { financementType: selectedType } : {}),
        ...(showOpco ? { opcoStatut: selectedOpcoStatut } : {}),
        ...(showOpco ? { opcoSubrogation: subrogation } : {}),
        ...(showOpco && numeroDossier ? { numeroDossierOpco: numeroDossier } : {}),
        ...(showFT && selectedFtDispositif !== "" ? { ftDispositif: selectedFtDispositif } : {}),
        ...(showCPF && cpfPayeur !== "" ? { cpfPayeurResteCharge: cpfPayeur } : {}),
      });

      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccessMsg("Financement mis à jour.");
        router.refresh();
      }
    });
  }

  function handleValiderAccordOpco() {
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const result = await validerAccordOpcoAction({ sessionId });
      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccessMsg("Accord OPCO validé (statut → accord_recu).");
        setSelectedOpcoStatut("accord_recu");
        router.refresh();
      }
    });
  }

  const labelCls =
    "block text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-[var(--space-admin-1)]";
  const selectCls =
    "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";
  const inputCls =
    "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";
  const fieldCls = "flex flex-col gap-[var(--space-admin-1)]";
  const gridCls = "grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]"
    >
      <div className={gridCls}>
        {/* Type de financement */}
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="financement-type">
            Type de financement
          </label>
          <select
            id="financement-type"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as FinancementType | "")}
            disabled={isPending}
            className={selectCls}
          >
            {FINANCEMENT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* OPCO — statut */}
        {showOpco && (
          <div className={fieldCls}>
            <label className={labelCls} htmlFor="opco-statut">
              Statut OPCO
            </label>
            <select
              id="opco-statut"
              value={selectedOpcoStatut}
              onChange={(e) => setSelectedOpcoStatut(e.target.value as OpcoStatut)}
              disabled={isPending}
              className={selectCls}
            >
              {OPCO_STATUT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* OPCO — subrogation */}
        {showOpco && (
          <div className={fieldCls}>
            <label className={labelCls}>Subrogation de paiement</label>
            <label className="flex cursor-pointer items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
              <input
                type="checkbox"
                checked={subrogation}
                onChange={(e) => setSubrogation(e.target.checked)}
                disabled={isPending}
                className="h-4 w-4 accent-[color:var(--color-admin-accent)]"
              />
              Facturer directement à l&apos;OPCO (subrogation)
            </label>
          </div>
        )}

        {/* OPCO — numéro de dossier */}
        {showOpco && (
          <div className={fieldCls}>
            <label className={labelCls} htmlFor="numero-dossier-opco">
              Numéro de dossier OPCO
              {subrogation && <span className="ml-1 text-[color:var(--color-admin-error)]">*</span>}
            </label>
            <input
              id="numero-dossier-opco"
              type="text"
              value={numeroDossier}
              onChange={(e) => setNumeroDossier(e.target.value)}
              disabled={isPending}
              placeholder="Ex. 2026-ATLAS-12345"
              maxLength={60}
              className={inputCls}
              aria-required={subrogation}
            />
          </div>
        )}

        {/* France Travail — dispositif */}
        {showFT && (
          <div className={fieldCls}>
            <label className={labelCls} htmlFor="ft-dispositif">
              Dispositif France Travail
            </label>
            <select
              id="ft-dispositif"
              value={selectedFtDispositif}
              onChange={(e) =>
                setSelectedFtDispositif(e.target.value as FranceTravailDispositif | "")
              }
              disabled={isPending}
              className={selectCls}
            >
              {FT_DISPOSITIF_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* CPF — payeur reste à charge */}
        {showCPF && (
          <div className={fieldCls}>
            <label className={labelCls} htmlFor="cpf-payeur">
              Payeur du reste à charge CPF
            </label>
            <select
              id="cpf-payeur"
              value={cpfPayeur}
              onChange={(e) => setCpfPayeur(e.target.value)}
              disabled={isPending}
              className={selectCls}
            >
              {CPF_PAYEUR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Messages */}
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

      {/* Boutons */}
      <div className="mt-[var(--space-admin-5)] flex flex-wrap gap-[var(--space-admin-3)]">
        <button type="submit" disabled={isPending} className="admin-button">
          {isPending ? "Enregistrement…" : "Enregistrer le financement"}
        </button>

        {showOpco && selectedOpcoStatut !== "accord_recu" && (
          <button
            type="button"
            onClick={handleValiderAccordOpco}
            disabled={isPending}
            className="admin-button"
            aria-label="Marquer l'accord OPCO comme reçu"
          >
            {isPending ? "…" : "Marquer accord OPCO reçu"}
          </button>
        )}
      </div>
    </form>
  );
}
