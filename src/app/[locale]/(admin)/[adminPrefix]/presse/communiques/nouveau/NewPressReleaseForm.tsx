"use client";

// Formulaire de création d'un communiqué — client component avec useActionState
// (React 19) pour PRÉSERVER les champs saisis en cas d'erreur de validation.
//
// Avant (2026-07-14) : le server action faisait `redirect(?error=…)` → la page
// se rechargeait vide et il fallait tout ressaisir. Désormais, l'action renvoie
// `{ ok, error, values }` sans recharger ; React 19 réinitialise les champs
// non contrôlés sur leur `defaultValue`, qu'on alimente avec les valeurs
// soumises → titre / résumé / catégorie / ciblage restent remplis.
//
// ⚠️ Seule exception technique : le champ FICHIER (PDF) ne peut jamais être
// repré-rempli par le navigateur (sécurité) — l'utilisateur doit le
// re-sélectionner. Un message explicite le rappelle sous le champ en cas d'erreur.

import { useActionState } from "react";

import {
  AdminCard,
  AdminFormField,
  AdminFormSection,
  AdminSubmitButton,
  AdminFormError,
} from "@/components/admin/ui";

export interface NewReleaseFormValues {
  title: string;
  dek: string;
  tag: string;
  audience: string;
  region: string;
  departement: string;
  sector: string;
}

export interface NewReleaseFormState {
  ok: boolean;
  error?: string;
  values?: NewReleaseFormValues;
}

interface Option {
  value: string;
  label: string;
}

interface NewPressReleaseFormProps {
  action: (prev: NewReleaseFormState, formData: FormData) => Promise<NewReleaseFormState>;
  tagOptions: ReadonlyArray<Option>;
  audienceOptions: ReadonlyArray<Option>;
  regionOptions: ReadonlyArray<Option>;
  sectorOptions: ReadonlyArray<Option>;
}

const INITIAL_STATE: NewReleaseFormState = { ok: false };

export function NewPressReleaseForm({
  action,
  tagOptions,
  audienceOptions,
  regionOptions,
  sectorOptions,
}: NewPressReleaseFormProps): React.ReactElement {
  const [state, formAction] = useActionState(action, INITIAL_STATE);
  const v = state.values;
  const hasError = Boolean(state.error);

  return (
    <>
      {state.error ? <AdminFormError message={`Erreur : ${state.error}`} /> : null}

      <AdminCard>
        <form action={formAction} className="flex flex-col gap-[var(--space-admin-5)]">
          <AdminFormSection title="Contenu (français)">
            <AdminFormField
              label="Titre"
              name="title"
              type="text"
              required
              autoFocus
              placeholder="Axion-IA lance…"
              defaultValue={v?.title}
            />
            <AdminFormField
              label="Résumé (dek)"
              name="dek"
              type="text"
              hint="Phrase d'accroche affichée sous le titre (optionnel)."
              placeholder="Résumé en une phrase"
              defaultValue={v?.dek}
            />
            <div className="admin-form-field flex flex-col gap-[var(--space-admin-2)]">
              <label
                htmlFor="press-pdf"
                className="text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]"
              >
                Communiqué (PDF)
                <span
                  aria-hidden="true"
                  className="ml-[var(--space-admin-2)] text-[color:var(--color-admin-destructive)]"
                >
                  *
                </span>
              </label>
              <input
                id="press-pdf"
                name="file"
                type="file"
                accept="application/pdf,.pdf"
                required
                className="w-full rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-5)] py-[var(--space-admin-4)] text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg)] file:mr-[var(--space-admin-4)] file:rounded-[var(--radius-admin-sm)] file:border-0 file:bg-[color:var(--color-admin-info)] file:px-[var(--space-admin-4)] file:py-[var(--space-admin-2)] file:text-[color:var(--color-admin-paper)]"
              />
              <small className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                PDF uniquement, 10 Mo maximum.
              </small>
              {hasError ? (
                <small
                  role="alert"
                  className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-destructive)]"
                >
                  Re-sélectionnez le PDF : pour des raisons de sécurité, le navigateur ne peut pas
                  conserver le fichier après une erreur.
                </small>
              ) : null}
            </div>
          </AdminFormSection>

          <AdminFormSection title="Classification">
            <AdminFormField
              label="Catégorie"
              name="tag"
              type="select"
              required
              options={tagOptions}
              defaultValue={v?.tag}
            />
          </AdminFormSection>

          <AdminFormSection
            title="Ciblage média"
            description="Permet aux journalistes de filtrer les communiqués sur /presse (région, secteur, audience). Tous les champs sont optionnels."
          >
            <AdminFormField
              label="Audience"
              name="audience"
              type="select"
              defaultValue={v?.audience ?? "GENERAL"}
              options={audienceOptions}
              hint="Général = tout public ; Fondateur = angle dirigeant/portrait."
            />
            <AdminFormField
              label="Région"
              name="region"
              type="select"
              defaultValue={v?.region ?? ""}
              options={regionOptions}
            />
            <AdminFormField
              label="Département (code INSEE)"
              name="departement"
              type="text"
              placeholder="ex. 75, 2A, 974"
              hint="Code département en texte libre (optionnel) — 8 caractères maximum."
              defaultValue={v?.departement}
            />
            <AdminFormField
              label="Secteur d'activité"
              name="sector"
              type="select"
              defaultValue={v?.sector ?? ""}
              options={sectorOptions}
            />
          </AdminFormSection>

          <div className="flex items-center gap-[var(--space-admin-3)]">
            <AdminSubmitButton pendingLabel="Création…">Créer le brouillon</AdminSubmitButton>
          </div>
        </form>
      </AdminCard>
    </>
  );
}
