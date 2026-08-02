"use client";
// use-client: formulaire interactif (nouvelle version de barème OPCO) + useTransition pour la server action.

/**
 * BaremeOpcoForm — Saisie d'une nouvelle version de barème OPCO (Lot 5).
 *
 * Les plafonds sont saisis en EUROS puis convertis en centimes avant l'appel de
 * la server action. Créer une version clôt automatiquement la précédente
 * (versionnement append-only côté serveur).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { creerVersionBaremeOpcoAction } from "@/server/actions/qualiopi/baremes-opco";

const inputCls =
  "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-admin-accent)]";
const labelCls =
  "block text-[length:var(--text-admin-xs)] font-medium uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-1";
const fieldCls = "flex flex-col gap-1";

/** € (chaîne UI) → centimes entiers, ou null si vide/invalide. */
function eurosToCents(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export interface BaremeOpcoFormProps {
  creerAction: typeof creerVersionBaremeOpcoAction;
  /** Options OPCO [{ id, label }] passées par le parent (module pur). */
  opcoOptions: Array<{ id: string; label: string }>;
}

export function BaremeOpcoForm({ creerAction, opcoOptions }: BaremeOpcoFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [opco, setOpco] = useState<string>(opcoOptions[0]?.id ?? "");
  const [dateEffet, setDateEffet] = useState(() => new Date().toISOString().slice(0, 10));
  const [releveLe, setReleveLe] = useState(() => new Date().toISOString().slice(0, 10));
  const [perimetre, setPerimetre] = useState("");
  const [intraHoraire, setIntraHoraire] = useState("");
  const [interPresentiel, setInterPresentiel] = useState("");
  const [interDistanciel, setInterDistanciel] = useState("");
  const [plafondFormation, setPlafondFormation] = useState("");
  const [plafondAnnuel, setPlafondAnnuel] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [note, setNote] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!opco) {
      setError("Sélectionnez un OPCO.");
      return;
    }
    if (!dateEffet) {
      setError("La date d'effet est requise.");
      return;
    }

    startTransition(async () => {
      const result = await creerAction({
        opco,
        dateEffet: new Date(dateEffet),
        ...(perimetre.trim() ? { perimetre: perimetre.trim() } : {}),
        intraHoraireCents: eurosToCents(intraHoraire),
        interPresentielCents: eurosToCents(interPresentiel),
        interDistancielCents: eurosToCents(interDistanciel),
        plafondFormationCents: eurosToCents(plafondFormation),
        plafondAnnuelCents: eurosToCents(plafondAnnuel),
        ...(sourceUrl.trim() ? { sourceUrl: sourceUrl.trim() } : {}),
        ...(releveLe ? { releveLe: new Date(releveLe) } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });

      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccessMsg("Nouvelle version de barème enregistrée (version précédente clôturée).");
        setPerimetre("");
        setIntraHoraire("");
        setInterPresentiel("");
        setInterDistanciel("");
        setPlafondFormation("");
        setPlafondAnnuel("");
        setSourceUrl("");
        setNote("");
        router.refresh();
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-6)]"
    >
      <h3 className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        Relever un barème OPCO
      </h3>
      <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        Saisissez les plafonds relevés sur le portail de l&apos;OPCO. Laissez un champ vide
        s&apos;il n&apos;est pas applicable. Enregistrer crée une nouvelle version et clôt la
        précédente — les dossiers déjà engagés conservent leur barème.
      </p>

      <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-3">
        {/* OPCO */}
        <div className={fieldCls}>
          <label htmlFor="baremeopcoform-opco" className={labelCls}>
            OPCO
          </label>
          <select
            id="baremeopcoform-opco"
            value={opco}
            onChange={(e) => setOpco(e.target.value)}
            disabled={isPending}
            className={inputCls}
          >
            {opcoOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Date d'effet */}
        <div className={fieldCls}>
          <label htmlFor="baremeopcoform-date-deffet" className={labelCls}>
            Date d&apos;effet
          </label>
          <input
            id="baremeopcoform-date-deffet"
            type="date"
            value={dateEffet}
            onChange={(e) => setDateEffet(e.target.value)}
            disabled={isPending}
            required
            className={inputCls}
          />
        </div>

        {/* Date de relevé */}
        <div className={fieldCls}>
          <label htmlFor="baremeopcoform-date-de-releve-portail" className={labelCls}>
            Date de relevé (portail)
          </label>
          <input
            id="baremeopcoform-date-de-releve-portail"
            type="date"
            value={releveLe}
            onChange={(e) => setReleveLe(e.target.value)}
            disabled={isPending}
            className={inputCls}
          />
        </div>
      </div>

      {/* Périmètre */}
      <div className={`mt-[var(--space-admin-4)] ${fieldCls}`}>
        <label htmlFor="baremeopcoform-perimetre-branche-idcc-dispositi" className={labelCls}>
          Périmètre (branche / IDCC / dispositif — facultatif)
        </label>
        <input
          id="baremeopcoform-perimetre-branche-idcc-dispositi"
          type="text"
          value={perimetre}
          onChange={(e) => setPerimetre(e.target.value)}
          disabled={isPending}
          maxLength={200}
          placeholder="Ex. : IDCC 1486 — Bureaux d'études, plan de développement des compétences"
          className={inputCls}
        />
      </div>

      {/* Plafonds (euros) */}
      <div className="mt-[var(--space-admin-4)] grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-3">
        <div className={fieldCls}>
          <label htmlFor="baremeopcoform-intra-h-participant" className={labelCls}>
            Intra (€/h/participant)
          </label>
          <input
            id="baremeopcoform-intra-h-participant"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={intraHoraire}
            onChange={(e) => setIntraHoraire(e.target.value)}
            disabled={isPending}
            className={inputCls}
          />
        </div>
        <div className={fieldCls}>
          <label htmlFor="baremeopcoform-inter-presentiel-h" className={labelCls}>
            Inter présentiel (€/h)
          </label>
          <input
            id="baremeopcoform-inter-presentiel-h"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={interPresentiel}
            onChange={(e) => setInterPresentiel(e.target.value)}
            disabled={isPending}
            className={inputCls}
          />
        </div>
        <div className={fieldCls}>
          <label htmlFor="baremeopcoform-inter-distanciel-h" className={labelCls}>
            Inter distanciel (€/h)
          </label>
          <input
            id="baremeopcoform-inter-distanciel-h"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={interDistanciel}
            onChange={(e) => setInterDistanciel(e.target.value)}
            disabled={isPending}
            className={inputCls}
          />
        </div>
        <div className={fieldCls}>
          <label htmlFor="baremeopcoform-plafond-formation" className={labelCls}>
            Plafond / formation (€)
          </label>
          <input
            id="baremeopcoform-plafond-formation"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={plafondFormation}
            onChange={(e) => setPlafondFormation(e.target.value)}
            disabled={isPending}
            className={inputCls}
          />
        </div>
        <div className={fieldCls}>
          <label htmlFor="baremeopcoform-plafond-annuel-salarie" className={labelCls}>
            Plafond annuel / salarié (€)
          </label>
          <input
            id="baremeopcoform-plafond-annuel-salarie"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={plafondAnnuel}
            onChange={(e) => setPlafondAnnuel(e.target.value)}
            disabled={isPending}
            className={inputCls}
          />
        </div>
        <div className={fieldCls}>
          <label htmlFor="baremeopcoform-url-source-portail-opco" className={labelCls}>
            URL source (portail OPCO)
          </label>
          <input
            id="baremeopcoform-url-source-portail-opco"
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            disabled={isPending}
            placeholder="https://…"
            className={inputCls}
          />
        </div>
      </div>

      {/* Note */}
      <div className={`mt-[var(--space-admin-4)] ${fieldCls}`}>
        <label htmlFor="baremeopcoform-note-facultatif" className={labelCls}>
          Note (facultatif)
        </label>
        <textarea
          id="baremeopcoform-note-facultatif"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={isPending}
          rows={2}
          placeholder="Contexte du relevé, conditions particulières…"
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
        {isPending ? "Enregistrement..." : "Enregistrer cette version"}
      </button>
    </form>
  );
}
