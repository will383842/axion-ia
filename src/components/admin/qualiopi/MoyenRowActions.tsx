"use client";
// use-client: édition inline + toggle actif d'un moyen pédagogique via useTransition + Server Actions.

/**
 * MoyenRowActions — Édition / activation d'un moyen pédagogique (LOT 2).
 *
 * Bouton « Modifier » ouvre un panneau d'édition inline (mêmes champs que le
 * formulaire de création + date de vérification) → updateMoyenAction.
 * Bouton « Désactiver / Réactiver » → setMoyenActifAction (pas de suppression
 * physique : l'inventaire reste traçable pour l'audit).
 *
 * "use client" : useState/useTransition + appel Server Actions.
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { updateMoyenAction, setMoyenActifAction } from "@/server/actions/qualiopi/moyens";

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

export interface MoyenRowActionsProps {
  moyen: {
    id: string;
    categorie: string;
    libelle: string;
    description: string;
    localisation: string;
    actif: boolean;
    dateVerification: Date | null;
  };
  updateAction: typeof updateMoyenAction;
  setActifAction: typeof setMoyenActifAction;
}

export function MoyenRowActions({
  moyen,
  updateAction,
  setActifAction,
}: MoyenRowActionsProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [categorie, setCategorie] = useState<MoyenCategorie>(moyen.categorie as MoyenCategorie);
  const [libelle, setLibelle] = useState(moyen.libelle);
  const [description, setDescription] = useState(moyen.description);
  const [localisation, setLocalisation] = useState(moyen.localisation);
  const [dateVerification, setDateVerification] = useState(() =>
    moyen.dateVerification ? moyen.dateVerification.toISOString().slice(0, 10) : "",
  );

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateAction({
        id: moyen.id,
        categorie,
        libelle,
        description,
        localisation,
        dateVerification: dateVerification ? new Date(dateVerification) : null,
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  function handleToggleActif() {
    setError(null);
    startTransition(async () => {
      const result = await setActifAction({ id: moyen.id, actif: !moyen.actif });
      if ("error" in result) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-[var(--space-admin-2)]">
      <div className="flex flex-wrap gap-[var(--space-admin-2)]">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={isPending}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline disabled:opacity-50"
        >
          {open ? "Fermer" : "Modifier"}
        </button>
        <button
          type="button"
          onClick={handleToggleActif}
          disabled={isPending}
          className={`text-[length:var(--text-admin-xs)] underline-offset-2 hover:underline disabled:opacity-50 ${
            moyen.actif
              ? "text-[color:var(--color-admin-error)]"
              : "text-[color:var(--color-admin-success)]"
          }`}
        >
          {isPending ? "…" : moyen.actif ? "Désactiver" : "Réactiver"}
        </button>
      </div>

      {open && (
        <form
          onSubmit={handleUpdate}
          className="w-72 rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)]"
        >
          <div className="flex flex-col gap-[var(--space-admin-3)]">
            <div>
              <label htmlFor="moyenrowactions-categorie" className={labelCls}>
                Catégorie
              </label>
              <select
                id="moyenrowactions-categorie"
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
            <div>
              <label htmlFor="moyenrowactions-libelle" className={labelCls}>
                Libellé
              </label>
              <input
                id="moyenrowactions-libelle"
                type="text"
                value={libelle}
                onChange={(e) => setLibelle(e.target.value)}
                disabled={isPending}
                required
                maxLength={300}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="moyenrowactions-description" className={labelCls}>
                Description
              </label>
              <textarea
                id="moyenrowactions-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isPending}
                rows={2}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="moyenrowactions-localisation" className={labelCls}>
                Localisation
              </label>
              <input
                id="moyenrowactions-localisation"
                type="text"
                value={localisation}
                onChange={(e) => setLocalisation(e.target.value)}
                disabled={isPending}
                maxLength={250}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="moyenrowactions-verifie-le-vide-non-verifie" className={labelCls}>
                Vérifié le (vide = non vérifié)
              </label>
              <input
                id="moyenrowactions-verifie-le-vide-non-verifie"
                type="date"
                value={dateVerification}
                onChange={(e) => setDateVerification(e.target.value)}
                disabled={isPending}
                className={inputCls}
              />
            </div>
            <button type="submit" disabled={isPending} className="admin-button">
              {isPending ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          Erreur : {error}
        </p>
      )}
    </div>
  );
}
