"use client";
// use-client: useActionState — garder la saisie d'un incident quand le serveur la refuse.

// Conformité RGPD — le formulaire court d'un incident (déclaration et fiche).
// Composé des classes de la console seulement ; aucune couleur propre.

import { useActionState } from "react";

import { AdminSubmitButton } from "@/components/admin/ui/AdminSubmitButton";
import {
  formulaireIncidentAction,
  type EtatFormulaireIncident,
} from "@/features/conformite-rgpd/actions-incidents";

interface Props {
  /** Valeurs de départ (fiche existante), déjà au format des champs. */
  initial?: Readonly<Record<string, string>>;
  incidentId?: string;
  numero?: number;
  libelle: string;
}

function Champ({
  nom,
  libelle,
  aide,
  valeur,
  type = "texte",
  requis = false,
}: {
  nom: string;
  libelle: string;
  aide?: string;
  valeur: string | undefined;
  type?: "texte" | "long" | "date" | "nombre";
  requis?: boolean;
}) {
  const id = `incident-${nom}`;
  return (
    <div className="admin-field flex flex-col gap-[var(--space-admin-1)]">
      <label htmlFor={id} className="admin-label">
        {libelle}
        {requis ? " *" : ""}
      </label>
      {type === "long" ? (
        <textarea
          id={id}
          name={nom}
          rows={3}
          maxLength={5000}
          required={requis}
          defaultValue={valeur}
          className="admin-textarea"
        />
      ) : (
        <input
          id={id}
          name={nom}
          type={type === "date" ? "datetime-local" : type === "nombre" ? "number" : "text"}
          min={type === "nombre" ? 0 : undefined}
          maxLength={type === "texte" ? 5000 : undefined}
          required={requis}
          defaultValue={valeur}
          className="admin-input"
        />
      )}
      {aide ? <p className="admin-help">{aide}</p> : null}
    </div>
  );
}

function OuiNon({
  nom,
  libelle,
  valeur,
}: {
  nom: string;
  libelle: string;
  valeur: string | undefined;
}) {
  return (
    <div className="admin-field flex flex-col gap-[var(--space-admin-1)]">
      <label htmlFor={`incident-${nom}`} className="admin-label">
        {libelle}
      </label>
      <select
        id={`incident-${nom}`}
        name={nom}
        defaultValue={valeur ?? ""}
        className="admin-select"
      >
        <option value="">Pas encore décidé</option>
        <option value="oui">Oui</option>
        <option value="non">Non</option>
      </select>
    </div>
  );
}

export function FormulaireIncident({ initial = {}, incidentId, numero, libelle }: Props) {
  const [etat, action] = useActionState<EtatFormulaireIncident, FormData>(
    formulaireIncidentAction,
    { erreur: null, valeurs: {}, essai: 0 },
  );
  const v = etat.erreur ? etat.valeurs : initial;

  return (
    <form
      key={etat.essai}
      action={action}
      className="flex flex-col gap-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]"
    >
      {etat.erreur ? (
        <p role="alert" className="admin-alert admin-alert-error">
          {etat.erreur}
        </p>
      ) : null}
      {incidentId ? <input type="hidden" name="incidentId" value={incidentId} /> : null}
      {numero ? <input type="hidden" name="numero" value={numero} /> : null}

      <div className="grid grid-cols-1 gap-[var(--space-admin-4)] md:grid-cols-2">
        <Champ
          nom="decouvertLe"
          libelle="Découvert le"
          aide="Les 72 h partent de là."
          type="date"
          requis
          valeur={v.decouvertLe}
        />
        <Champ
          nom="survenuLe"
          libelle="Survenu le"
          aide="Si vous le savez."
          type="date"
          valeur={v.survenuLe}
        />
      </div>
      <Champ
        nom="description"
        libelle="Ce qui s'est passé"
        aide="En quelques mots."
        type="long"
        requis
        valeur={v.description}
      />
      <div className="grid grid-cols-1 gap-[var(--space-admin-4)] md:grid-cols-2">
        <Champ
          nom="donneesConcernees"
          libelle="Données touchées"
          aide="Ex. : noms, e-mails."
          valeur={v.donneesConcernees}
        />
        <Champ
          nom="categoriesPersonnes"
          libelle="Qui est touché"
          aide="Ex. : clients, stagiaires."
          valeur={v.categoriesPersonnes}
        />
        <Champ
          nom="nombrePersonnes"
          libelle="Combien de personnes"
          aide="Une estimation suffit."
          type="nombre"
          valeur={v.nombrePersonnes}
        />
      </div>
      <Champ
        nom="consequences"
        libelle="Conséquences"
        aide="Ce qui peut arriver aux personnes."
        type="long"
        valeur={v.consequences}
      />
      <Champ
        nom="mesuresPrises"
        libelle="Ce qui a été fait"
        aide="Pour arrêter le problème et éviter qu'il revienne."
        type="long"
        valeur={v.mesuresPrises}
      />

      <div className="grid grid-cols-1 gap-[var(--space-admin-4)] md:grid-cols-3">
        <OuiNon nom="declareCnil" libelle="CNIL prévenue ?" valeur={v.declareCnil} />
        <Champ nom="declareCnilLe" libelle="Si oui : quand" type="date" valeur={v.declareCnilLe} />
        <Champ
          nom="motifNonDeclaration"
          libelle="Si non : pourquoi"
          aide="Ex. : aucun risque pour les personnes."
          valeur={v.motifNonDeclaration}
        />
        <OuiNon
          nom="personnesPrevenues"
          libelle="Personnes prévenues ?"
          valeur={v.personnesPrevenues}
        />
        <Champ
          nom="personnesPrevenuesLe"
          libelle="Si oui : quand"
          type="date"
          valeur={v.personnesPrevenuesLe}
        />
        <Champ
          nom="motifNonInformation"
          libelle="Si non : pourquoi"
          aide="Ex. : risque faible."
          valeur={v.motifNonInformation}
        />
      </div>

      <div>
        <AdminSubmitButton pendingLabel="Enregistrement…">{libelle}</AdminSubmitButton>
      </div>
    </form>
  );
}
