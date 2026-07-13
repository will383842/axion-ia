"use client";
// use-client: formulaire de facture directe (client + activité + lignes avec TVA/ligne) — état local + useTransition + genererFactureLibreAction puis router.push vers le détail.

/**
 * FactureLibreForm — Émission d'une facture DIRECTE (sans devis) du Hub.
 *
 * - Sélection du client (CRM), de l'activité (pilote le régime TVA), lignes
 *   libres (désignation / quantité / PU HT / taux TVA optionnel).
 * - Réf. commande + période de prestation optionnelles.
 * - Appelle `genererFactureLibreAction` puis redirige vers le détail de la
 *   facture. Un client secteur public déclenche l'alerte Chorus Pro (visible
 *   sur la fiche détail).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { genererFactureLibreAction } from "@/server/actions/qualiopi/facturation-hub";

export interface ClientOption {
  id: string;
  numero: string;
  raisonSociale: string;
}

export interface FactureLibreFormProps {
  clients: ClientOption[];
  /** Chemin base admin du Hub : /fr/admin-xxx/qualiopi/facturation */
  basePath: string;
}

type Activite = "formation" | "un_a_un" | "audit" | "implementation" | "site_web";

const ACTIVITE_OPTIONS: Array<{ value: Activite; label: string }> = [
  { value: "formation", label: "Formation" },
  { value: "un_a_un", label: "Accompagnement 1-to-1" },
  { value: "audit", label: "Audit" },
  { value: "implementation", label: "Implémentation" },
  { value: "site_web", label: "Site web augmenté" },
];

interface Ligne {
  designation: string;
  quantite: string;
  prixUnitaireHtEur: string;
  tauxTvaPercent: string;
}

function emptyLigne(): Ligne {
  return { designation: "", quantite: "1", prixUnitaireHtEur: "0", tauxTvaPercent: "" };
}

function formatEur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function ligneCents(l: Ligne): number {
  const q = parseFloat(l.quantite) || 0;
  const pu = Math.round((parseFloat(l.prixUnitaireHtEur) || 0) * 100);
  return Math.round(q * pu);
}

export function FactureLibreForm({ clients, basePath }: FactureLibreFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [clientId, setClientId] = useState<string>("");
  const [activite, setActivite] = useState<Activite>("formation");
  const [refClient, setRefClient] = useState<string>("");
  const [periodePrestation, setPeriodePrestation] = useState<string>("");
  const [lignes, setLignes] = useState<Ligne[]>([emptyLigne()]);

  const totalHt = lignes.reduce((acc, l) => acc + ligneCents(l), 0);

  function updateLigne<K extends keyof Ligne>(idx: number, key: K, value: Ligne[K]) {
    setLignes((prev) => prev.map((l, i) => (i === idx ? { ...l, [key]: value } : l)));
  }
  function addLigne() {
    setLignes((prev) => [...prev, emptyLigne()]);
  }
  function removeLigne(idx: number) {
    setLignes((prev) => prev.filter((_, i) => i !== idx));
  }

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
      const result = await genererFactureLibreAction({
        clientId,
        activite,
        lignes: parsedLignes,
        ...(refClient.trim() !== "" ? { refClient: refClient.trim() } : {}),
        ...(periodePrestation.trim() !== "" ? { periodePrestation: periodePrestation.trim() } : {}),
      });

      if ("error" in result) {
        setError(result.error);
      } else {
        router.push(`${basePath}/${result.data.factureId}`);
      }
    });
  }

  const labelCls =
    "block text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-[var(--space-admin-1)]";
  const inputCls =
    "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";
  const fieldCls = "flex flex-col gap-[var(--space-admin-1)]";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[var(--space-admin-6)]">
      {/* ── Client + activité ── */}
      <section className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
        <h2 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
          Client et activité
        </h2>
        <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
          <div className={fieldCls}>
            <label className={labelCls} htmlFor="fl-client">
              Client <span className="text-[color:var(--color-admin-error)]">*</span>
            </label>
            {clients.length === 0 ? (
              <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning)]">
                Aucun client dans le CRM. Créez un client avant d&apos;émettre une facture.
              </p>
            ) : (
              <select
                id="fl-client"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                disabled={isPending}
                required
                className={inputCls}
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

          <div className={fieldCls}>
            <label className={labelCls} htmlFor="fl-activite">
              Activité <span className="text-[color:var(--color-admin-error)]">*</span>
            </label>
            <select
              id="fl-activite"
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
            <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              L&apos;activité pilote le régime de TVA (formation / 1-to-1 exonérables 261-4-4°).
            </p>
          </div>

          <div className={fieldCls}>
            <label className={labelCls} htmlFor="fl-ref">
              Réf. commande (optionnel)
            </label>
            <input
              id="fl-ref"
              type="text"
              value={refClient}
              onChange={(e) => setRefClient(e.target.value)}
              disabled={isPending}
              maxLength={120}
              className={inputCls}
              placeholder="N° de bon de commande"
            />
          </div>

          <div className={fieldCls}>
            <label className={labelCls} htmlFor="fl-periode">
              Période de prestation (optionnel)
            </label>
            <input
              id="fl-periode"
              type="text"
              value={periodePrestation}
              onChange={(e) => setPeriodePrestation(e.target.value)}
              disabled={isPending}
              maxLength={200}
              className={inputCls}
              placeholder="Ex. Janvier 2026"
            />
          </div>
        </div>
      </section>

      {/* ── Lignes ── */}
      <section className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
        <h2 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
          Lignes de la facture
        </h2>
        <div className="flex flex-col gap-[var(--space-admin-4)]">
          {lignes.map((ligne, idx) => (
            <div
              key={idx}
              className="grid grid-cols-1 gap-[var(--space-admin-3)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-4)] sm:grid-cols-12"
            >
              <div className="sm:col-span-6">
                <label className={labelCls} htmlFor={`fl-ligne-${idx}-designation`}>
                  Désignation <span className="text-[color:var(--color-admin-error)]">*</span>
                </label>
                <input
                  id={`fl-ligne-${idx}-designation`}
                  type="text"
                  value={ligne.designation}
                  onChange={(e) => updateLigne(idx, "designation", e.target.value)}
                  disabled={isPending}
                  required
                  maxLength={500}
                  className={inputCls}
                  placeholder="Ex. Mission d'audit IA — phase 1"
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor={`fl-ligne-${idx}-quantite`}>
                  Qté <span className="text-[color:var(--color-admin-error)]">*</span>
                </label>
                <input
                  id={`fl-ligne-${idx}-quantite`}
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
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor={`fl-ligne-${idx}-prix`}>
                  PU HT (€) <span className="text-[color:var(--color-admin-error)]">*</span>
                </label>
                <input
                  id={`fl-ligne-${idx}-prix`}
                  type="number"
                  value={ligne.prixUnitaireHtEur}
                  onChange={(e) => updateLigne(idx, "prixUnitaireHtEur", e.target.value)}
                  disabled={isPending}
                  min="0"
                  step="0.01"
                  required
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor={`fl-ligne-${idx}-tva`}>
                  TVA % (optionnel)
                </label>
                <input
                  id={`fl-ligne-${idx}-tva`}
                  type="number"
                  value={ligne.tauxTvaPercent}
                  onChange={(e) => updateLigne(idx, "tauxTvaPercent", e.target.value)}
                  disabled={isPending}
                  min="0"
                  max="30"
                  step="0.1"
                  className={inputCls}
                  placeholder="défaut activité"
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
            Total HT : <span className="tabular-nums">{formatEur(totalHt)}</span>
          </p>
        </div>
      </section>

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
          {isPending ? "Émission…" : "Émettre la facture"}
        </button>
      </div>
    </form>
  );
}
