"use client";
// use-client: formulaire interactif avec état local (lignes dynamiques, selects, inputs numériques) + useTransition pour createDevisAction + router.push vers la page de détail.

/**
 * DevisForm — Création d&apos;un devis commercial formation.
 *
 * - Sélection du client (liste CRM).
 * - Lignes : designation / quantité / prixUnitaireHtCents / offreTierId optionnel.
 * - Financement suggéré + options OPCO si sélectionné.
 * - Mention TVA affichée en lecture seule (exonération 261-4-4° CGI).
 * - Date de validité auto (+30 j) — affiché en informatif.
 * - Appelle `createDevisAction` puis redirige vers `/[basePath]/[id]`.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDevisAction } from "@/server/actions/qualiopi/devis";

// ─────────────────────────────────────────────────────────────────────────────
// Types props
// ─────────────────────────────────────────────────────────────────────────────

export interface ClientOption {
  id: string;
  numero: string;
  raisonSociale: string;
}

export interface OffreOption {
  tierId: string;
  code: string;
  titreFr: string;
  prixLabelFr: string;
}

export interface DevisFormProps {
  clients: ClientOption[];
  offres: OffreOption[];
  /** Chemin base admin pour la redirection : /fr/admin-xxx/qualiopi/devis */
  basePath: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types internes
// ─────────────────────────────────────────────────────────────────────────────

interface Ligne {
  designation: string;
  quantite: string;
  prixUnitaireHtCents: string;
  offreTierId: string;
}

type FinancementSuggere = "direct" | "opco" | "cpf" | "france_travail" | "";
type ModaliteOpco = "intra" | "inter_presentiel" | "inter_distanciel" | "";

const FINANCEMENT_OPTIONS: Array<{ value: FinancementSuggere; label: string }> = [
  { value: "", label: "— Aucun —" },
  { value: "direct", label: "Direct (entreprise)" },
  { value: "opco", label: "OPCO" },
  { value: "cpf", label: "CPF / EDOF" },
  { value: "france_travail", label: "France Travail" },
];

const MODALITE_OPCO_OPTIONS: Array<{ value: ModaliteOpco; label: string }> = [
  { value: "", label: "— Choisir —" },
  { value: "intra", label: "Intra" },
  { value: "inter_presentiel", label: "Inter présentiel" },
  { value: "inter_distanciel", label: "Inter distanciel" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function emptyLigne(): Ligne {
  return { designation: "", quantite: "1", prixUnitaireHtCents: "0", offreTierId: "" };
}

function formatEur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function totalHtCents(lignes: Ligne[]): number {
  return lignes.reduce((acc, l) => {
    const q = parseFloat(l.quantite) || 0;
    const p = parseInt(l.prixUnitaireHtCents, 10) || 0;
    return acc + Math.round(q * p);
  }, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────────────────────

export function DevisForm({ clients, offres, basePath }: DevisFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [clientId, setClientId] = useState<string>("");
  const [lignes, setLignes] = useState<Ligne[]>([emptyLigne()]);
  const [financementSuggere, setFinancementSuggere] = useState<FinancementSuggere>("");
  const [nbParticipants, setNbParticipants] = useState<string>("");
  const [dureeHeures, setDureeHeures] = useState<string>("");
  const [modaliteOpco, setModaliteOpco] = useState<ModaliteOpco>("");
  const [enveloppeRestante, setEnveloppeRestante] = useState<string>("");

  const showOpco = financementSuggere === "opco";
  const total = totalHtCents(lignes);

  // ── Lignes helpers ──

  function updateLigne<K extends keyof Ligne>(idx: number, key: K, value: Ligne[K]) {
    setLignes((prev) => prev.map((l, i) => (i === idx ? { ...l, [key]: value } : l)));
  }

  function addLigne() {
    setLignes((prev) => [...prev, emptyLigne()]);
  }

  function removeLigne(idx: number) {
    setLignes((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── Soumission ──

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!clientId) {
      setError("Veuillez sélectionner un client.");
      return;
    }

    const parsedLignes = lignes.map((l) => ({
      designation: l.designation.trim(),
      quantite: parseFloat(l.quantite) || 0,
      prixUnitaireHtCents: parseInt(l.prixUnitaireHtCents, 10) || 0,
      ...(l.offreTierId !== "" ? { offreTierId: l.offreTierId } : {}),
    }));

    if (parsedLignes.some((l) => !l.designation || l.quantite <= 0)) {
      setError("Chaque ligne doit avoir une désignation et une quantité positive.");
      return;
    }

    startTransition(async () => {
      const result = await createDevisAction({
        clientId,
        lignes: parsedLignes,
        ...(financementSuggere !== "" ? { financementSuggere } : {}),
        ...(showOpco && nbParticipants !== ""
          ? { nbParticipants: parseInt(nbParticipants, 10) }
          : {}),
        ...(showOpco && dureeHeures !== "" ? { dureeHeures: parseFloat(dureeHeures) } : {}),
        ...(showOpco && modaliteOpco !== "" ? { modaliteOpco } : {}),
        ...(showOpco && enveloppeRestante !== ""
          ? { opcoEnveloppeRestanteCents: Math.round(parseFloat(enveloppeRestante) * 100) }
          : {}),
      });

      if ("error" in result) {
        setError(result.error);
      } else {
        router.push(`${basePath}/${result.data.id}`);
      }
    });
  }

  // ── CSS helpers ──

  const labelCls =
    "block text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-[var(--space-admin-1)]";
  const selectCls =
    "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";
  const inputCls =
    "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";
  const fieldCls = "flex flex-col gap-[var(--space-admin-1)]";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[var(--space-admin-6)]">
      {/* ── Client ── */}
      <section className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
        <h2 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
          Client
        </h2>
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="devis-client">
            Client <span className="text-[color:var(--color-admin-error)]">*</span>
          </label>
          {clients.length === 0 ? (
            <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning)]">
              Aucun client dans le CRM. Créez un client avant de créer un devis.
            </p>
          ) : (
            <select
              id="devis-client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={isPending}
              required
              className={selectCls}
            >
              <option value="">— Sélectionner un client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero} — {c.raisonSociale}
                </option>
              ))}
            </select>
          )}
        </div>
      </section>

      {/* ── Lignes ── */}
      <section className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
        <h2 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
          Lignes du devis
        </h2>

        <div className="flex flex-col gap-[var(--space-admin-4)]">
          {lignes.map((ligne, idx) => (
            <div
              key={idx}
              className="grid grid-cols-1 gap-[var(--space-admin-3)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-4)] sm:grid-cols-12"
            >
              {/* Désignation */}
              <div className="sm:col-span-5">
                <label className={labelCls} htmlFor={`ligne-${idx}-designation`}>
                  Désignation <span className="text-[color:var(--color-admin-error)]">*</span>
                </label>
                <input
                  id={`ligne-${idx}-designation`}
                  type="text"
                  value={ligne.designation}
                  onChange={(e) => updateLigne(idx, "designation", e.target.value)}
                  disabled={isPending}
                  required
                  maxLength={500}
                  placeholder="Ex. Formation IA appliquée"
                  className={inputCls}
                />
              </div>

              {/* Offre catalogue (optionnel) */}
              <div className="sm:col-span-3">
                <label className={labelCls} htmlFor={`ligne-${idx}-offre`}>
                  Offre catalogue
                </label>
                <select
                  id={`ligne-${idx}-offre`}
                  value={ligne.offreTierId}
                  onChange={(e) => updateLigne(idx, "offreTierId", e.target.value)}
                  disabled={isPending}
                  className={selectCls}
                >
                  <option value="">— Aucune —</option>
                  {offres.map((o) => (
                    <option key={o.tierId} value={o.tierId}>
                      {o.code} — {o.titreFr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantité */}
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor={`ligne-${idx}-quantite`}>
                  Qté <span className="text-[color:var(--color-admin-error)]">*</span>
                </label>
                <input
                  id={`ligne-${idx}-quantite`}
                  type="number"
                  value={ligne.quantite}
                  onChange={(e) => updateLigne(idx, "quantite", e.target.value)}
                  disabled={isPending}
                  min="0.01"
                  step="0.01"
                  required
                  className={inputCls}
                />
              </div>

              {/* Prix unitaire HT en centimes */}
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor={`ligne-${idx}-prix`}>
                  PU HT (€) <span className="text-[color:var(--color-admin-error)]">*</span>
                </label>
                <input
                  id={`ligne-${idx}-prix`}
                  type="number"
                  value={
                    ligne.prixUnitaireHtCents !== ""
                      ? (parseInt(ligne.prixUnitaireHtCents, 10) / 100).toString()
                      : ""
                  }
                  onChange={(e) => {
                    const eurVal = parseFloat(e.target.value);
                    updateLigne(
                      idx,
                      "prixUnitaireHtCents",
                      isNaN(eurVal) ? "0" : Math.round(eurVal * 100).toString(),
                    );
                  }}
                  disabled={isPending}
                  min="0"
                  step="0.01"
                  required
                  className={inputCls}
                />
              </div>

              {/* Supprimer ligne */}
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

        <div className="mt-[var(--space-admin-4)] flex items-center justify-between">
          <button
            type="button"
            onClick={addLigne}
            disabled={isPending}
            className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-accent)] hover:underline"
          >
            + Ajouter une ligne
          </button>
          <p className="text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg)]">
            Total HT : <span className="tabular-nums">{formatEur(total)}</span>
          </p>
        </div>
      </section>

      {/* ── Financement ── */}
      <section className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
        <h2 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
          Financement
        </h2>

        <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
          <div className={fieldCls}>
            <label className={labelCls} htmlFor="devis-financement">
              Financement suggéré
            </label>
            <select
              id="devis-financement"
              value={financementSuggere}
              onChange={(e) => setFinancementSuggere(e.target.value as FinancementSuggere)}
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

          {/* OPCO — champs complémentaires */}
          {showOpco && (
            <>
              <div className={fieldCls}>
                <label className={labelCls} htmlFor="devis-opco-modalite">
                  Modalité OPCO
                </label>
                <select
                  id="devis-opco-modalite"
                  value={modaliteOpco}
                  onChange={(e) => setModaliteOpco(e.target.value as ModaliteOpco)}
                  disabled={isPending}
                  className={selectCls}
                >
                  {MODALITE_OPCO_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={fieldCls}>
                <label className={labelCls} htmlFor="devis-opco-participants">
                  Nb. participants
                </label>
                <input
                  id="devis-opco-participants"
                  type="number"
                  value={nbParticipants}
                  onChange={(e) => setNbParticipants(e.target.value)}
                  disabled={isPending}
                  min="1"
                  step="1"
                  placeholder="Ex. 8"
                  className={inputCls}
                />
              </div>

              <div className={fieldCls}>
                <label className={labelCls} htmlFor="devis-opco-duree">
                  Durée (heures)
                </label>
                <input
                  id="devis-opco-duree"
                  type="number"
                  value={dureeHeures}
                  onChange={(e) => setDureeHeures(e.target.value)}
                  disabled={isPending}
                  min="0.5"
                  step="0.5"
                  placeholder="Ex. 14"
                  className={inputCls}
                />
              </div>

              <div className={fieldCls}>
                <label className={labelCls} htmlFor="devis-opco-enveloppe">
                  Enveloppe OPCO restante (€, optionnel)
                </label>
                <input
                  id="devis-opco-enveloppe"
                  type="number"
                  value={enveloppeRestante}
                  onChange={(e) => setEnveloppeRestante(e.target.value)}
                  disabled={isPending}
                  min="0"
                  step="0.01"
                  placeholder="Défaut : plafond annuel Atlas"
                  className={inputCls}
                />
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── Mention TVA ── */}
      <section className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)]">
        <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          <span className="font-semibold tracking-wide uppercase">Mention TVA</span> — Formation
          professionnelle exonérée de TVA en application de l&apos;article 261-4-4° du CGI. La date
          de validité sera fixée automatiquement à 30 jours à compter de la création du devis.
        </p>
      </section>

      {/* ── Erreur + Soumettre ── */}
      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-[var(--space-admin-3)]">
        <button type="submit" disabled={isPending || clients.length === 0} className="admin-button">
          {isPending ? "Création…" : "Créer le devis"}
        </button>
      </div>
    </form>
  );
}
