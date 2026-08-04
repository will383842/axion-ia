"use client";
// use-client: useActionState bind upsertSettingAction + JSON formatter.

import { useActionState, useState } from "react";
import { upsertSettingAction, type UpsertSettingState } from "@/features/admin-settings/actions";
import { contientUnSecret } from "@/lib/admin/masquer-secrets";
import { TriangleAlert } from "lucide-react";

const init: UpsertSettingState = { ok: false, error: "" };

interface Props {
  initial?: {
    key: string;
    value: unknown;
    description: string | null;
  };
}

export function SettingForm({ initial }: Props) {
  const [state, formAction, pending] = useActionState(upsertSettingAction, init);
  const [valueJson, setValueJson] = useState<string>(
    initial ? JSON.stringify(initial.value, null, 2) : "{}",
  );
  const [parseError, setParseError] = useState<string | null>(null);
  // Vrai tant que l'utilisateur n'a pas demandé à voir une valeur sensible.
  const [secretMasque, setSecretMasque] = useState<boolean>(() =>
    initial ? contientUnSecret(initial.value) : false,
  );

  function tryFormat() {
    try {
      const parsed = JSON.parse(valueJson);
      setValueJson(JSON.stringify(parsed, null, 2));
      setParseError(null);
    } catch (err) {
      setParseError((err as Error).message);
    }
  }

  return (
    <form action={formAction} className="admin-form">
      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor="key" className="admin-label">
            Clé
          </label>
          <input
            id="key"
            name="key"
            type="text"
            required
            pattern="[a-zA-Z0-9._\-]+"
            title="Lettres, chiffres, points, tirets et tirets bas — sans espace ni accent."
            defaultValue={initial?.key ?? ""}
            readOnly={!!initial}
            className="admin-input"
            disabled={pending}
            placeholder="ex: pricing.intervention.essentielle"
          />
        </div>
      </div>

      <div className="admin-field">
        <label htmlFor="description" className="admin-label">
          Description
        </label>
        <input
          id="description"
          name="description"
          type="text"
          maxLength={500}
          defaultValue={initial?.description ?? ""}
          className="admin-input"
          disabled={pending}
        />
      </div>

      <div className="admin-field">
        <label htmlFor="valueJson" className="admin-label">
          Valeur (JSON)
        </label>
        {/* 🔴 LE MASQUAGE POSÉ SUR LA LISTE NE TENAIT QU'UN ÉCRAN (relevé par
            l'audit du code, 2026-08-03). `legal_overrides` s'affichait masqué
            dans le tableau, puis EN CLAIR dès le clic sur « Éditer » : IBAN et
            BIC d'emblée à l'écran, sans le geste de révélation qu'impose la
            liste. Une garantie qui saute au premier clic n'en est pas une.

            Ici la valeur doit rester ÉDITABLE — on ne peut donc pas la
            remplacer par des points. On la floute jusqu'à ce qu'on la demande :
            le champ garde sa valeur réelle, la modification reste possible, et
            rien de sensible n'est lisible tant qu'on ne l'a pas décidé. */}
        {secretMasque ? (
          <div className="mb-[var(--space-admin-2)] flex items-center gap-[var(--space-admin-3)]">
            <span className="admin-meta-small">
              Cette valeur contient une donnée sensible (coordonnées bancaires, clé ou jeton).
            </span>
            <button
              type="button"
              className="admin-button-ghost"
              onClick={() => setSecretMasque(false)}
            >
              Afficher pour modifier
            </button>
          </div>
        ) : null}
        <textarea
          id="valueJson"
          name="valueJson"
          rows={12}
          required
          value={valueJson}
          onChange={(e) => {
            setValueJson(e.target.value);
            setParseError(null);
          }}
          className="admin-input admin-textarea admin-mono"
          style={secretMasque ? { filter: "blur(5px)" } : undefined}
          disabled={pending || secretMasque}
          placeholder='{"key": "value"}'
        />
        <div className="admin-filters-actions" style={{ marginTop: "8px" }}>
          <button
            type="button"
            className="admin-button-ghost"
            onClick={tryFormat}
            disabled={pending}
          >
            Formater JSON
          </button>
          {parseError && (
            <span className="admin-meta-small" role="alert">
              <TriangleAlert
                size={14}
                aria-hidden="true"
                className="inline-block shrink-0 align-[-0.125em]"
              />{" "}
              JSON invalide : {parseError}
            </span>
          )}
        </div>
      </div>

      {state.ok ? (
        <p role="status" className="admin-alert admin-alert-success">
          Paramètre enregistré.
        </p>
      ) : state.error ? (
        <p role="alert" className="admin-alert admin-alert-error">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="admin-button">
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
