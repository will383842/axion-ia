"use client";
// use-client: form interactif (useActionState + handlers select onChange).
//
// KB-3 — Form minimal de création d'entrée KB.
// V1 : type + domain + audience + slug + titre + body FR.
// Translation EN + tags + relations + medias → onglets en KB-4/KB-11/KB-15.

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { createEntryAction, type CreateEntryResult } from "@/server/actions/knowledge/create-entry";
import { KB_TYPES, getKbTypeMeta } from "@/content/knowledge/types";
import { KB_DOMAINS, getDomainLabel } from "@/content/knowledge/domains";
import { KB_AUDIENCES, getAudienceLabel } from "@/content/knowledge/audiences";
import {
  KB_CONFIDENTIALITIES,
  getConfidentialityLabel,
} from "@/content/knowledge/confidentialities";
import { TiptapEditor } from "@/components/admin/TiptapEditor";
import { messageErreurKb } from "@/server/knowledge/erreurs-labels";

interface Props {
  readonly adminPrefix: string;
}

async function submitAction(
  _prev: CreateEntryResult | null,
  formData: FormData,
): Promise<CreateEntryResult> {
  return await createEntryAction({
    type: formData.get("type") as never,
    domain: formData.get("domain") as never,
    audience: (formData.get("audience") as never) ?? "team",
    confidentiality: (formData.get("confidentiality") as never) ?? "internal",
    status: "draft",
    pipelineStage: "idea",
    slug: String(formData.get("slug") ?? ""),
    briefMarkdown: String(formData.get("briefMarkdown") ?? "") || null,
    targetKeyword: String(formData.get("targetKeyword") ?? "") || null,
    targetWordCount: formData.get("targetWordCount")
      ? Number(formData.get("targetWordCount"))
      : null,
    translations: [
      {
        locale: "fr",
        title: String(formData.get("title_fr") ?? ""),
        slug: String(formData.get("slug_fr") ?? formData.get("slug") ?? ""),
        excerpt: String(formData.get("excerpt_fr") ?? "") || null,
        body: String(formData.get("body_fr_html") ?? ""),
        bodyJson: formData.get("body_fr_json")
          ? JSON.parse(String(formData.get("body_fr_json")))
          : null,
        bodyText: String(formData.get("body_fr_text") ?? "") || null,
      },
    ],
  });
}

export function ConnaissancesNouvelleForm({ adminPrefix }: Props) {
  const [state, formAction, pending] = useActionState(submitAction, null);
  const router = useRouter();

  if (state?.ok && state.entryId) {
    router.push(`/fr/${adminPrefix}/connaissances/${state.entryId}`);
  }

  return (
    <form action={formAction} className="admin-card admin-form">
      <div className="admin-field">
        <label className="admin-label" htmlFor="type">
          Type
        </label>
        <select id="type" name="type" required className="admin-input" defaultValue="article">
          {KB_TYPES.map((t) => (
            <option key={t} value={t}>
              {getKbTypeMeta(t).labelFr}
            </option>
          ))}
        </select>
      </div>

      <div className="admin-field">
        <label className="admin-label" htmlFor="domain">
          Domaine
        </label>
        <select id="domain" name="domain" required className="admin-input" defaultValue="editorial">
          {KB_DOMAINS.map((d) => (
            <option key={d} value={d}>
              {getDomainLabel(d, "fr")}
            </option>
          ))}
        </select>
      </div>

      <div className="admin-field">
        <label className="admin-label" htmlFor="audience">
          Audience
        </label>
        <select id="audience" name="audience" className="admin-input" defaultValue="team">
          {KB_AUDIENCES.map((a) => (
            <option key={a} value={a}>
              {getAudienceLabel(a, "fr")}
            </option>
          ))}
        </select>
      </div>

      <div className="admin-field">
        <label className="admin-label" htmlFor="confidentiality">
          Confidentialité
        </label>
        <select
          id="confidentiality"
          name="confidentiality"
          className="admin-input"
          defaultValue="internal"
        >
          {KB_CONFIDENTIALITIES.map((c) => (
            <option key={c} value={c}>
              {getConfidentialityLabel(c, "fr")}
            </option>
          ))}
        </select>
      </div>

      <div className="admin-field">
        <label className="admin-label" htmlFor="slug">
          Slug racine (cross-langue, identifiant stable)
        </label>
        <input
          id="slug"
          name="slug"
          type="text"
          required
          className="admin-input"
          placeholder="mon-entree-kb"
          pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
        />
      </div>

      <div className="admin-field">
        <label className="admin-label" htmlFor="title_fr">
          Titre (FR)
        </label>
        <input
          id="title_fr"
          name="title_fr"
          type="text"
          required
          className="admin-input"
          minLength={2}
          maxLength={255}
        />
      </div>

      <div className="admin-field">
        <label className="admin-label" htmlFor="slug_fr">
          Slug FR (URL publique si applicable)
        </label>
        <input
          id="slug_fr"
          name="slug_fr"
          type="text"
          className="admin-input"
          placeholder="(par défaut = slug racine)"
        />
      </div>

      <div className="admin-field">
        <label className="admin-label" htmlFor="excerpt_fr">
          Extrait (FR, 500 chars max)
        </label>
        <textarea
          id="excerpt_fr"
          name="excerpt_fr"
          className="admin-input"
          rows={2}
          maxLength={500}
        />
      </div>

      <div className="admin-field">
        <label className="admin-label">Corps (FR)</label>
        <TiptapEditor name="body_fr" />
      </div>

      <div className="admin-field">
        <label className="admin-label" htmlFor="briefMarkdown">
          Brief éditorial (markdown court, optionnel)
        </label>
        <textarea
          id="briefMarkdown"
          name="briefMarkdown"
          className="admin-input"
          rows={3}
          maxLength={5000}
        />
      </div>

      <div className="admin-field">
        <label className="admin-label" htmlFor="targetKeyword">
          Mot-clé cible (SEO, optionnel)
        </label>
        <input
          id="targetKeyword"
          name="targetKeyword"
          type="text"
          className="admin-input"
          maxLength={180}
        />
      </div>

      <div className="admin-field">
        <label className="admin-label" htmlFor="targetWordCount">
          Objectif mots (optionnel)
        </label>
        <input
          id="targetWordCount"
          name="targetWordCount"
          type="number"
          className="admin-input"
          min={0}
          max={50000}
        />
      </div>

      <div className="admin-form-actions">
        <button type="submit" disabled={pending} className="admin-button">
          {pending ? "Création..." : "Créer le brouillon"}
        </button>
        <a href={`/fr/${adminPrefix}/connaissances`} className="admin-button-ghost">
          Annuler
        </a>
      </div>

      {state?.error && state.error !== "validation" ? (
        <p className="admin-error" role="alert">
          {messageErreurKb(state.error)}
        </p>
      ) : null}
      {state?.error === "validation" && state.fieldErrors ? (
        <ul className="admin-error" role="alert">
          {Object.entries(state.fieldErrors).map(([k, v]) => (
            <li key={k}>
              {k} : {(v ?? []).join(", ")}
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
