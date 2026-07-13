"use client";
// use-client: formulaire interactif (création d'un moyen pédagogique) + useTransition pour la server action.

/**
 * MoyenForm — Formulaire de création d'un moyen pédagogique (off.17/18/19).
 *
 * "use client" : interactivité locale + appel Server Action.
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { creerMoyenAction } from "@/server/actions/qualiopi/moyens";

type MoyenCategorie = "salle" | "materiel" | "plateforme" | "humain";

const CATEGORIE_LABELS: Record<MoyenCategorie, string> = {
  salle: "Salle / locaux",
  materiel: "Matériel",
  plateforme: "Plateforme / outil numérique",
  humain: "Moyen humain",
};

const inputCls =
  "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-admin-accent)]";
const labelCls =
  "block text-[length:var(--text-admin-xs)] font-medium uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-1";
const fieldCls = "flex flex-col gap-1";

export interface MoyenFormProps {
  creerAction: typeof creerMoyenAction;
}

export function MoyenForm({ creerAction }: MoyenFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [categorie, setCategorie] = useState<MoyenCategorie>("salle");
  const [libelle, setLibelle] = useState("");
  const [description, setDescription] = useState("");
  const [localisation, setLocalisation] = useState("");
  const [dateVerification, setDateVerification] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const result = await creerAction({
        categorie,
        libelle,
        ...(description.trim() ? { description } : {}),
        ...(localisation.trim() ? { localisation } : {}),
        ...(dateVerification ? { dateVerification: new Date(dateVerification) } : {}),
      });

      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccessMsg("Moyen pédagogique enregistré.");
        setLibelle("");
        setDescription("");
        setLocalisation("");
        setDateVerification("");
        router.refresh();
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-6)]"
    >
      <h3 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        Nouveau moyen pédagogique
      </h3>

      <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
        {/* Catégorie */}
        <div className={fieldCls}>
          <label className={labelCls}>Catégorie</label>
          <select
            value={categorie}
            onChange={(e) => setCategorie(e.target.value as MoyenCategorie)}
            disabled={isPending}
            className={inputCls}
          >
            {(Object.keys(CATEGORIE_LABELS) as MoyenCategorie[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORIE_LABELS[c]}
              </option>
            ))}
          </select>
        </div>

        {/* Date de vérification */}
        <div className={fieldCls}>
          <label className={labelCls}>Vérifié le (facultatif)</label>
          <input
            type="date"
            value={dateVerification}
            onChange={(e) => setDateVerification(e.target.value)}
            disabled={isPending}
            className={inputCls}
          />
        </div>
      </div>

      {/* Libellé */}
      <div className={`mt-[var(--space-admin-4)] ${fieldCls}`}>
        <label className={labelCls}>Libellé</label>
        <input
          type="text"
          value={libelle}
          onChange={(e) => setLibelle(e.target.value)}
          disabled={isPending}
          required
          maxLength={300}
          placeholder="Ex. : Salle de formation Grenoble — 12 places"
          className={inputCls}
        />
      </div>

      {/* Description */}
      <div className={`mt-[var(--space-admin-4)] ${fieldCls}`}>
        <label className={labelCls}>Description (facultatif)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isPending}
          rows={2}
          placeholder="Capacité, équipement, licences, rôle…"
          className={inputCls}
        />
      </div>

      {/* Localisation */}
      <div className={`mt-[var(--space-admin-4)] ${fieldCls}`}>
        <label className={labelCls}>Localisation (facultatif)</label>
        <input
          type="text"
          value={localisation}
          onChange={(e) => setLocalisation(e.target.value)}
          disabled={isPending}
          maxLength={250}
          placeholder="Adresse, URL de la plateforme, site client…"
          className={inputCls}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          Erreur : {error}
        </p>
      )}
      {successMsg && (
        <p
          role="status"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {successMsg}
        </p>
      )}

      <button type="submit" disabled={isPending} className="admin-button mt-[var(--space-admin-4)]">
        {isPending ? "Enregistrement..." : "Enregistrer le moyen"}
      </button>
    </form>
  );
}
