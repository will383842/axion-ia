"use client";
// use-client: sélection du type de ventilation (forfait|horaire) et du destinataire via state local + useTransition pour la server action de génération de facture.

/**
 * GenererFactureButton — Formulaire de génération d'une facture de formation.
 *
 * Permet de choisir : destinataire (entreprise|opco|stagiaire|france_travail)
 * et type de ventilation (forfait|horaire). Appelle `genererFactureFormationAction`.
 *
 * Affiche le numéro de facture généré si succès.
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  genererFactureFormationAction,
  genererFacturePdfAction,
} from "@/server/actions/qualiopi/financements";
import type { FactureFormationDestinataire } from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types props
// ─────────────────────────────────────────────────────────────────────────────

export interface GenererFactureButtonProps {
  sessionId: string;
  /** Pre-sélectionne le destinataire selon le type de financement de la session. */
  defaultDestinataire?: FactureFormationDestinataire;
}

// ─────────────────────────────────────────────────────────────────────────────
// Libellés
// ─────────────────────────────────────────────────────────────────────────────

const DESTINATAIRE_OPTIONS: Array<{ value: FactureFormationDestinataire; label: string }> = [
  { value: "entreprise", label: "Entreprise cliente" },
  { value: "opco", label: "OPCO" },
  { value: "stagiaire", label: "Stagiaire (CPF reste à charge)" },
  { value: "france_travail", label: "France Travail" },
];

const VENTILATION_OPTIONS: Array<{ value: "forfait" | "horaire"; label: string; hint: string }> = [
  {
    value: "forfait",
    label: "Forfait",
    hint: "Montant global de la session (issu du référentiel offres_site)",
  },
  {
    value: "horaire",
    label: "Ventilation horaire (OPCO)",
    hint: "Durée réelle × participants × tarif horaire (plafond Atlas configurable, SiteSetting)",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────────────────────

export function GenererFactureButton({
  sessionId,
  defaultDestinataire = "entreprise",
}: GenererFactureButtonProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pdfDocumentId, setPdfDocumentId] = useState<string | null>(null);

  const [destinataire, setDestinataire] =
    useState<FactureFormationDestinataire>(defaultDestinataire);
  const [ventilation, setVentilation] = useState<"forfait" | "horaire">("forfait");

  function handleGenerer() {
    setError(null);
    setSuccessMsg(null);
    setPdfDocumentId(null);

    startTransition(async () => {
      const result = await genererFactureFormationAction({
        sessionId,
        destinataire,
        ventilation,
      });

      if ("error" in result) {
        setError(result.error);
        return;
      }

      setSuccessMsg(`Facture ${result.data.numero} générée avec succès (statut : Émise).`);
      router.refresh();

      // Génération du PDF — fail-soft : une erreur n'annule pas la facture créée
      try {
        const pdfResult = await genererFacturePdfAction({ factureId: result.data.factureId });
        if (!("error" in pdfResult)) {
          setPdfDocumentId(pdfResult.data.documentId);
        }
      } catch {
        // fail-soft : PDF non bloquant
      }
    });
  }

  const labelCls =
    "block text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-[var(--space-admin-1)]";
  const selectCls =
    "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";

  return (
    <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
      <h3 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        Générer une facture de formation
      </h3>

      <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        TVA appliquée selon le régime configuré (Paramètres → Qualiopi → Régime de TVA).
      </p>

      <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
        {/* Destinataire */}
        <div className="flex flex-col gap-[var(--space-admin-1)]">
          <label className={labelCls} htmlFor="facture-destinataire">
            Destinataire
          </label>
          <select
            id="facture-destinataire"
            value={destinataire}
            onChange={(e) => setDestinataire(e.target.value as FactureFormationDestinataire)}
            disabled={isPending}
            className={selectCls}
          >
            {DESTINATAIRE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            En cas de subrogation OPCO, la facture sera adressée à l&apos;OPCO automatiquement.
          </p>
        </div>

        {/* Ventilation */}
        <div className="flex flex-col gap-[var(--space-admin-2)]">
          <span className={labelCls}>Type de ventilation</span>
          {VENTILATION_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-start gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]"
            >
              <input
                type="radio"
                name="ventilation"
                value={opt.value}
                checked={ventilation === opt.value}
                onChange={() => setVentilation(opt.value)}
                disabled={isPending}
                className="mt-0.5 accent-[color:var(--color-admin-accent)]"
              />
              <span>
                <span className="font-medium">{opt.label}</span>
                <span className="block text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                  {opt.hint}
                </span>
              </span>
            </label>
          ))}
        </div>
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
      {pdfDocumentId && (
        <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
          <a
            href={`/api/qualiopi/documents/${pdfDocumentId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[color:var(--color-admin-accent)] underline"
          >
            Télécharger le PDF de la facture
          </a>
        </p>
      )}

      <div className="mt-[var(--space-admin-5)]">
        <button
          type="button"
          onClick={handleGenerer}
          disabled={isPending}
          className="admin-button"
          aria-label="Générer la facture de formation"
        >
          {isPending ? "Génération en cours…" : "Générer la facture"}
        </button>
      </div>
    </div>
  );
}
