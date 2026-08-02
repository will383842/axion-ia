"use client";
// use-client: formulaire interactif (inputs/checkbox/textarea + useTransition) création/édition stagiaire.

/**
 * TraineeForm — création ou édition d'un stagiaire (R10).
 *
 * RGPD : le détail handicap est WRITE-ONLY (jamais pré-rempli ni affiché ;
 * il est chiffré côté serveur via encryptPii). Laisser vide = ne pas modifier.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTraineeAction, updateTraineeAction } from "@/server/actions/qualiopi/trainees";

export interface TraineeFormProps {
  mode: "create" | "edit";
  baseHref: string;
  traineeId?: string;
  initial?: {
    nom: string;
    prenom: string;
    email: string;
    telephone: string | null;
    entreprise: string | null;
    fonction: string | null;
    situationHandicap: boolean;
    consentementFormation: boolean;
    consentementEmail: boolean;
    /** Indique si un détail handicap chiffré est déjà présent (sans le révéler). */
    handicapDetailsPresent: boolean;
  };
}

export function TraineeForm({
  mode,
  baseHref,
  traineeId,
  initial,
}: TraineeFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [nom, setNom] = useState(initial?.nom ?? "");
  const [prenom, setPrenom] = useState(initial?.prenom ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [telephone, setTelephone] = useState(initial?.telephone ?? "");
  const [entreprise, setEntreprise] = useState(initial?.entreprise ?? "");
  const [fonction, setFonction] = useState(initial?.fonction ?? "");
  const [situationHandicap, setSituationHandicap] = useState(initial?.situationHandicap ?? false);
  const [handicapDetails, setHandicapDetails] = useState("");
  const [consentementFormation, setConsentementFormation] = useState(
    initial?.consentementFormation ?? false,
  );
  const [consentementEmail, setConsentementEmail] = useState(initial?.consentementEmail ?? false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const common = {
      nom,
      prenom,
      email,
      situationHandicap,
      consentementFormation,
      consentementEmail,
      ...(telephone ? { telephone } : {}),
      ...(entreprise ? { entreprise } : {}),
      ...(fonction ? { fonction } : {}),
      ...(handicapDetails.trim() ? { handicapDetails } : {}),
    };

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createTraineeAction(common)
          : await updateTraineeAction({ id: traineeId as string, ...common });
      if ("error" in result) {
        setError(result.error);
      } else if (mode === "create") {
        router.push(`${baseHref}/${result.data.id}`);
      } else {
        setSuccessMsg("Stagiaire enregistré.");
        setHandicapDetails("");
        router.refresh();
      }
    });
  }

  const labelCls =
    "block text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-[var(--space-admin-1)]";
  const inputCls =
    "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";
  const fieldCls = "flex flex-col gap-[var(--space-admin-1)]";
  const checkCls =
    "flex cursor-pointer items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]"
    >
      <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="s-prenom">
            Prénom
          </label>
          <input
            id="s-prenom"
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            disabled={isPending}
            required
            maxLength={200}
            className={inputCls}
          />
        </div>
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="s-nom">
            Nom
          </label>
          <input
            id="s-nom"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            disabled={isPending}
            required
            maxLength={200}
            className={inputCls}
          />
        </div>
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="s-email">
            Email
          </label>
          <input
            id="s-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isPending}
            required
            className={inputCls}
          />
        </div>
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="s-tel">
            Téléphone
          </label>
          <input
            id="s-tel"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            disabled={isPending}
            maxLength={40}
            className={inputCls}
          />
        </div>
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="s-entreprise">
            Entreprise
          </label>
          <input
            id="s-entreprise"
            value={entreprise}
            onChange={(e) => setEntreprise(e.target.value)}
            disabled={isPending}
            maxLength={250}
            className={inputCls}
          />
        </div>
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="s-fonction">
            Fonction
          </label>
          <input
            id="s-fonction"
            value={fonction}
            onChange={(e) => setFonction(e.target.value)}
            disabled={isPending}
            maxLength={200}
            className={inputCls}
          />
        </div>
      </div>

      {/* Handicap (PII chiffré) */}
      <div className="mt-[var(--space-admin-5)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]">
        <label className={checkCls}>
          <input
            type="checkbox"
            checked={situationHandicap}
            onChange={(e) => setSituationHandicap(e.target.checked)}
            disabled={isPending}
            className="h-4 w-4 accent-[color:var(--color-admin-accent)]"
          />
          Situation de handicap déclarée
        </label>
        <div className="mt-[var(--space-admin-3)]">
          <label className={labelCls} htmlFor="s-handicap">
            Détail / besoins d&apos;adaptation (chiffré — write-only)
          </label>
          <textarea
            id="s-handicap"
            value={handicapDetails}
            onChange={(e) => setHandicapDetails(e.target.value)}
            disabled={isPending}
            rows={3}
            maxLength={2000}
            placeholder={
              initial?.handicapDetailsPresent
                ? "Un détail chiffré existe déjà. Saisir ici pour le REMPLACER (laisser vide = inchangé)."
                : "Saisir le besoin d'adaptation. Stocké chiffré (AES-256-GCM), jamais en clair."
            }
            className={inputCls}
          />
          <p className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            RGPD : non affiché en clair (lecture réservée au référent handicap).
          </p>
        </div>
      </div>

      {/* Consentements */}
      <div className="mt-[var(--space-admin-4)] flex flex-col gap-[var(--space-admin-2)]">
        <label className={checkCls}>
          <input
            type="checkbox"
            checked={consentementFormation}
            onChange={(e) => setConsentementFormation(e.target.checked)}
            disabled={isPending}
            className="h-4 w-4 accent-[color:var(--color-admin-accent)]"
          />
          Consentement traitement des données (formation)
        </label>
        <label className={checkCls}>
          <input
            type="checkbox"
            checked={consentementEmail}
            onChange={(e) => setConsentementEmail(e.target.checked)}
            disabled={isPending}
            className="h-4 w-4 accent-[color:var(--color-admin-accent)]"
          />
          Consentement communications email (suivi, non contractuel)
        </label>
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
          {isPending ? "Enregistrement…" : mode === "create" ? "Créer le stagiaire" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
