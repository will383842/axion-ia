"use client";
// use-client: formulaire interactif (inputs/select + useTransition) pour créer/éditer un formateur.

/**
 * TrainerForm — création ou édition d'un formateur (R9).
 * mode="create" → createTrainerAction puis redirection vers la fiche.
 * mode="edit"   → updateTrainerAction puis router.refresh().
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTrainerAction, updateTrainerAction } from "@/server/actions/qualiopi/trainers";
import { REGIONS } from "@/content/regions";

type Statut = "salarie" | "sous_traitant";

export interface TrainerFormProps {
  mode: "create" | "edit";
  /** Base href admin (pour la redirection après création). */
  baseHref: string;
  trainerId?: string;
  initial?: {
    nom: string;
    prenom: string;
    email: string;
    telephone: string | null;
    statut: Statut;
    region: string | null;
    tarifJourneeHtCents: number | null;
    sousTraitantNda: string | null;
  };
}

export function TrainerForm({
  mode,
  baseHref,
  trainerId,
  initial,
}: TrainerFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [nom, setNom] = useState(initial?.nom ?? "");
  const [prenom, setPrenom] = useState(initial?.prenom ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [telephone, setTelephone] = useState(initial?.telephone ?? "");
  const [statut, setStatut] = useState<Statut>(initial?.statut ?? "salarie");
  const [region, setRegion] = useState(initial?.region ?? "");
  const [tarifEuros, setTarifEuros] = useState(
    initial?.tarifJourneeHtCents != null ? String(initial.tarifJourneeHtCents / 100) : "",
  );
  const [nda, setNda] = useState(initial?.sousTraitantNda ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const tarifCents = tarifEuros.trim() !== "" ? Math.round(Number(tarifEuros) * 100) : undefined;

    startTransition(async () => {
      if (mode === "create") {
        const result = await createTrainerAction({
          nom,
          prenom,
          email,
          statut,
          region,
          ...(telephone ? { telephone } : {}),
          ...(tarifCents !== undefined && !Number.isNaN(tarifCents)
            ? { tarifJourneeHtCents: tarifCents }
            : {}),
          ...(statut === "sous_traitant" && nda ? { sousTraitantNda: nda } : {}),
        });
        if ("error" in result) {
          setError(result.error);
        } else {
          router.push(`${baseHref}/${result.data.id}`);
        }
      } else {
        const result = await updateTrainerAction({
          id: trainerId as string,
          nom,
          prenom,
          email,
          statut,
          region,
          ...(telephone ? { telephone } : {}),
          ...(tarifCents !== undefined && !Number.isNaN(tarifCents)
            ? { tarifJourneeHtCents: tarifCents }
            : {}),
          ...(statut === "sous_traitant" && nda ? { sousTraitantNda: nda } : {}),
        });
        if ("error" in result) {
          setError(result.error);
        } else {
          setSuccessMsg("Formateur enregistré.");
          router.refresh();
        }
      }
    });
  }

  const labelCls =
    "block text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-[var(--space-admin-1)]";
  const inputCls =
    "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";
  const fieldCls = "flex flex-col gap-[var(--space-admin-1)]";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]"
    >
      <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="t-prenom">
            Prénom
          </label>
          <input
            id="t-prenom"
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            disabled={isPending}
            required
            maxLength={200}
            className={inputCls}
          />
        </div>
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="t-nom">
            Nom
          </label>
          <input
            id="t-nom"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            disabled={isPending}
            required
            maxLength={200}
            className={inputCls}
          />
        </div>
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="t-email">
            Email
          </label>
          <input
            id="t-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isPending}
            required
            className={inputCls}
          />
        </div>
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="t-tel">
            Téléphone
          </label>
          <input
            id="t-tel"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            disabled={isPending}
            maxLength={40}
            className={inputCls}
          />
        </div>
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="t-statut">
            Statut
          </label>
          <select
            id="t-statut"
            value={statut}
            onChange={(e) => setStatut(e.target.value as Statut)}
            disabled={isPending}
            className={inputCls}
          >
            <option value="salarie">Salarié</option>
            <option value="sous_traitant">Sous-traitant</option>
          </select>
        </div>
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="t-region">
            Région d&apos;intervention
          </label>
          <select
            id="t-region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            disabled={isPending}
            className={inputCls}
          >
            <option value="">— Non renseignée —</option>
            {REGIONS.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.nameFr}
              </option>
            ))}
          </select>
        </div>
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="t-tarif">
            Tarif journée HT (€)
          </label>
          <input
            id="t-tarif"
            type="number"
            min={0}
            step="0.01"
            value={tarifEuros}
            onChange={(e) => setTarifEuros(e.target.value)}
            disabled={isPending}
            className={inputCls}
          />
        </div>
        {statut === "sous_traitant" && (
          <div className={fieldCls}>
            <label className={labelCls} htmlFor="t-nda">
              N° NDA sous-traitant
            </label>
            <input
              id="t-nda"
              value={nda}
              onChange={(e) => setNda(e.target.value)}
              disabled={isPending}
              maxLength={20}
              placeholder="Ex. 84691234569"
              className={inputCls}
            />
          </div>
        )}
      </div>

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

      <div className="mt-[var(--space-admin-5)]">
        <button type="submit" disabled={isPending} className="admin-button">
          {isPending ? "Enregistrement…" : mode === "create" ? "Créer le formateur" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
