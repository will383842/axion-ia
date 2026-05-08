"use client";
// use-client: useActionState bind upsertSettingAction + JSON formatter.

import { useActionState, useState } from "react";
import { upsertSettingAction, type UpsertSettingState } from "@/features/admin-settings/actions";

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
            Clé (key)
          </label>
          <input
            id="key"
            name="key"
            type="text"
            required
            pattern="[a-zA-Z0-9._\-]+"
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
          disabled={pending}
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
              ⚠ JSON invalide : {parseError}
            </span>
          )}
        </div>
      </div>

      {state.ok ? (
        <p role="status" className="admin-alert admin-alert-success">
          ✓ Paramètre enregistré.
        </p>
      ) : state.error ? (
        <p role="alert" className="admin-alert admin-alert-error">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="admin-button">
        {pending ? "Enregistrement..." : "Enregistrer"}
      </button>
    </form>
  );
}
