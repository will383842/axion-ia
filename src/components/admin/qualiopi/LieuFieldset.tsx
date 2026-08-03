"use client";
// use-client: fieldset contrôlé (état remonté au parent). Aucun appel serveur ici.

/**
 * LieuFieldset — Saisie du lieu de déroulement d&apos;une session.
 *
 * Partagé par `SessionForm` (création) et `SessionLieuForm` (correction depuis la
 * fiche session) : une seule définition des champs, des libellés et des règles
 * d&apos;affichage. Les faire diverger reviendrait à ce qu&apos;une session créée
 * et une session corrigée ne décrivent pas le même objet.
 *
 * Composant CONTRÔLÉ : il ne détient aucun état et n&apos;appelle aucune action.
 */

import type { LieuValues } from "@/components/admin/qualiopi/lieu-values";

export interface LieuFieldsetProps {
  value: LieuValues;
  onChange: (patch: Partial<LieuValues>) => void;
  disabled?: boolean;
  /** Préfixe des `id` HTML — deux instances peuvent coexister sur une page. */
  idPrefix?: string;
}

const TYPE_OPTIONS = [
  { value: "", label: "— Non précisé —" },
  { value: "sur_site", label: "Sur site (chez le client)" },
  { value: "nos_locaux", label: "Nos locaux" },
  { value: "distanciel", label: "Distanciel (visioconférence)" },
] as const;

export function LieuFieldset({
  value,
  onChange,
  disabled = false,
  idPrefix = "lieu",
}: LieuFieldsetProps): React.ReactElement {
  const labelCls =
    "block text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-[var(--space-admin-1)]";
  const inputCls =
    "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";

  // Le distanciel n'a pas d'adresse postale, le présentiel n'a pas d'URL de
  // visio. Afficher les deux inviterait à remplir les deux, et la convention
  // annoncerait un lieu qui se contredit lui-même.
  const estDistanciel = value.lieuType === "distanciel";

  return (
    <fieldset className="mb-[var(--space-admin-5)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]">
      <legend className="px-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
        Lieu de déroulement
      </legend>
      <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        Imprimé sur la convention, la convocation et la feuille d&apos;émargement. Laissé vide, ces
        documents retombent sur l&apos;adresse de l&apos;organisme.
      </p>

      <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor={`${idPrefix}-type`}>
            Type de lieu
          </label>
          <select
            id={`${idPrefix}-type`}
            value={value.lieuType}
            onChange={(e) => onChange({ lieuType: e.target.value as LieuValues["lieuType"] })}
            disabled={disabled}
            className={inputCls}
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls} htmlFor={`${idPrefix}-intitule`}>
            Intitulé du lieu
          </label>
          <input
            id={`${idPrefix}-intitule`}
            value={value.lieuIntitule}
            onChange={(e) => onChange({ lieuIntitule: e.target.value })}
            disabled={disabled}
            maxLength={200}
            placeholder="Ex. : Siège du client"
            className={inputCls}
          />
        </div>

        {estDistanciel ? (
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor={`${idPrefix}-visio`}>
              Lien de visioconférence
            </label>
            <input
              id={`${idPrefix}-visio`}
              type="url"
              inputMode="url"
              value={value.lieuVisioUrl}
              onChange={(e) => onChange({ lieuVisioUrl: e.target.value })}
              disabled={disabled}
              maxLength={2000}
              placeholder="https://meet.google.com/…"
              className={inputCls}
            />
            <p className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              Seul l&apos;hôte (ex. « meet.google.com ») apparaît sur les documents — jamais le lien
              complet, qui vaut souvent clé d&apos;accès.
            </p>
          </div>
        ) : (
          <>
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor={`${idPrefix}-adresse`}>
                Adresse
              </label>
              <input
                id={`${idPrefix}-adresse`}
                value={value.lieuAdresse}
                onChange={(e) => onChange({ lieuAdresse: e.target.value })}
                disabled={disabled}
                maxLength={500}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor={`${idPrefix}-cp`}>
                Code postal
              </label>
              <input
                id={`${idPrefix}-cp`}
                value={value.lieuCodePostal}
                onChange={(e) => onChange({ lieuCodePostal: e.target.value })}
                disabled={disabled}
                maxLength={10}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor={`${idPrefix}-ville`}>
                Ville
              </label>
              <input
                id={`${idPrefix}-ville`}
                value={value.lieuVille}
                onChange={(e) => onChange({ lieuVille: e.target.value })}
                disabled={disabled}
                maxLength={120}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor={`${idPrefix}-salle`}>
                Salle
              </label>
              <input
                id={`${idPrefix}-salle`}
                value={value.lieuSalle}
                onChange={(e) => onChange({ lieuSalle: e.target.value })}
                disabled={disabled}
                maxLength={120}
                className={inputCls}
              />
            </div>
          </>
        )}
      </div>
    </fieldset>
  );
}
