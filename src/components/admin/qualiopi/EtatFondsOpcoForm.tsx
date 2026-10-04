"use client";
// use-client: formulaire interactif (nouveau relevé d'état des fonds OPCO) + useTransition pour la server action.

/**
 * EtatFondsOpcoForm — Ajout d'un relevé d'état des fonds OPCO (lot OPCO A5).
 *
 * Chaque envoi AJOUTE une ligne : le relevé le plus récent d'un couple
 * (OPCO, IDCC) fait foi. Rien ne se modifie ni ne se supprime.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ajouterReleveEtatFondsAction } from "@/server/actions/qualiopi/etat-fonds-opco";

const inputCls =
  "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-admin-accent)]";
const labelCls =
  "block text-[length:var(--text-admin-xs)] font-medium uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-1";
const fieldCls = "flex flex-col gap-1";

export interface EtatFondsOpcoFormProps {
  ajouterAction: typeof ajouterReleveEtatFondsAction;
  opcoOptions: Array<{ id: string; label: string }>;
  statutOptions: Array<{ id: string; label: string }>;
}

export function EtatFondsOpcoForm({
  ajouterAction,
  opcoOptions,
  statutOptions,
}: EtatFondsOpcoFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [opco, setOpco] = useState<string>(opcoOptions[0]?.id ?? "");
  const [idcc, setIdcc] = useState("");
  const [statut, setStatut] = useState<string>(statutOptions[0]?.id ?? "ouvert");
  const [perimetre, setPerimetre] = useState("");
  const [dateLimiteDepot, setDateLimiteDepot] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [releveLe, setReleveLe] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const result = await ajouterAction({
        opco,
        idcc: idcc.trim(),
        statut,
        perimetre: perimetre.trim(),
        dateLimiteDepot,
        sourceUrl: sourceUrl.trim(),
        releveLe,
        note: note.trim(),
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccessMsg("Relevé ajouté. Il fait désormais foi pour ce périmètre.");
        setIdcc("");
        setPerimetre("");
        setDateLimiteDepot("");
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
        Ajouter un relevé
      </h3>
      <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        Relevez l&apos;état des fonds sur le site de l&apos;OPCO, avec son adresse en https. Laissez
        l&apos;IDCC vide pour un relevé qui vaut pour tout l&apos;OPCO. Écrivez « moins de 50
        salariés » dans le périmètre si la mesure ne vise que ces entreprises.
      </p>

      <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-3">
        <div className={fieldCls}>
          <label htmlFor="etatfonds-opco" className={labelCls}>
            OPCO
          </label>
          <select
            id="etatfonds-opco"
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
        <div className={fieldCls}>
          <label htmlFor="etatfonds-idcc" className={labelCls}>
            IDCC (facultatif)
          </label>
          <input
            id="etatfonds-idcc"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            value={idcc}
            onChange={(e) => setIdcc(e.target.value)}
            disabled={isPending}
            placeholder="Ex. : 0573"
            className={inputCls}
          />
        </div>
        <div className={fieldCls}>
          <label htmlFor="etatfonds-statut" className={labelCls}>
            Statut
          </label>
          <select
            id="etatfonds-statut"
            value={statut}
            onChange={(e) => setStatut(e.target.value)}
            disabled={isPending}
            className={inputCls}
          >
            {statutOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className={fieldCls}>
          <label htmlFor="etatfonds-date-limite" className={labelCls}>
            Date limite de dépôt (facultatif)
          </label>
          <input
            id="etatfonds-date-limite"
            type="date"
            value={dateLimiteDepot}
            onChange={(e) => setDateLimiteDepot(e.target.value)}
            disabled={isPending}
            className={inputCls}
          />
        </div>
        <div className={fieldCls}>
          <label htmlFor="etatfonds-releve-le" className={labelCls}>
            Relevé le
          </label>
          <input
            id="etatfonds-releve-le"
            type="date"
            value={releveLe}
            onChange={(e) => setReleveLe(e.target.value)}
            disabled={isPending}
            required
            className={inputCls}
          />
        </div>
        <div className={fieldCls}>
          <label htmlFor="etatfonds-source" className={labelCls}>
            Source (https)
          </label>
          <input
            id="etatfonds-source"
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            disabled={isPending}
            required
            placeholder="https://…"
            className={inputCls}
          />
        </div>
      </div>

      <div className={`mt-[var(--space-admin-4)] ${fieldCls}`}>
        <label htmlFor="etatfonds-perimetre" className={labelCls}>
          Périmètre (facultatif)
        </label>
        <input
          id="etatfonds-perimetre"
          type="text"
          value={perimetre}
          onChange={(e) => setPerimetre(e.target.value)}
          disabled={isPending}
          maxLength={200}
          placeholder="Ex. : Commerces de gros — entreprises de moins de 50 salariés"
          className={inputCls}
        />
      </div>
      <div className={`mt-[var(--space-admin-4)] ${fieldCls}`}>
        <label htmlFor="etatfonds-note" className={labelCls}>
          Note (facultatif)
        </label>
        <textarea
          id="etatfonds-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={isPending}
          rows={2}
          maxLength={2000}
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
        {isPending ? "Enregistrement…" : "Ajouter ce relevé"}
      </button>
    </form>
  );
}
