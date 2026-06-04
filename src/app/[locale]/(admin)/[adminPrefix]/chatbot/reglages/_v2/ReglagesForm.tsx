"use client";
// use-client: formulaire d'édition des réglages (useActionState + inputs contrôlés).

import { useActionState } from "react";
import {
  updateChatbotSettingsAction,
  type UpdateSettingsState,
  type ChatbotSettingsView,
} from "@/features/admin-chatbot/actions";

const INIT: UpdateSettingsState = { ok: false, error: "" };

const inputCls =
  "w-28 rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-2 py-1 text-[length:var(--text-admin-sm)] tabular-nums";

function NumberField({
  label,
  name,
  defaultValue,
  step,
  min,
  max,
}: {
  label: string;
  name: string;
  defaultValue: number;
  step?: string;
  min?: number;
  max?: number;
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[color:var(--color-admin-border)] py-2 last:border-0">
      <label htmlFor={name} className="text-[length:var(--text-admin-sm)]">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="number"
        defaultValue={defaultValue}
        step={step ?? "1"}
        min={min}
        max={max}
        className={inputCls}
      />
    </div>
  );
}

function CheckField({
  label,
  name,
  defaultChecked,
}: {
  label: string;
  name: string;
  defaultChecked: boolean;
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[color:var(--color-admin-border)] py-2 last:border-0">
      <label htmlFor={name} className="text-[length:var(--text-admin-sm)]">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="h-4 w-4"
      />
    </div>
  );
}

export function ReglagesForm({ data }: { data: ChatbotSettingsView }): React.ReactElement {
  const [state, formAction, pending] = useActionState(updateChatbotSettingsAction, INIT);
  const s = data.settings;

  return (
    <form action={formAction} className="flex flex-col gap-[var(--space-admin-4)]">
      <section className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
        <h2 className="mb-2 text-[length:var(--text-admin-base)] font-semibold">Activation</h2>
        <CheckField label="Tenant actif" name="actif" defaultChecked={data.actif} />
      </section>

      <section className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
        <h2 className="mb-2 text-[length:var(--text-admin-base)] font-semibold">
          Conversation & conversion
        </h2>
        <NumberField
          label="Seuil de confiance (escalade en-dessous)"
          name="confidenceThreshold"
          defaultValue={s.confidenceThreshold}
          step="0.05"
          min={0}
          max={1}
        />
        <NumberField
          label="Curseur de conversion (0 info → 1 lead)"
          name="conversionCursor"
          defaultValue={s.conversionCursor}
          step="0.05"
          min={0}
          max={1}
        />
        <NumberField
          label="Cartes d'offre max / réponse"
          name="maxOfferCards"
          defaultValue={s.maxOfferCards}
          min={1}
          max={10}
        />
        <CheckField
          label="Confirmation avant envoi des liens"
          name="confirmBeforeLinks"
          defaultChecked={s.confirmBeforeLinks}
        />
      </section>

      <section className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
        <h2 className="mb-2 text-[length:var(--text-admin-base)] font-semibold">
          Cache sémantique
        </h2>
        <CheckField label="Cache activé" name="cacheEnabled" defaultChecked={s.cache.enabled} />
        <NumberField
          label="Seuil de similarité (hit)"
          name="cacheSimilarityThreshold"
          defaultValue={s.cache.similarityThreshold}
          step="0.01"
          min={0}
          max={1}
        />
        <NumberField
          label="TTL (heures)"
          name="cacheTtlHours"
          defaultValue={s.cache.ttlHours}
          min={1}
          max={720}
        />
      </section>

      <section className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
        <h2 className="mb-2 text-[length:var(--text-admin-base)] font-semibold">Coût & RGPD</h2>
        <NumberField
          label="Cap coût mensuel (USD)"
          name="costCapUsdPerMonth"
          defaultValue={s.costCapUsdPerMonth}
          step="1"
          min={0}
        />
        <NumberField
          label="Rétention conversations (mois)"
          name="retentionMonths"
          defaultValue={s.retentionMonths}
          min={1}
          max={120}
        />
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-info)] px-4 py-2 text-[length:var(--text-admin-sm)] font-medium text-white disabled:opacity-50"
        >
          {pending ? "Enregistrement…" : "Enregistrer les réglages"}
        </button>
        {state.ok ? (
          <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]">
            Réglages enregistrés.
          </span>
        ) : state.error ? (
          <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-destructive)]">
            {state.error}
          </span>
        ) : null}
      </div>
    </form>
  );
}
