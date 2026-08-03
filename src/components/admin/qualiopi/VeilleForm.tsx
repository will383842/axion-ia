"use client";
// use-client: formulaire interactif (création + édition entrée de veille) + useTransition pour les server actions.

/**
 * VeilleForm — Formulaire de création d'une entrée de veille Qualiopi.
 *
 * "use client" : interactivité locale + appel Server Actions.
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { creerVeilleAction } from "@/server/actions/qualiopi/veille";
import { AdminBlocRepliable } from "@/components/admin/ui/AdminBlocRepliable";

type VeilleType = "legale" | "metiers" | "pedagogique" | "handicap";

const TYPE_LABELS: Record<VeilleType, string> = {
  legale: "Légale / réglementaire",
  metiers: "Emplois / métiers",
  pedagogique: "Pédagogique / technologique",
  handicap: "Handicap",
};

const inputCls =
  "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-admin-accent)]";
const labelCls =
  "block text-[length:var(--text-admin-xs)] font-medium uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-1";
const fieldCls = "flex flex-col gap-1";

export interface VeilleFormProps {
  creerAction: typeof creerVeilleAction;
}

export function VeilleForm({ creerAction }: VeilleFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [type, setType] = useState<VeilleType>("legale");
  const [source, setSource] = useState("");
  const [titre, setTitre] = useState("");
  const [contenu, setContenu] = useState("");
  const [dateVeille, setDateVeille] = useState(() => new Date().toISOString().slice(0, 10));
  const [impact, setImpact] = useState("");
  const [actionDecidee, setActionDecidee] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const result = await creerAction({
        type,
        source,
        titre,
        contenu,
        dateVeille: new Date(dateVeille),
        ...(impact.trim() ? { impact } : {}),
        ...(actionDecidee.trim() ? { actionDecidee } : {}),
      });

      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccessMsg("Entrée de veille enregistrée.");
        setSource("");
        setTitre("");
        setContenu("");
        setImpact("");
        setActionDecidee("");
        router.refresh();
      }
    });
  }

  return (
    // Replié par défaut (décision Will, 2026-08-03) : le registre s'ouvre sur
    // ce qui est ENREGISTRÉ, pas sur un formulaire vide. Cf. AdminBlocRepliable.
    <AdminBlocRepliable titre="+ Nouvelle entrée de veille">
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
          {/* Type */}
          <div className={fieldCls}>
            <label htmlFor="veilleform-type-de-veille" className={labelCls}>
              Type de veille
            </label>
            <select
              id="veilleform-type-de-veille"
              value={type}
              onChange={(e) => setType(e.target.value as VeilleType)}
              disabled={isPending}
              className={inputCls}
            >
              {(Object.keys(TYPE_LABELS) as VeilleType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div className={fieldCls}>
            <label htmlFor="veilleform-date-de-veille" className={labelCls}>
              Date de veille
            </label>
            <input
              id="veilleform-date-de-veille"
              type="date"
              value={dateVeille}
              onChange={(e) => setDateVeille(e.target.value)}
              disabled={isPending}
              required
              className={inputCls}
            />
          </div>
        </div>

        {/* Source */}
        <div className={`mt-[var(--space-admin-4)] ${fieldCls}`}>
          <label htmlFor="veilleform-source-publication-organisme" className={labelCls}>
            Source (publication, organisme…)
          </label>
          <input
            id="veilleform-source-publication-organisme"
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            disabled={isPending}
            required
            maxLength={300}
            placeholder="Ex. : Journal Officiel du 01/06/2026"
            className={inputCls}
          />
        </div>

        {/* Titre */}
        <div className={`mt-[var(--space-admin-4)] ${fieldCls}`}>
          <label htmlFor="veilleform-titre" className={labelCls}>
            Titre
          </label>
          <input
            id="veilleform-titre"
            type="text"
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            disabled={isPending}
            required
            maxLength={300}
            placeholder="Titre de la veille"
            className={inputCls}
          />
        </div>

        {/* Contenu */}
        <div className={`mt-[var(--space-admin-4)] ${fieldCls}`}>
          <label htmlFor="veilleform-contenu-synthese" className={labelCls}>
            Contenu / synthèse
          </label>
          <textarea
            id="veilleform-contenu-synthese"
            value={contenu}
            onChange={(e) => setContenu(e.target.value)}
            disabled={isPending}
            required
            rows={3}
            className={inputCls}
          />
        </div>

        {/* Impact */}
        <div className={`mt-[var(--space-admin-4)] ${fieldCls}`}>
          <label htmlFor="veilleform-impact-estime-facultatif" className={labelCls}>
            Impact estimé (facultatif)
          </label>
          <textarea
            id="veilleform-impact-estime-facultatif"
            value={impact}
            onChange={(e) => setImpact(e.target.value)}
            disabled={isPending}
            rows={2}
            placeholder="Quel impact sur l'OF ou les formations ?"
            className={inputCls}
          />
        </div>

        {/* Action décidée */}
        <div className={`mt-[var(--space-admin-4)] ${fieldCls}`}>
          <label className={labelCls}>
            Action décidée suite à la veille (preuve d&apos;exploitation)
          </label>
          <textarea
            aria-label="Mesure prise ou planifiée en réponse à cette veille"
            value={actionDecidee}
            onChange={(e) => setActionDecidee(e.target.value)}
            disabled={isPending}
            rows={2}
            placeholder="Mesure prise ou planifiée en réponse à cette veille…"
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

        <button
          type="submit"
          disabled={isPending}
          className="admin-button mt-[var(--space-admin-4)]"
        >
          {isPending ? "Enregistrement..." : "Enregistrer la veille"}
        </button>
      </form>
    </AdminBlocRepliable>
  );
}
