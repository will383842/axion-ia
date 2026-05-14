/**
 * Content Generator — TemplateForm (Sprint 3 § 12.1).
 *
 * Server Component partagé entre `/templates/new` et `/templates/[id]`.
 * Édition system prompt + user template + Zod schema + variables JSON +
 * expansionMode + defaultModel / temperature / maxTokens.
 *
 * Pas de Tiptap V1 → textarea monospace (Tiptap V1.5 si Will veut).
 */

import type { ContentType, ExpansionMode } from "../../../../prisma/generated/client";

interface TemplateFormProps {
  readonly initial?: {
    readonly id?: string;
    readonly slug: string;
    readonly contentType: ContentType;
    readonly variant?: string | null;
    readonly name: string;
    readonly description?: string | null;
    readonly systemPrompt: string;
    readonly userPromptTemplate: string;
    readonly outputSchemaZod: string;
    readonly variables: unknown;
    readonly expansionMode: ExpansionMode;
    readonly defaultModel?: string | null;
    readonly defaultTemperature?: string | null;
    readonly defaultMaxTokens?: number | null;
    readonly isActive: boolean;
  };
  readonly action: (formData: FormData) => Promise<void> | void;
}

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

export function TemplateForm({ initial, action }: TemplateFormProps) {
  return (
    <form action={action} className="admin-card">
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
            ContentType
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
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="variant" className="admin-label">
            Variant
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
          System prompt (min 30 caractères)
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
          User prompt template (mustache <code>{"{{var}}"}</code>)
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
          Zod schema (TS source sérialisé)
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
            Expansion mode
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
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="defaultModel" className="admin-label">
            Default model override
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
            Temperature
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
            Max tokens
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
          Template actif (utilisable par les generators)
        </label>
      </div>

      <div className="admin-filters-actions">
        <button type="submit" className="admin-button">
          {initial?.id ? "Enregistrer" : "Créer le template"}
        </button>
      </div>
    </form>
  );
}
