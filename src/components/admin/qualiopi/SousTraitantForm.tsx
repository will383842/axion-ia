"use client";
// use-client: formulaire interactif (création sous-traitant + vérification data.gouv) + useTransition pour les server actions.

/**
 * SousTraitantForm — Formulaire de création d'un sous-traitant OF.
 * SousTraitantVerifButton — Bouton de marquage vérification data.gouv.fr.
 *
 * "use client" : interactivité locale + appel Server Actions.
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  creerSousTraitantAction,
  verifierSousTraitantOfAction,
} from "@/server/actions/qualiopi/sous-traitants";
import type { genererContratSousTraitanceAction } from "@/server/actions/qualiopi/documents";

const inputCls =
  "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-admin-accent)]";
const labelCls =
  "block text-[length:var(--text-admin-xs)] font-medium uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-1";
const fieldCls = "flex flex-col gap-1";

// ─────────────────────────────────────────────────────────────────────────────
// Formulaire création
// ─────────────────────────────────────────────────────────────────────────────

export interface SousTraitantFormProps {
  creerAction: typeof creerSousTraitantAction;
}

export function SousTraitantForm({ creerAction }: SousTraitantFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [nom, setNom] = useState("");
  const [siret, setSiret] = useState("");
  const [nda, setNda] = useState("");
  const [objetPrestation, setObjetPrestation] = useState("");
  const [contratSigneAt, setContratSigneAt] = useState("");
  const [actif, setActif] = useState(true);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const result = await creerAction({
        nom,
        ...(siret.trim() ? { siret } : {}),
        ...(nda.trim() ? { nda } : {}),
        objetPrestation,
        ...(contratSigneAt ? { contratSigneAt: new Date(contratSigneAt) } : {}),
        actif,
      });

      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccessMsg("Sous-traitant enregistré.");
        setNom("");
        setSiret("");
        setNda("");
        setObjetPrestation("");
        setContratSigneAt("");
        setActif(true);
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
        Nouveau sous-traitant
      </h3>

      <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
        {/* Nom */}
        <div className={fieldCls}>
          <label className={labelCls}>Nom de l&apos;organisme</label>
          <input
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            disabled={isPending}
            required
            maxLength={250}
            placeholder="Dénomination sociale"
            className={inputCls}
          />
        </div>

        {/* SIRET */}
        <div className={fieldCls}>
          <label className={labelCls}>SIRET (facultatif)</label>
          <input
            type="text"
            value={siret}
            onChange={(e) => setSiret(e.target.value)}
            disabled={isPending}
            maxLength={20}
            placeholder="14 chiffres"
            className={inputCls}
          />
        </div>

        {/* NDA */}
        <div className={fieldCls}>
          <label className={labelCls}>NDA (facultatif)</label>
          <input
            type="text"
            value={nda}
            onChange={(e) => setNda(e.target.value)}
            disabled={isPending}
            maxLength={20}
            placeholder="Numéro de déclaration d'activité"
            className={inputCls}
          />
        </div>

        {/* Date signature contrat */}
        <div className={fieldCls}>
          <label className={labelCls}>Contrat signé le (facultatif)</label>
          <input
            type="date"
            value={contratSigneAt}
            onChange={(e) => setContratSigneAt(e.target.value)}
            disabled={isPending}
            className={inputCls}
          />
        </div>
      </div>

      {/* Objet prestation */}
      <div className={`mt-[var(--space-admin-4)] ${fieldCls}`}>
        <label className={labelCls}>Objet de la prestation sous-traitée</label>
        <textarea
          value={objetPrestation}
          onChange={(e) => setObjetPrestation(e.target.value)}
          disabled={isPending}
          required
          rows={3}
          placeholder="Décrire la partie des formations sous-traitée…"
          className={inputCls}
        />
      </div>

      {/* Actif */}
      <div className="mt-[var(--space-admin-4)] flex items-center gap-[var(--space-admin-2)]">
        <input
          type="checkbox"
          id="sous-traitant-actif"
          checked={actif}
          onChange={(e) => setActif(e.target.checked)}
          disabled={isPending}
          className="h-4 w-4 accent-[color:var(--color-admin-accent)]"
        />
        <label
          htmlFor="sous-traitant-actif"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]"
        >
          Sous-traitant actif
        </label>
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
        {isPending ? "Enregistrement..." : "Enregistrer le sous-traitant"}
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bouton vérification data.gouv
// ─────────────────────────────────────────────────────────────────────────────

export interface SousTraitantVerifButtonProps {
  sousTraitantId: string;
  verifierAction: typeof verifierSousTraitantOfAction;
}

export function SousTraitantVerifButton({
  sousTraitantId,
  verifierAction,
}: SousTraitantVerifButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function handleVerif() {
    setError(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const result = await verifierAction({ id: sousTraitantId });
      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccessMsg(
          `Consultation attestée le ${result.data.verifieDataGouvAt.toLocaleDateString("fr-FR")}.`,
        );
        router.refresh();
      }
    });
  }

  return (
    <span className="inline-flex flex-col gap-1">
      {/* Libellé HONNÊTE : le système ne « vérifie » rien (aucun appel data.gouv.fr).
          Un administrateur ATTESTE avoir consulté la source — l'auteur est tracé
          dans ActivityLog. Ne jamais réintroduire « vérifié » ici : ce serait
          affirmer, dans une pièce d'audit, un contrôle qui n'a pas eu lieu. */}
      <button
        type="button"
        onClick={handleVerif}
        disabled={isPending}
        className="admin-button-secondary"
        title="Enregistre votre attestation de consultation de data.gouv.fr à la date du jour. Joignez une capture datée dans la fiche pour une preuve opposable."
      >
        {isPending ? "Enregistrement…" : "J'atteste avoir consulté data.gouv.fr"}
      </button>
      {error && (
        <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]">
          {error}
        </span>
      )}
      {successMsg && (
        <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-success)]">
          {successMsg}
        </span>
      )}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bouton génération contrat de sous-traitance (indicateur 27 — L.6316-3)
// ─────────────────────────────────────────────────────────────────────────────

export interface SousTraitantContratButtonProps {
  sousTraitantId: string;
  genererAction: typeof genererContratSousTraitanceAction;
}

export function SousTraitantContratButton({
  sousTraitantId,
  genererAction,
}: SousTraitantContratButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function handleGenerer() {
    setError(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const result = await genererAction({ sousTraitantId });
      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccessMsg(`Contrat n° ${result.data.numero} généré.`);
        router.refresh();
      }
    });
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={handleGenerer}
        disabled={isPending}
        className="admin-button-secondary"
      >
        {isPending ? "Génération…" : "Générer le contrat de sous-traitance"}
      </button>
      {error && (
        <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]">
          {error}
        </span>
      )}
      {successMsg && (
        <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-success)]">
          {successMsg}
        </span>
      )}
    </span>
  );
}
