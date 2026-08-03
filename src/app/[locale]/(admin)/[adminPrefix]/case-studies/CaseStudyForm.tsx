"use client";
// use-client: useActionState + state pour modules multi-select + tabs FR/EN.

import { useActionState, useState } from "react";
import {
  upsertCaseStudyAction,
  type UpsertCaseStudyState,
} from "@/features/admin-case-studies/actions";
import { TiptapEditor } from "@/components/admin/TiptapEditor";

const init: UpsertCaseStudyState = { ok: false, error: "" };

interface TranslationInitial {
  title: string;
  slug: string;
  problem: string;
  solution: string;
  metaTitle: string | null;
  metaDescription: string | null;
}

interface Initial {
  id: string;
  sector: string;
  companySizeRange: string;
  region: string | null;
  modulesUsed: string[];
  resultsQuantified: Array<{ label: string; value: string | number; unit?: string }>;
  durationWeeks: number | null;
  roiWeeks: number | null;
  status: string;
  publishedAt: Date | null;
  fr: TranslationInitial;
  en: TranslationInitial;
}

interface Props {
  initial?: Initial;
}

const ALL_MODULES = ["intervention", "implementation", "audit"] as const;

export function CaseStudyForm({ initial }: Props) {
  const [state, formAction, pending] = useActionState(upsertCaseStudyAction, init);
  const [activeLocale, setActiveLocale] = useState<"fr" | "en">("fr");
  const [modules, setModules] = useState<Set<string>>(new Set(initial?.modulesUsed ?? []));
  const [resultsJson, setResultsJson] = useState<string>(
    JSON.stringify(initial?.resultsQuantified ?? [], null, 2),
  );

  function toggleModule(m: string) {
    setModules((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  }

  return (
    <form action={formAction} className="admin-form">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="resultsQuantified" value={resultsJson} />

      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor="status" className="admin-label">
            Statut
          </label>
          <select
            id="status"
            name="status"
            defaultValue={initial?.status ?? "draft"}
            className="admin-input"
            disabled={pending}
          >
            <option value="draft">Brouillon</option>
            <option value="published">Publié</option>
            <option value="archived">Archivé</option>
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="publishedAt" className="admin-label">
            Date publication
          </label>
          <input
            id="publishedAt"
            name="publishedAt"
            type="datetime-local"
            defaultValue={
              initial?.publishedAt ? initial.publishedAt.toISOString().slice(0, 16) : ""
            }
            className="admin-input"
            disabled={pending}
          />
        </div>
      </div>

      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor="sector" className="admin-label">
            Secteur
          </label>
          <input
            id="sector"
            name="sector"
            type="text"
            required
            defaultValue={initial?.sector ?? ""}
            className="admin-input"
            disabled={pending}
            placeholder="ex: Industrie"
          />
        </div>
        <div className="admin-field">
          <label htmlFor="companySizeRange" className="admin-label">
            Taille société
          </label>
          <input
            id="companySizeRange"
            name="companySizeRange"
            type="text"
            required
            defaultValue={initial?.companySizeRange ?? ""}
            className="admin-input"
            disabled={pending}
            placeholder="ex: 10-49"
          />
        </div>
        <div className="admin-field">
          <label htmlFor="region" className="admin-label">
            Région
          </label>
          <input
            id="region"
            name="region"
            type="text"
            defaultValue={initial?.region ?? ""}
            className="admin-input"
            disabled={pending}
            placeholder="ex: Bretagne"
          />
        </div>
      </div>

      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor="durationWeeks" className="admin-label">
            Durée projet (semaines)
          </label>
          <input
            id="durationWeeks"
            name="durationWeeks"
            type="number"
            min={0}
            defaultValue={initial?.durationWeeks ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="roiWeeks" className="admin-label">
            ROI atteint (semaines)
          </label>
          <input
            id="roiWeeks"
            name="roiWeeks"
            type="number"
            min={0}
            defaultValue={initial?.roiWeeks ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
      </div>

      <div className="admin-field">
        <label className="admin-label">Modules utilisés ({modules.size} sélectionnés)</label>
        <div className="admin-tags-grid">
          {ALL_MODULES.map((m) => (
            <label key={m} className="admin-tag-checkbox">
              <input
                type="checkbox"
                name="modulesUsed"
                value={m}
                checked={modules.has(m)}
                onChange={() => toggleModule(m)}
                disabled={pending}
              />
              <span>
                {m === "intervention"
                  ? "Intervention"
                  : m === "implementation"
                    ? "Implémentation"
                    : "Audit"}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="admin-field">
        <label htmlFor="resultsJson" className="admin-label">
          Résultats chiffrés (JSON) — format [{"{"}label, value, unit{"}"}]
        </label>
        <textarea
          id="resultsJson"
          rows={6}
          value={resultsJson}
          onChange={(e) => setResultsJson(e.target.value)}
          className="admin-input admin-textarea admin-mono"
          disabled={pending}
          placeholder={'[{"label":"Heures récupérées","value":220,"unit":"h/an"}]'}
        />
      </div>

      {/* Tabs FR / EN */}
      <div className="admin-tabs">
        <button
          type="button"
          onClick={() => setActiveLocale("fr")}
          className={activeLocale === "fr" ? "admin-tab admin-tab-active" : "admin-tab"}
        >
          Contenu FR
        </button>
        <button
          type="button"
          onClick={() => setActiveLocale("en")}
          className={activeLocale === "en" ? "admin-tab admin-tab-active" : "admin-tab"}
        >
          Contenu EN
        </button>
      </div>

      <div className={activeLocale === "fr" ? "admin-tab-content" : "admin-tab-content-hidden"}>
        <CSTranslationFields prefix="fr" initial={initial?.fr} disabled={pending} />
      </div>
      <div className={activeLocale === "en" ? "admin-tab-content" : "admin-tab-content-hidden"}>
        <CSTranslationFields prefix="en" initial={initial?.en} disabled={pending} />
      </div>

      {state.ok ? (
        <p role="status" className="admin-alert admin-alert-success">
          {state.created ? "Cas concret créé" : "Cas concret mis à jour"}.
        </p>
      ) : state.error ? (
        <p role="alert" className="admin-alert admin-alert-error">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="admin-button">
        {pending ? "Enregistrement…" : initial?.id ? "Mettre à jour" : "Créer"}
      </button>
    </form>
  );
}

function CSTranslationFields({
  prefix,
  initial,
  disabled,
}: {
  prefix: "fr" | "en";
  initial: TranslationInitial | undefined;
  disabled: boolean;
}) {
  return (
    <>
      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor={`${prefix}_title`} className="admin-label">
            Titre
          </label>
          <input
            id={`${prefix}_title`}
            name={`${prefix}_title`}
            type="text"
            required
            defaultValue={initial?.title ?? ""}
            className="admin-input"
            disabled={disabled}
          />
        </div>
        <div className="admin-field">
          <label htmlFor={`${prefix}_slug`} className="admin-label">
            Slug
          </label>
          <input
            id={`${prefix}_slug`}
            name={`${prefix}_slug`}
            type="text"
            required
            pattern="[a-z0-9-]+"
            title="Minuscules, chiffres et tirets uniquement — sans espace ni accent."
            defaultValue={initial?.slug ?? ""}
            className="admin-input"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="admin-field">
        <label className="admin-label">Problème (contexte initial)</label>
        <TiptapEditor
          name={`${prefix}_problem`}
          initialHtml={initial?.problem ?? ""}
          placeholder={
            prefix === "fr" ? "Décrivez la situation initiale…" : "Décrivez la situation initiale…"
          }
        />
      </div>

      <div className="admin-field">
        <label className="admin-label">Solution mise en œuvre</label>
        <TiptapEditor
          name={`${prefix}_solution`}
          initialHtml={initial?.solution ?? ""}
          placeholder={prefix === "fr" ? "Décrivez la solution…" : "Décrivez la solution…"}
        />
      </div>

      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor={`${prefix}_metaTitle`} className="admin-label">
            Méta-titre (max 70)
          </label>
          <input
            id={`${prefix}_metaTitle`}
            name={`${prefix}_metaTitle`}
            type="text"
            maxLength={70}
            defaultValue={initial?.metaTitle ?? ""}
            className="admin-input"
            disabled={disabled}
          />
        </div>
        <div className="admin-field">
          <label htmlFor={`${prefix}_metaDescription`} className="admin-label">
            Méta-description (max 160)
          </label>
          <input
            id={`${prefix}_metaDescription`}
            name={`${prefix}_metaDescription`}
            type="text"
            maxLength={160}
            defaultValue={initial?.metaDescription ?? ""}
            className="admin-input"
            disabled={disabled}
          />
        </div>
      </div>
    </>
  );
}
