"use client";
// use-client: le jeton en clair n'existe que dans la réponse de l'action (montré une seule fois).

// Formulaire « Créer le jeton » / « Renouveler » de la page Enregistreur (PR 5).
// Le jeton n'est écrit nulle part : il s'affiche ici, une fois, pour être collé
// dans les options de l'extension. Recharger la page le fait disparaître.

import { useActionState } from "react";

import type { EtatJeton } from "@/features/admin-enregistreur/etat-jeton";

export interface JetonAppareilFormProps {
  readonly action: (etat: EtatJeton, form: FormData) => Promise<EtatJeton>;
  readonly libelle: string;
  /** Renouvellement : l'appareil à remplacer. */
  readonly appareilId?: string;
  /** Création : proposer de nommer le poste. */
  readonly avecNom?: boolean;
}

export function JetonAppareilForm({
  action,
  libelle,
  appareilId,
  avecNom = false,
}: JetonAppareilFormProps): React.ReactElement {
  const [etat, envoyer, enCours] = useActionState(action, { etat: "initial" } as EtatJeton);

  if (etat.etat === "cree") {
    return (
      <div className="space-y-[var(--space-admin-2)]" role="status">
        <p className="font-medium">
          Copiez ce jeton maintenant et collez-le dans les options de l&apos;extension. Il ne sera
          plus jamais affiché.
        </p>
        <input
          readOnly
          value={etat.jeton}
          aria-label="Jeton de l'appareil"
          onFocus={(e) => e.currentTarget.select()}
          className="w-full rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-2)] font-mono text-sm"
        />
        <p className="text-sm text-[color:var(--color-admin-fg-soft)]">
          Valable jusqu&apos;au {new Date(etat.expireLe).toLocaleDateString("fr-FR")}.
        </p>
      </div>
    );
  }

  return (
    <form action={envoyer} className="flex flex-wrap items-end gap-[var(--space-admin-2)]">
      {appareilId ? <input type="hidden" name="appareilId" value={appareilId} /> : null}
      {avecNom ? (
        <label className="flex flex-col text-sm">
          Nom du poste
          <input
            name="nom"
            defaultValue="Poste de Williams"
            maxLength={80}
            className="min-h-[44px] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border-strong)] px-[var(--space-admin-2)]"
          />
        </label>
      ) : null}
      <button type="submit" disabled={enCours} className="admin-button min-h-[44px]">
        {enCours ? "Patientez…" : libelle}
      </button>
      {etat.etat === "erreur" ? (
        <p role="alert" className="w-full text-sm text-[color:var(--color-admin-destructive-fg)]">
          {etat.message}
        </p>
      ) : null}
    </form>
  );
}
