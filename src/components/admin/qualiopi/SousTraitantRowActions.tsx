"use client";
// use-client: édition inline d'un sous-traitant via useTransition + Server Action.

/**
 * SousTraitantRowActions — correction d'une ligne du registre des sous-traitants.
 *
 * 🔴 Ce panneau existe parce que `nda`, `contratSigneAt` et `actif` n'étaient
 * saisissables qu'À LA CRÉATION. `updateSousTraitant()` était écrite au service
 * depuis T12 et n'avait AUCUN appelant hors de sa propre spec : un organisme
 * créé avant la signature de son contrat ne pouvait plus jamais être complété,
 * et une ligne créée par erreur ne pouvait pas être archivée. Les deux premiers
 * champs conditionnent le numérateur de l'indicateur 27 — un SUPER-indicateur,
 * donc une seule ligne incomplète refuse la certification.
 *
 * 🔑 Le défaut ne se voyait pas sur le jeu de démonstration : le semis remplit
 * ces colonnes directement, et la matrice affichait « Couvert ». Il ne se serait
 * vu qu'en production, à la première correction.
 *
 * Forme reprise de `PartenariatRowActions` — l'autre registre de ce même dossier,
 * dont la chaîne service → action → panneau était, elle, complète.
 *
 * "use client" : useState/useTransition + appel Server Action.
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { updateSousTraitantAction } from "@/server/actions/qualiopi/sous-traitants";

const inputCls =
  "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-admin-accent)]";
const labelCls =
  "block text-[length:var(--text-admin-xs)] font-medium uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-1";

/** `Date` → `yyyy-mm-dd` pour un `<input type="date">`, chaîne vide si absente. */
function versChampDate(d: Date | null): string {
  return d === null ? "" : d.toISOString().slice(0, 10);
}

export interface SousTraitantRowActionsProps {
  sousTraitant: {
    id: string;
    nom: string;
    siret: string | null;
    nda: string | null;
    objetPrestation: string;
    contactNom: string | null;
    contactEmail: string | null;
    contactFonction: string | null;
    contratSigneAt: Date | null;
    actif: boolean;
  };
  updateAction: typeof updateSousTraitantAction;
}

export function SousTraitantRowActions({
  sousTraitant,
  updateAction,
}: SousTraitantRowActionsProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nom, setNom] = useState(sousTraitant.nom);
  const [siret, setSiret] = useState(sousTraitant.siret ?? "");
  const [nda, setNda] = useState(sousTraitant.nda ?? "");
  const [objetPrestation, setObjetPrestation] = useState(sousTraitant.objetPrestation);
  const [contactNom, setContactNom] = useState(sousTraitant.contactNom ?? "");
  const [contactEmail, setContactEmail] = useState(sousTraitant.contactEmail ?? "");
  const [contactFonction, setContactFonction] = useState(sousTraitant.contactFonction ?? "");
  const [contratSigneAt, setContratSigneAt] = useState(versChampDate(sousTraitant.contratSigneAt));
  const [actif, setActif] = useState(sousTraitant.actif);

  const id = sousTraitant.id;

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      // Champ vidé → `null` (valeur retirée), jamais `""` : le schéma refuse la
      // chaîne vide sur l'e-mail, et `""` en base ne serait pas « pas de
      // valeur » — les lecteurs testent `null`.
      const result = await updateAction({
        id,
        nom,
        siret: siret.trim() || null,
        nda: nda.trim() || null,
        objetPrestation,
        contactNom: contactNom.trim() || null,
        contactEmail: contactEmail.trim() || null,
        contactFonction: contactFonction.trim() || null,
        contratSigneAt: contratSigneAt ? new Date(contratSigneAt) : null,
        actif,
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-fg-muted)] transition-opacity hover:opacity-80"
      >
        Modifier
      </button>
    );
  }

  return (
    <form
      onSubmit={handleUpdate}
      className="flex w-full max-w-md flex-col gap-[var(--space-admin-3)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)]"
    >
      <div>
        <label htmlFor={`st-${id}-nom`} className={labelCls}>
          Nom de l&apos;organisme
        </label>
        <input
          id={`st-${id}-nom`}
          type="text"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          disabled={isPending}
          required
          maxLength={250}
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-2 gap-[var(--space-admin-3)]">
        <div>
          <label htmlFor={`st-${id}-siret`} className={labelCls}>
            SIRET
          </label>
          <input
            id={`st-${id}-siret`}
            type="text"
            value={siret}
            onChange={(e) => setSiret(e.target.value)}
            disabled={isPending}
            inputMode="numeric"
            maxLength={17}
            placeholder="14 chiffres"
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor={`st-${id}-nda`} className={labelCls}>
            NDA
          </label>
          {/* Une des trois conditions de l'indicateur 27. Elle n'était
              saisissable qu'à la création : l'oublier était définitif. */}
          <input
            id={`st-${id}-nda`}
            type="text"
            value={nda}
            onChange={(e) => setNda(e.target.value)}
            disabled={isPending}
            maxLength={20}
            placeholder="Déclaration d'activité"
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label htmlFor={`st-${id}-objet`} className={labelCls}>
          Objet de la prestation sous-traitée
        </label>
        <textarea
          id={`st-${id}-objet`}
          value={objetPrestation}
          onChange={(e) => setObjetPrestation(e.target.value)}
          disabled={isPending}
          required
          rows={2}
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor={`st-${id}-contrat`} className={labelCls}>
          Contrat signé le
        </label>
        {/* Deuxième condition de l'indicateur 27. */}
        <input
          id={`st-${id}-contrat`}
          type="date"
          value={contratSigneAt}
          onChange={(e) => setContratSigneAt(e.target.value)}
          disabled={isPending}
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-2 gap-[var(--space-admin-3)]">
        <div>
          <label htmlFor={`st-${id}-contact-nom`} className={labelCls}>
            Contact signataire
          </label>
          <input
            id={`st-${id}-contact-nom`}
            type="text"
            value={contactNom}
            onChange={(e) => setContactNom(e.target.value)}
            disabled={isPending}
            maxLength={200}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor={`st-${id}-contact-fonction`} className={labelCls}>
            Fonction du contact
          </label>
          <input
            id={`st-${id}-contact-fonction`}
            type="text"
            value={contactFonction}
            onChange={(e) => setContactFonction(e.target.value)}
            disabled={isPending}
            maxLength={200}
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label htmlFor={`st-${id}-contact-email`} className={labelCls}>
          E-mail du contact signataire
        </label>
        <input
          id={`st-${id}-contact-email`}
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          disabled={isPending}
          maxLength={320}
          placeholder="adresse@prestataire.fr"
          className={inputCls}
        />
        <p className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          Sans elle, aucun lien de signature ne peut être émis pour le contrat de sous-traitance.
        </p>
      </div>

      <div className="flex items-center gap-[var(--space-admin-2)]">
        {/* 🔴 Sans cette case, une ligne créée par erreur restait au dénominateur
            de l'indicateur 27 pour toujours : rien ne pouvait l'archiver. */}
        <input
          type="checkbox"
          id={`st-${id}-actif`}
          checked={actif}
          onChange={(e) => setActif(e.target.checked)}
          disabled={isPending}
          className="h-4 w-4 accent-[color:var(--color-admin-accent)]"
        />
        <label
          htmlFor={`st-${id}-actif`}
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]"
        >
          Sous-traitant actif
        </label>
      </div>

      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}

      <div className="flex items-center gap-[var(--space-admin-2)]">
        <button type="submit" disabled={isPending} className="admin-button">
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={isPending}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] underline"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
