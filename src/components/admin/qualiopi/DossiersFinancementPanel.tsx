"use client";
// use-client: pilotage des dossiers de financement (création + transitions du cycle a_monter→…→clos) — état local + useTransition + creerDossierFinancementAction / transitionnerDossierAction.

/**
 * DossiersFinancementPanel — Pilotage des dossiers de financement (OPCO / FT /
 * CPF / mixte) depuis le Hub facturation.
 *
 * - Création d'un dossier libre (client + type + financeur + montant demandé
 *   + subrogation) → creerDossierFinancementAction.
 * - Transitions du cycle par dossier (a_monter → envoye → accord_recu →
 *   facture → paiement_recu → clos ; refus → refuse → clos) →
 *   transitionnerDossierAction. Le passage « Accord reçu » saisit le montant
 *   accordé. Le serveur valide chaque transition (machine à états testée).
 *
 * Rien d'automatique : chaque action = un clic admin. router.refresh() au succès.
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  creerDossierFinancementAction,
  transitionnerDossierAction,
} from "@/server/actions/qualiopi/facturation-hub";

type DossierStatut =
  | "a_monter"
  | "envoye"
  | "accord_recu"
  | "refuse"
  | "facture"
  | "paiement_recu"
  | "clos";
type DossierType = "opco" | "france_travail" | "cpf" | "mixte";

export interface DossierItem {
  id: string;
  type: string;
  statut: string;
  financeurNom: string | null;
  clientRaisonSociale: string | null;
  numeroDossierExterne: string | null;
  montantDemandeCents: number | null;
  montantAccordeCents: number | null;
  subrogation: boolean;
  nbPayeurs: number;
}

export interface ClientOption {
  id: string;
  numero: string;
  raisonSociale: string;
}

export interface DossiersFinancementPanelProps {
  dossiers: DossierItem[];
  clients: ClientOption[];
  /** Le rôle courant peut-il écrire (admin/super_admin) ? Sinon lecture seule. */
  canWrite: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  opco: "OPCO",
  france_travail: "France Travail",
  cpf: "CPF",
  mixte: "Mixte",
};

const STATUT_LABELS: Record<string, string> = {
  a_monter: "À monter",
  envoye: "Envoyé",
  accord_recu: "Accord reçu",
  refuse: "Refusé",
  facture: "Facturé",
  paiement_recu: "Paiement reçu",
  clos: "Clos",
};

/**
 * Transitions autorisées par statut. DOIT rester le MIROIR EXACT de
 * `DOSSIER_TRANSITIONS` (src/server/qualiopi/financements/dossier-financement.ts)
 * — non importable ici (module serveur/Prisma). Toute divergence produit des
 * boutons qui échouent côté serveur. Garder synchronisé.
 */
const NEXT_TRANSITIONS: Record<DossierStatut, DossierStatut[]> = {
  a_monter: ["envoye", "clos"],
  envoye: ["accord_recu", "refuse", "a_monter"],
  accord_recu: ["facture", "clos"],
  refuse: ["clos", "envoye"],
  facture: ["paiement_recu", "clos"],
  paiement_recu: ["clos"],
  clos: [],
};

const TYPE_OPTIONS: Array<{ value: DossierType; label: string }> = [
  { value: "opco", label: "OPCO" },
  { value: "france_travail", label: "France Travail" },
  { value: "cpf", label: "CPF" },
  { value: "mixte", label: "Mixte" },
];

function eur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function isDossierStatut(s: string): s is DossierStatut {
  return s in NEXT_TRANSITIONS;
}

export function DossiersFinancementPanel({
  dossiers,
  clients,
  canWrite,
}: DossiersFinancementPanelProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Création
  const [showCreate, setShowCreate] = useState(false);
  const [clientId, setClientId] = useState("");
  const [type, setType] = useState<DossierType>("opco");
  const [financeurNom, setFinanceurNom] = useState("");
  const [montantDemandeEur, setMontantDemandeEur] = useState("");
  const [subrogation, setSubrogation] = useState(false);

  // Saisie du montant accordé (dossier en cours de passage à accord_recu).
  const [accordFor, setAccordFor] = useState<string | null>(null);
  const [accordMontantEur, setAccordMontantEur] = useState("");

  function reset() {
    setError(null);
    setSuccess(null);
  }

  function handleCreate() {
    reset();
    if (!clientId) {
      setError("Sélectionnez un client.");
      return;
    }
    startTransition(async () => {
      const montantDemandeCents = Math.round((parseFloat(montantDemandeEur) || 0) * 100);
      const res = await creerDossierFinancementAction({
        clientId,
        type,
        ...(financeurNom.trim() !== "" ? { financeurNom: financeurNom.trim() } : {}),
        // Schéma serveur = int().positive() : n'envoyer que si strictement > 0.
        ...(montantDemandeCents > 0 ? { montantDemandeCents } : {}),
        ...(subrogation ? { subrogation: true } : {}),
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSuccess("Dossier de financement créé.");
      setShowCreate(false);
      setClientId("");
      setFinanceurNom("");
      setMontantDemandeEur("");
      setSubrogation(false);
      router.refresh();
    });
  }

  function doTransition(dossierId: string, vers: DossierStatut, montantAccordeCents?: number) {
    reset();
    startTransition(async () => {
      const res = await transitionnerDossierAction({
        dossierId,
        vers,
        ...(montantAccordeCents !== undefined ? { montantAccordeCents } : {}),
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSuccess(`Dossier → ${STATUT_LABELS[res.data.statut] ?? res.data.statut}.`);
      setAccordFor(null);
      setAccordMontantEur("");
      router.refresh();
    });
  }

  function handleTransitionClick(dossierId: string, vers: DossierStatut) {
    // Le passage à « accord reçu » propose de saisir le montant accordé
    // (facultatif : on peut acter l'accord avant d'en connaître le montant).
    if (vers === "accord_recu") {
      setAccordFor((cur) => (cur === dossierId ? null : dossierId));
      setAccordMontantEur("");
      return;
    }
    // « Clos » est terminal (aucune transition ne repart de clos) → confirmation.
    if (
      vers === "clos" &&
      !window.confirm("Clore définitivement ce dossier ? Action irréversible.")
    ) {
      return;
    }
    doTransition(dossierId, vers);
  }

  const labelCls =
    "block text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-[var(--space-admin-1)]";
  const inputCls =
    "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";

  return (
    <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]">
      <div className="mb-[var(--space-admin-3)] flex flex-wrap items-center justify-between gap-[var(--space-admin-3)]">
        <p className="text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
          Dossiers de financement en cours
        </p>
        {canWrite && (
          <button
            type="button"
            onClick={() => {
              reset();
              setShowCreate((v) => !v);
            }}
            disabled={isPending}
            aria-expanded={showCreate}
            className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-accent)] hover:underline"
          >
            {showCreate ? "Annuler" : "+ Nouveau dossier"}
          </button>
        )}
      </div>

      {/* Formulaire de création */}
      {showCreate && (
        <div className="mb-[var(--space-admin-4)] grid grid-cols-1 gap-[var(--space-admin-3)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)] sm:grid-cols-2">
          <div>
            <label htmlFor="dossier-client" className={labelCls}>
              Client
            </label>
            {clients.length === 0 ? (
              <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning)]">
                Aucun client CRM.
              </p>
            ) : (
              <select
                id="dossier-client"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                disabled={isPending}
                className={inputCls}
              >
                <option value="">— Sélectionner —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.numero} — {c.raisonSociale}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label htmlFor="dossier-type" className={labelCls}>
              Type
            </label>
            <select
              id="dossier-type"
              value={type}
              onChange={(e) => setType(e.target.value as DossierType)}
              disabled={isPending}
              className={inputCls}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="dossier-financeur" className={labelCls}>
              Financeur (optionnel)
            </label>
            <input
              id="dossier-financeur"
              type="text"
              value={financeurNom}
              onChange={(e) => setFinanceurNom(e.target.value)}
              disabled={isPending}
              maxLength={120}
              className={inputCls}
              placeholder="Ex. Atlas, Akto…"
            />
          </div>
          <div>
            <label htmlFor="dossier-montant" className={labelCls}>
              Montant demandé (€, optionnel)
            </label>
            <input
              id="dossier-montant"
              type="number"
              value={montantDemandeEur}
              onChange={(e) => setMontantDemandeEur(e.target.value)}
              disabled={isPending}
              min="0"
              step="0.01"
              className={inputCls}
            />
          </div>
          <label className="flex items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] sm:col-span-2">
            <input
              type="checkbox"
              checked={subrogation}
              onChange={(e) => setSubrogation(e.target.checked)}
              disabled={isPending}
            />
            Subrogation (le financeur paie directement Axion-IA)
          </label>
          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={isPending || clients.length === 0}
              className="admin-button"
            >
              {isPending ? "Création…" : "Créer le dossier"}
            </button>
          </div>
        </div>
      )}

      {/* Liste */}
      {dossiers.length === 0 ? (
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Aucun dossier en cours.
        </p>
      ) : (
        <ul className="space-y-[var(--space-admin-3)]">
          {dossiers.map((d) => {
            const nexts = isDossierStatut(d.statut) ? NEXT_TRANSITIONS[d.statut] : [];
            return (
              <li
                key={d.id}
                className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-3)]"
              >
                <div className="flex flex-wrap items-center gap-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
                  <span className="font-semibold">
                    {TYPE_LABELS[d.type] ?? d.type}
                    {d.subrogation ? " (subrogé)" : ""}
                  </span>
                  <span>{d.financeurNom ?? "Financeur à identifier"}</span>
                  <span className="text-[color:var(--color-admin-fg-muted)]">
                    {d.clientRaisonSociale ?? "—"}
                    {d.numeroDossierExterne ? ` · n° ${d.numeroDossierExterne}` : ""}
                    {` · ${d.nbPayeurs} payeur(s)`}
                  </span>
                  <span>
                    {d.montantAccordeCents !== null
                      ? `accordé ${eur(d.montantAccordeCents)}`
                      : d.montantDemandeCents !== null
                        ? `demandé ${eur(d.montantDemandeCents)}`
                        : ""}
                  </span>
                  <span className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-2)] text-[length:var(--text-admin-xs)]">
                    {STATUT_LABELS[d.statut] ?? d.statut}
                  </span>
                </div>

                {canWrite && nexts.length > 0 && (
                  <div className="mt-[var(--space-admin-2)] flex flex-wrap items-center gap-[var(--space-admin-2)]">
                    {nexts.map((vers) => (
                      <button
                        key={vers}
                        type="button"
                        onClick={() => handleTransitionClick(d.id, vers)}
                        disabled={isPending}
                        {...(vers === "accord_recu" ? { "aria-expanded": accordFor === d.id } : {})}
                        className={
                          vers === "refuse"
                            ? "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)] hover:underline"
                            : vers === "clos"
                              ? "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] hover:underline"
                              : "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] hover:underline"
                        }
                      >
                        → {STATUT_LABELS[vers]}
                      </button>
                    ))}
                  </div>
                )}

                {/* Saisie du montant accordé (facultatif) */}
                {canWrite && accordFor === d.id && (
                  <div className="mt-[var(--space-admin-2)] flex flex-wrap items-end gap-[var(--space-admin-2)]">
                    <div>
                      <label htmlFor={`accord-${d.id}`} className={labelCls}>
                        Montant accordé (€, facultatif)
                      </label>
                      <input
                        id={`accord-${d.id}`}
                        type="number"
                        value={accordMontantEur}
                        onChange={(e) => setAccordMontantEur(e.target.value)}
                        disabled={isPending}
                        min="0"
                        step="0.01"
                        className={inputCls}
                        placeholder="si connu"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        // Montant facultatif : on peut acter l'accord sans le
                        // connaître. S'il est saisi, il doit être positif.
                        const saisi = accordMontantEur.trim() !== "";
                        const cents = Math.round((parseFloat(accordMontantEur) || 0) * 100);
                        if (saisi && cents <= 0) {
                          setError("Montant accordé invalide.");
                          return;
                        }
                        doTransition(d.id, "accord_recu", saisi ? cents : undefined);
                      }}
                      disabled={isPending}
                      className="admin-button"
                    >
                      Confirmer l&apos;accord
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p
          role="alert"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {success && (
        <p
          role="status"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {success}
        </p>
      )}
    </div>
  );
}
