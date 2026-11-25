"use client";

// Formulaire d'un BROUILLON de challenge (création ou modification). Les valeurs saisies sont
// renvoyées par l'action en cas d'erreur : un règlement long ne se perd jamais. Rien n'est publié
// ici ; la publication a son propre écran.

import { useActionState } from "react";

import { AdminFormField } from "@/components/admin/ui/AdminFormField";
import {
  enregistrerBrouillonAction,
  type EtatFormulaireChallenge,
} from "@/features/apporteurs-reseau/actions-challenges-console";

export interface ValeursChallenge {
  id?: string;
  titre: string;
  debutLe: string;
  finLe: string;
  paiementJusquAu: string;
  produit: string;
  critere: string;
  seuil: string;
  primeHt: string;
  reglement: string;
}

export function FormulaireChallenge({ initial }: { initial: ValeursChallenge }) {
  const [etat, action, enCours] = useActionState<EtatFormulaireChallenge, FormData>(
    enregistrerBrouillonAction,
    { etat: "initial" },
  );
  const v = (k: keyof ValeursChallenge): string =>
    etat.etat === "erreur" ? (etat.valeurs[k] ?? "") : (initial[k] ?? "");
  return (
    <form action={action} className="flex flex-col gap-[var(--space-admin-4)]">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      {etat.etat === "erreur" ? (
        <p role="alert" className="text-[color:var(--color-admin-danger)]">
          {etat.message}
        </p>
      ) : null}
      <AdminFormField
        label="Titre"
        name="titre"
        type="text"
        required
        defaultValue={v("titre")}
        hint="Le nom que l'apporteur lira. Il ne contient ni compte à rebours ni formule de pression."
      />
      <div className="grid gap-[var(--space-admin-4)] md:grid-cols-3">
        <AdminFormField
          label="Premier jour (heure de Paris)"
          name="debutLe"
          type="date"
          required
          defaultValue={v("debutLe")}
        />
        <AdminFormField
          label="Dernier jour (heure de Paris)"
          name="finLe"
          type="date"
          required
          defaultValue={v("finLe")}
        />
        <AdminFormField
          label="Dernier jour de paiement client"
          name="paiementJusquAu"
          type="date"
          defaultValue={v("paiementJusquAu")}
          hint="Facultatif. Écrit dans le règlement seulement."
        />
      </div>
      <div className="grid gap-[var(--space-admin-4)] md:grid-cols-4">
        <AdminFormField
          label="Produit"
          name="produit"
          type="select"
          required
          defaultValue={v("produit") || "journee-ia"}
          options={[{ value: "journee-ia", label: "Journée IA" }]}
        />
        <AdminFormField
          label="Condition"
          name="critere"
          type="select"
          required
          defaultValue={v("critere") || "facturees_dans_la_periode"}
          options={[{ value: "facturees_dans_la_periode", label: "Facturées dans la période" }]}
        />
        <AdminFormField
          label="Seuil (nombre)"
          name="seuil"
          type="number"
          required
          defaultValue={v("seuil")}
        />
        <AdminFormField
          label="Prime HT (€)"
          name="primeHt"
          type="text"
          required
          defaultValue={v("primeHt")}
        />
      </div>
      <AdminFormField
        label="Règlement"
        name="reglement"
        type="textarea"
        rows={14}
        required
        defaultValue={v("reglement")}
        hint="Texte publié tel quel. Il dit que rien n'est attendu de l'apporteur. Figé à la publication."
      />
      <div>
        <button type="submit" disabled={enCours} className="admin-button-primary">
          {enCours ? "Enregistrement…" : "Enregistrer le brouillon"}
        </button>
      </div>
    </form>
  );
}
