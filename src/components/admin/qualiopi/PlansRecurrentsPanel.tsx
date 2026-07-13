"use client";
// use-client: pilotage des plans de facturation récurrents (création + statut actif/pause/clos + émission des brouillons générés) — état local + useTransition + server actions.

/**
 * PlansRecurrentsPanel — Pilotage des plans de facturation récurrents.
 *
 * - Création d'un plan (client + activité + lignes + périodicité + 1re
 *   génération + bornes) → creerPlanRecurrentAction.
 * - Changement de statut par plan (actif / pause / clos, jamais de réouverture
 *   d'un plan clos) → changerStatutPlanAction.
 * - Émission des factures BROUILLON générées par le cron (fige numéro/TVA/PDF)
 *   → emettreFactureBrouillonAction.
 *
 * Rien d'automatique côté envoi : le cron ne fait que proposer des brouillons ;
 * l'émission reste un clic admin. router.refresh() au succès.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  creerPlanRecurrentAction,
  changerStatutPlanAction,
  emettreFactureBrouillonAction,
} from "@/server/actions/qualiopi/facturation-hub";

type Activite = "formation" | "un_a_un" | "audit" | "implementation" | "site_web";
type PlanStatut = "actif" | "pause" | "clos";

export interface PlanBrouillon {
  id: string;
  numero: string;
  montantTtcCents: number;
}

export interface PlanItem {
  id: string;
  clientRaisonSociale: string;
  activite: string;
  statut: string;
  periodiciteMois: number;
  prochaineGenerationAt: string; // ISO
  finAt: string | null; // ISO
  nbMaxFactures: number | null;
  nbFacturesGenerees: number;
  brouillons: PlanBrouillon[];
}

export interface ClientOption {
  id: string;
  numero: string;
  raisonSociale: string;
}

export interface PlansRecurrentsPanelProps {
  plans: PlanItem[];
  clients: ClientOption[];
  /** Le rôle courant peut-il écrire (admin/super_admin) ? Sinon lecture seule. */
  canWrite: boolean;
}

const ACTIVITE_OPTIONS: Array<{ value: Activite; label: string }> = [
  { value: "formation", label: "Formation" },
  { value: "un_a_un", label: "Accompagnement 1-to-1" },
  { value: "audit", label: "Audit" },
  { value: "implementation", label: "Implémentation" },
  { value: "site_web", label: "Site web augmenté" },
];

const ACTIVITE_LABELS: Record<string, string> = Object.fromEntries(
  ACTIVITE_OPTIONS.map((o) => [o.value, o.label]),
);

const STATUT_LABELS: Record<string, string> = {
  actif: "Actif",
  pause: "En pause",
  clos: "Clos",
};

interface Ligne {
  designation: string;
  quantite: string;
  prixUnitaireHtEur: string;
  tauxTvaPercent: string;
}

function emptyLigne(): Ligne {
  return { designation: "", quantite: "1", prixUnitaireHtEur: "0", tauxTvaPercent: "" };
}

function eur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function PlansRecurrentsPanel({
  plans,
  clients,
  canWrite,
}: PlansRecurrentsPanelProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [clientId, setClientId] = useState("");
  const [activite, setActivite] = useState<Activite>("formation");
  const [refClient, setRefClient] = useState("");
  const [periodiciteMois, setPeriodiciteMois] = useState("1");
  const [premiereGeneration, setPremiereGeneration] = useState("");
  const [finAt, setFinAt] = useState("");
  const [nbMaxFactures, setNbMaxFactures] = useState("");
  const [notes, setNotes] = useState("");
  const [lignes, setLignes] = useState<Ligne[]>([emptyLigne()]);

  function reset() {
    setError(null);
    setSuccess(null);
  }

  function updateLigne<K extends keyof Ligne>(idx: number, key: K, value: Ligne[K]) {
    setLignes((prev) => prev.map((l, i) => (i === idx ? { ...l, [key]: value } : l)));
  }
  function addLigne() {
    setLignes((prev) => [...prev, emptyLigne()]);
  }
  function removeLigne(idx: number) {
    setLignes((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleCreate() {
    reset();
    if (!clientId) {
      setError("Sélectionnez un client.");
      return;
    }
    if (premiereGeneration.trim() === "") {
      setError("Renseignez la date de première génération.");
      return;
    }
    const parsedLignes = lignes.map((l) => ({
      designation: l.designation.trim(),
      quantite: parseFloat(l.quantite) || 0,
      prixUnitaireHtCents: Math.round((parseFloat(l.prixUnitaireHtEur) || 0) * 100),
      ...(l.tauxTvaPercent.trim() !== ""
        ? { tauxTvaPercent: parseFloat(l.tauxTvaPercent) || 0 }
        : {}),
    }));
    if (parsedLignes.some((l) => !l.designation || l.quantite <= 0)) {
      setError("Chaque ligne doit avoir une désignation et une quantité positive.");
      return;
    }
    startTransition(async () => {
      const res = await creerPlanRecurrentAction({
        clientId,
        activite,
        lignes: parsedLignes,
        premiereGenerationAt: premiereGeneration,
        periodiciteMois: parseInt(periodiciteMois, 10) || 1,
        ...(refClient.trim() !== "" ? { refClient: refClient.trim() } : {}),
        ...(finAt.trim() !== "" ? { finAt } : {}),
        ...(nbMaxFactures.trim() !== "" ? { nbMaxFactures: parseInt(nbMaxFactures, 10) } : {}),
        ...(notes.trim() !== "" ? { notes: notes.trim() } : {}),
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSuccess("Plan récurrent créé.");
      setShowCreate(false);
      setClientId("");
      setRefClient("");
      setPremiereGeneration("");
      setFinAt("");
      setNbMaxFactures("");
      setNotes("");
      setLignes([emptyLigne()]);
      router.refresh();
    });
  }

  function changerStatut(planId: string, statut: PlanStatut) {
    reset();
    // Clore un plan est irréversible (pas de réouverture) → confirmation.
    if (
      statut === "clos" &&
      !window.confirm("Clore définitivement ce plan ? Il ne pourra pas être rouvert.")
    ) {
      return;
    }
    startTransition(async () => {
      const res = await changerStatutPlanAction({ planId, statut });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSuccess(`Plan → ${STATUT_LABELS[res.data.statut] ?? res.data.statut}.`);
      router.refresh();
    });
  }

  function emettre(factureId: string) {
    reset();
    startTransition(async () => {
      const res = await emettreFactureBrouillonAction({ factureId });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSuccess(`Facture ${res.data.numero} émise.`);
      router.refresh();
    });
  }

  const labelCls =
    "block text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-[var(--space-admin-1)]";
  const inputCls =
    "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";

  return (
    <div className="flex flex-col gap-[var(--space-admin-5)]">
      <div className="flex flex-wrap items-center justify-between gap-[var(--space-admin-3)]">
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Le cron génère des factures en BROUILLON à échéance ; l&apos;émission reste manuelle.
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
            className="admin-button"
          >
            {showCreate ? "Annuler" : "+ Nouveau plan"}
          </button>
        )}
      </div>

      {/* Formulaire de création */}
      {showCreate && (
        <section className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
          <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-3">
            <div>
              <label htmlFor="plan-client" className={labelCls}>
                Client
              </label>
              {clients.length === 0 ? (
                <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning)]">
                  Aucun client CRM.
                </p>
              ) : (
                <select
                  id="plan-client"
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
              <label htmlFor="plan-activite" className={labelCls}>
                Activité
              </label>
              <select
                id="plan-activite"
                value={activite}
                onChange={(e) => setActivite(e.target.value as Activite)}
                disabled={isPending}
                className={inputCls}
              >
                {ACTIVITE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="plan-ref" className={labelCls}>
                Réf. commande (optionnel)
              </label>
              <input
                id="plan-ref"
                type="text"
                value={refClient}
                onChange={(e) => setRefClient(e.target.value)}
                disabled={isPending}
                maxLength={120}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="plan-periodicite" className={labelCls}>
                Périodicité (mois)
              </label>
              <input
                id="plan-periodicite"
                type="number"
                value={periodiciteMois}
                onChange={(e) => setPeriodiciteMois(e.target.value)}
                disabled={isPending}
                min="1"
                max="12"
                step="1"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="plan-premiere" className={labelCls}>
                Première génération
              </label>
              <input
                id="plan-premiere"
                type="date"
                value={premiereGeneration}
                onChange={(e) => setPremiereGeneration(e.target.value)}
                disabled={isPending}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="plan-fin" className={labelCls}>
                Fin (optionnel)
              </label>
              <input
                id="plan-fin"
                type="date"
                value={finAt}
                onChange={(e) => setFinAt(e.target.value)}
                disabled={isPending}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="plan-nbmax" className={labelCls}>
                Nb. max de factures (optionnel)
              </label>
              <input
                id="plan-nbmax"
                type="number"
                value={nbMaxFactures}
                onChange={(e) => setNbMaxFactures(e.target.value)}
                disabled={isPending}
                min="1"
                max="120"
                step="1"
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="plan-notes" className={labelCls}>
                Notes (optionnel)
              </label>
              <input
                id="plan-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isPending}
                maxLength={2000}
                className={inputCls}
              />
            </div>
          </div>

          {/* Lignes */}
          <div className="mt-[var(--space-admin-4)] flex flex-col gap-[var(--space-admin-3)]">
            {lignes.map((ligne, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 gap-[var(--space-admin-3)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-3)] sm:grid-cols-12"
              >
                <div className="sm:col-span-6">
                  <label className={labelCls} htmlFor={`plan-ligne-${idx}-designation`}>
                    Désignation
                  </label>
                  <input
                    id={`plan-ligne-${idx}-designation`}
                    type="text"
                    value={ligne.designation}
                    onChange={(e) => updateLigne(idx, "designation", e.target.value)}
                    disabled={isPending}
                    maxLength={500}
                    className={inputCls}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls} htmlFor={`plan-ligne-${idx}-qte`}>
                    Qté
                  </label>
                  <input
                    id={`plan-ligne-${idx}-qte`}
                    type="number"
                    value={ligne.quantite}
                    onChange={(e) => updateLigne(idx, "quantite", e.target.value)}
                    disabled={isPending}
                    min="0.01"
                    step="0.01"
                    className={inputCls}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls} htmlFor={`plan-ligne-${idx}-prix`}>
                    PU HT (€)
                  </label>
                  <input
                    id={`plan-ligne-${idx}-prix`}
                    type="number"
                    value={ligne.prixUnitaireHtEur}
                    onChange={(e) => updateLigne(idx, "prixUnitaireHtEur", e.target.value)}
                    disabled={isPending}
                    min="0"
                    step="0.01"
                    className={inputCls}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls} htmlFor={`plan-ligne-${idx}-tva`}>
                    TVA %
                  </label>
                  <input
                    id={`plan-ligne-${idx}-tva`}
                    type="number"
                    value={ligne.tauxTvaPercent}
                    onChange={(e) => updateLigne(idx, "tauxTvaPercent", e.target.value)}
                    disabled={isPending}
                    min="0"
                    max="30"
                    step="0.1"
                    className={inputCls}
                    placeholder="défaut"
                  />
                </div>
                {lignes.length > 1 && (
                  <div className="flex items-end sm:col-span-12">
                    <button
                      type="button"
                      onClick={() => removeLigne(idx)}
                      disabled={isPending}
                      className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)] hover:underline"
                    >
                      Supprimer cette ligne
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-[var(--space-admin-3)] flex items-center gap-[var(--space-admin-4)]">
            <button
              type="button"
              onClick={addLigne}
              disabled={isPending}
              className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-accent)] hover:underline"
            >
              + Ajouter une ligne
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={isPending || clients.length === 0}
              className="admin-button"
            >
              {isPending ? "Création…" : "Créer le plan"}
            </button>
          </div>
        </section>
      )}

      {/* Liste des plans */}
      {plans.length === 0 ? (
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Aucun plan récurrent.
        </p>
      ) : (
        <ul className="space-y-[var(--space-admin-4)]">
          {plans.map((p) => (
            <li
              key={p.id}
              className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-4)]"
            >
              <div className="flex flex-wrap items-center gap-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
                <span className="font-semibold">{p.clientRaisonSociale}</span>
                <span>{ACTIVITE_LABELS[p.activite] ?? p.activite}</span>
                <span className="text-[color:var(--color-admin-fg-muted)]">
                  tous les {p.periodiciteMois} mois · prochaine {fmtDate(p.prochaineGenerationAt)}
                  {p.finAt ? ` · fin ${fmtDate(p.finAt)}` : ""}
                  {p.nbMaxFactures !== null ? ` · max ${p.nbMaxFactures}` : ""}
                  {` · ${p.nbFacturesGenerees} générée(s)`}
                </span>
                <span className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-2)] text-[length:var(--text-admin-xs)]">
                  {STATUT_LABELS[p.statut] ?? p.statut}
                </span>
              </div>

              {/* Statut */}
              {canWrite && p.statut !== "clos" && (
                <div className="mt-[var(--space-admin-2)] flex flex-wrap items-center gap-[var(--space-admin-3)]">
                  {p.statut !== "actif" && (
                    <button
                      type="button"
                      onClick={() => changerStatut(p.id, "actif")}
                      disabled={isPending}
                      className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] hover:underline"
                    >
                      Activer
                    </button>
                  )}
                  {p.statut !== "pause" && (
                    <button
                      type="button"
                      onClick={() => changerStatut(p.id, "pause")}
                      disabled={isPending}
                      className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] hover:underline"
                    >
                      Mettre en pause
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => changerStatut(p.id, "clos")}
                    disabled={isPending}
                    className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)] hover:underline"
                  >
                    Clore
                  </button>
                </div>
              )}

              {/* Brouillons à émettre */}
              {p.brouillons.length > 0 && (
                <div className="mt-[var(--space-admin-3)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-3)]">
                  <p className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
                    Brouillons à émettre
                  </p>
                  <ul className="space-y-[var(--space-admin-2)]">
                    {p.brouillons.map((b) => (
                      <li
                        key={b.id}
                        className="flex flex-wrap items-center gap-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]"
                      >
                        <span className="font-mono">{b.numero}</span>
                        <span className="tabular-nums">{eur(b.montantTtcCents)}</span>
                        {canWrite && (
                          <button
                            type="button"
                            onClick={() => emettre(b.id)}
                            disabled={isPending}
                            className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] hover:underline"
                          >
                            Émettre
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {success && (
        <p
          role="status"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {success}
        </p>
      )}
    </div>
  );
}
