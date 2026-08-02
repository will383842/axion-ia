"use client";
// use-client: formulaire interactif avec état local (useState) + appel Server Action ajouterBpfDepenseAction + router.refresh().

/**
 * BpfDepenseForm — Formulaire d'ajout d'une dépense BPF.
 *
 * Permet de saisir une dépense (catégorie, libellé, montant HT)
 * pour une année donnée, puis appelle `ajouterBpfDepenseAction`.
 * Affiche les dépenses existantes avec possibilité de suppression.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ajouterBpfDepenseAction, supprimerBpfDepenseAction } from "@/server/actions/qualiopi/bpf";
import type { BpfDepenseItem } from "@/server/qualiopi/bpf/service";

interface BpfDepenseFormProps {
  annee: number;
  depenses: BpfDepenseItem[];
}

const CATEGORIES_BPF = [
  "Locations de salles",
  "Matériel pédagogique",
  "Honoraires sous-traitants",
  "Logiciels et licences",
  "Frais de déplacement formateurs",
  "Communication et marketing",
  "Frais administratifs",
  "Autre",
] as const;

export function BpfDepenseForm({ annee, depenses }: BpfDepenseFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [categorie, setCategorie] = useState<string>(CATEGORIES_BPF[0]);
  const [libelle, setLibelle] = useState("");
  const [montantEuros, setMontantEuros] = useState("");

  function handleAjouter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const montant = parseFloat(montantEuros.replace(",", "."));
    if (isNaN(montant) || montant <= 0) {
      setError("Montant invalide.");
      return;
    }
    const montantHtCents = Math.round(montant * 100);
    if (!libelle.trim()) {
      setError("Le libellé est obligatoire.");
      return;
    }

    startTransition(async () => {
      const result = await ajouterBpfDepenseAction({
        annee,
        categorie: categorie.trim(),
        libelle: libelle.trim(),
        montantHtCents,
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        setLibelle("");
        setMontantEuros("");
        router.refresh();
      }
    });
  }

  function handleSupprimer(id: string) {
    startTransition(async () => {
      const result = await supprimerBpfDepenseAction({ id });
      if ("error" in result) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  const labelCls =
    "block text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg-muted)] mb-[var(--space-admin-1)]";
  const inputCls =
    "w-full rounded border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-bg)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";

  return (
    <div className="mt-[var(--space-admin-6)]">
      <h3 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        Dépenses BPF — {annee}
      </h3>

      {/* Liste des dépenses existantes */}
      {depenses.length > 0 ? (
        <div className="mb-[var(--space-admin-5)] overflow-hidden rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]">
          <table className="w-full text-[length:var(--text-admin-sm)]">
            <thead>
              <tr className="border-b border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)]">
                <th className="px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-left font-medium text-[color:var(--color-admin-fg-muted)]">
                  Libellé
                </th>
                <th className="px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-left font-medium text-[color:var(--color-admin-fg-muted)]">
                  Catégorie
                </th>
                <th className="px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-right font-medium text-[color:var(--color-admin-fg-muted)]">
                  Montant HT
                </th>
                <th className="px-[var(--space-admin-3)] py-[var(--space-admin-2)]" />
              </tr>
            </thead>
            <tbody>
              {depenses.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-[color:var(--color-admin-border)] last:border-0"
                >
                  <td className="px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[color:var(--color-admin-fg)]">
                    {d.libelle}
                  </td>
                  <td className="px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[color:var(--color-admin-fg-muted)]">
                    {d.categorie}
                  </td>
                  <td className="px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-right text-[color:var(--color-admin-fg)]">
                    {new Intl.NumberFormat("fr-FR", {
                      style: "currency",
                      currency: "EUR",
                      maximumFractionDigits: 2,
                    }).format(d.montantHtCents / 100)}
                  </td>
                  <td className="px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-right">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleSupprimer(d.id)}
                      className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)] hover:underline disabled:opacity-50"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mb-[var(--space-admin-5)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Aucune dépense enregistrée pour {annee}.
        </p>
      )}

      {/* Formulaire d&apos;ajout */}
      <form
        onSubmit={handleAjouter}
        className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-4"
      >
        <div>
          <label htmlFor="bpf-categorie" className={labelCls}>
            Catégorie
          </label>
          <select
            id="bpf-categorie"
            value={categorie}
            onChange={(e) => setCategorie(e.target.value)}
            className={inputCls}
            required
          >
            {CATEGORIES_BPF.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="bpf-libelle" className={labelCls}>
            Libellé
          </label>
          <input
            id="bpf-libelle"
            type="text"
            value={libelle}
            onChange={(e) => setLibelle(e.target.value)}
            placeholder="Ex. Location salle Maison des entreprises"
            maxLength={250}
            required
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="bpf-montant" className={labelCls}>
            Montant HT (€)
          </label>
          <input
            id="bpf-montant"
            type="number"
            step="0.01"
            min="0.01"
            value={montantEuros}
            onChange={(e) => setMontantEuros(e.target.value)}
            placeholder="Ex. 350.00"
            required
            className={inputCls}
          />
        </div>

        <div className="flex items-end sm:col-span-4">
          <button type="submit" disabled={isPending} className="admin-button">
            {isPending ? "Ajout en cours…" : "Ajouter la dépense"}
          </button>
        </div>
      </form>

      {error && (
        <p
          role="alert"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
    </div>
  );
}
