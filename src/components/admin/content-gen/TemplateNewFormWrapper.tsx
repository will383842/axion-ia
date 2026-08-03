"use client";
// use-client: useState + startTransition pour capture erreurs Server Action.
// P0-6 : JSON.parse "variables" protégé côté client avant soumission.
// Sprint correctif SP-01.

import { useState, useTransition } from "react";
import { AdminFormError } from "@/components/admin/ui/AdminFormError";
import type { ContentType, ExpansionMode } from "../../../../prisma/generated/client";
import { CONTENT_TYPE_LABEL_FR, EXPANSION_MODE_LABEL_FR } from "./template-labels";

const CONTENT_TYPES: ReadonlyArray<ContentType> = [
  "landing_ville",
  "blog_article",
  "blog_from_title",
  "blog_from_keywords",
  "blog_from_rss",
  "comparison",
  "guide_pilier",
  "qa_derived",
  "faq_standalone",
];

const EXPANSION_MODES: ReadonlyArray<ExpansionMode> = [
  "manual",
  "all_villes",
  "all_regions",
  "custom_villes",
  "from_keywords",
  "from_questions",
  "from_rss_items",
  "from_csv",
];

// Les libellés vivent désormais dans template-labels.ts : le formulaire
// d'ÉDITION affichait les enums bruts faute de les partager.

interface InitialValues {
  readonly id?: string;
  readonly slug?: string;
  readonly contentType?: ContentType;
  readonly variant?: string | null;
  readonly name?: string;
  readonly description?: string | null;
  readonly systemPrompt?: string;
  readonly userPromptTemplate?: string;
  readonly outputSchemaZod?: string;
  readonly variables?: unknown;
  readonly expansionMode?: ExpansionMode;
  readonly defaultModel?: string | null;
  readonly defaultTemperature?: string | null;
  readonly defaultMaxTokens?: number | null;
  readonly isActive?: boolean;
}

interface Props {
  action: (formData: FormData) => Promise<void>;
  initial?: InitialValues;
}

export function TemplateNewFormWrapper({ action, initial }: Props): React.ReactElement {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    // P0-6 : validation JSON "variables" avant envoi
    const variablesRaw = String(fd.get("variables") ?? "{}");
    try {
      JSON.parse(variablesRaw);
    } catch (parseErr: unknown) {
      const parseMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      setError(`JSON invalide dans "Variables d'entrée" : ${parseMsg}`);
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        await action(fd);
      } catch (err: unknown) {
        if (
          err != null &&
          typeof err === "object" &&
          "digest" in err &&
          typeof (err as { digest: unknown }).digest === "string" &&
          (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
        ) {
          throw err;
        }
        if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
        const msg = err instanceof Error ? err.message : "Erreur lors de la création du template.";
        setError(msg);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="admin-card" aria-busy={isPending}>
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      <div className="admin-filters-grid">
        <div className="admin-field">
          <label htmlFor="slug" className="admin-label">
            Slug
          </label>
          <input
            id="slug"
            name="slug"
            required
            minLength={2}
            defaultValue={initial?.slug ?? ""}
            className="admin-input"
            placeholder="ex. landing-ville-v2"
          />
        </div>
        <div className="admin-field">
          <label htmlFor="contentType" className="admin-label">
            Type de contenu
          </label>
          <select
            id="contentType"
            name="contentType"
            defaultValue={initial?.contentType ?? "landing_ville"}
            className="admin-input"
            required
          >
            {CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {CONTENT_TYPE_LABEL_FR[t] ?? t}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="variant" className="admin-label">
            Variante
          </label>
          <input
            id="variant"
            name="variant"
            defaultValue={initial?.variant ?? ""}
            className="admin-input"
            placeholder='ex. "default" / "secteur-industrie"'
          />
        </div>
        <div className="admin-field">
          <label htmlFor="name" className="admin-label">
            Nom
          </label>
          <input
            id="name"
            name="name"
            required
            defaultValue={initial?.name ?? ""}
            className="admin-input"
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
          defaultValue={initial?.description ?? ""}
          className="admin-input"
        />
      </div>

      <div className="admin-field">
        <label htmlFor="systemPrompt" className="admin-label">
          Invite système (min 30 caractères)
        </label>
        <textarea
          id="systemPrompt"
          name="systemPrompt"
          rows={14}
          required
          minLength={30}
          defaultValue={initial?.systemPrompt ?? ""}
          className="admin-input"
          style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }}
        />
      </div>

      <div className="admin-field">
        <label htmlFor="userPromptTemplate" className="admin-label">
          Modèle d&apos;invite utilisateur (mustache <code>{"{{var}}"}</code>)
        </label>
        <textarea
          id="userPromptTemplate"
          name="userPromptTemplate"
          rows={10}
          required
          minLength={5}
          defaultValue={initial?.userPromptTemplate ?? ""}
          className="admin-input"
          style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }}
        />
      </div>

      <div className="admin-field">
        <label htmlFor="outputSchemaZod" className="admin-label">
          Schéma Zod (source TS sérialisée)
        </label>
        <textarea
          id="outputSchemaZod"
          name="outputSchemaZod"
          rows={8}
          defaultValue={initial?.outputSchemaZod ?? "z.object({})"}
          className="admin-input"
          style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }}
        />
      </div>

      <div className="admin-field">
        <label htmlFor="variables" className="admin-label">
          Variables d&apos;entrée (JSON)
        </label>
        <textarea
          id="variables"
          name="variables"
          rows={6}
          defaultValue={initial?.variables ? JSON.stringify(initial.variables, null, 2) : "{}"}
          className="admin-input"
          style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }}
        />
      </div>

      <div className="admin-filters-grid">
        <div className="admin-field">
          <label htmlFor="expansionMode" className="admin-label">
            Mode d&apos;expansion
          </label>
          <select
            id="expansionMode"
            name="expansionMode"
            defaultValue={initial?.expansionMode ?? "manual"}
            className="admin-input"
            required
          >
            {EXPANSION_MODES.map((m) => (
              <option key={m} value={m}>
                {EXPANSION_MODE_LABEL_FR[m] ?? m}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="defaultModel" className="admin-label">
            Modèle par défaut (surcharge)
          </label>
          <input
            id="defaultModel"
            name="defaultModel"
            defaultValue={initial?.defaultModel ?? ""}
            className="admin-input"
            placeholder='ex. "gpt-4o" / "claude-sonnet-4-6"'
          />
        </div>
        <div className="admin-field">
          <label htmlFor="defaultTemperature" className="admin-label">
            Température
          </label>
          <input
            id="defaultTemperature"
            name="defaultTemperature"
            type="number"
            step="0.01"
            min="0"
            max="2"
            defaultValue={initial?.defaultTemperature ?? ""}
            className="admin-input"
          />
        </div>
        <div className="admin-field">
          <label htmlFor="defaultMaxTokens" className="admin-label">
            Jetons max
          </label>
          <input
            id="defaultMaxTokens"
            name="defaultMaxTokens"
            type="number"
            min="100"
            max="100000"
            defaultValue={initial?.defaultMaxTokens ?? ""}
            className="admin-input"
          />
        </div>
      </div>

      <div className="admin-field">
        <label className="admin-label">
          <input type="checkbox" name="isActive" defaultChecked={initial?.isActive ?? true} />{" "}
          Modèle actif (utilisable par les générateurs)
        </label>
      </div>

      {error && (
        <div className="mt-[var(--space-admin-3)]">
          <AdminFormError message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      <div className="admin-filters-actions">
        <button type="submit" className="admin-button" disabled={isPending} aria-busy={isPending}>
          {isPending ? "Création en cours…" : initial?.id ? "Enregistrer" : "Créer le template"}
        </button>
      </div>
    </form>
  );
}
