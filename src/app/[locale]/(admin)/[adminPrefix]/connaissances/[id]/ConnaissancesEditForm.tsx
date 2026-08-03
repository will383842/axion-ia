"use client";
// use-client: form interactif (useActionState).
//
// KB-3 — Form d'édition Entry + body FR autosave.

import { useActionState } from "react";
import { updateEntryAction, type UpdateEntryResult } from "@/server/actions/knowledge/update-entry";
import { saveDraftAction } from "@/server/actions/knowledge/save-draft";
import { deleteEntryAction } from "@/server/actions/knowledge/delete-entry";
import { KB_TYPES, getKbTypeMeta } from "@/content/knowledge/types";
import { KB_DOMAINS, getDomainLabel } from "@/content/knowledge/domains";
import { KB_AUDIENCES, getAudienceLabel } from "@/content/knowledge/audiences";
import {
  KB_CONFIDENTIALITIES,
  getConfidentialityLabel,
} from "@/content/knowledge/confidentialities";
import {
  KB_STATUSES,
  KB_PIPELINE_STAGES,
  getStatusLabel,
  getPipelineStageLabel,
} from "@/content/knowledge/statuses";
import { TiptapEditor } from "@/components/admin/TiptapEditor";
import type {
  KbAudience,
  KbConfidentiality,
  KbDomain,
  KbPipelineStage,
  KbStatus,
  KbType,
} from "../../../../../../../prisma/generated/client";
import { messageErreurKb } from "@/server/knowledge/erreurs-labels";

export interface EntrySnapshot {
  readonly id: string;
  readonly type: KbType;
  readonly domain: KbDomain;
  readonly audience: KbAudience;
  readonly confidentiality: KbConfidentiality;
  readonly status: KbStatus;
  readonly pipelineStage: KbPipelineStage;
  readonly slug: string;
  readonly briefMarkdown: string | null;
  readonly targetKeyword: string | null;
  readonly targetWordCount: number | null;
  readonly fr: {
    readonly id: string;
    readonly title: string;
    readonly slug: string;
    readonly excerpt: string | null;
    readonly body: string;
  } | null;
}

interface Props {
  readonly adminPrefix: string;
  readonly entry: EntrySnapshot;
}

async function updateSubmit(
  _prev: UpdateEntryResult | null,
  formData: FormData,
): Promise<UpdateEntryResult> {
  const id = String(formData.get("entryId") ?? "");
  return await updateEntryAction({
    id,
    type: formData.get("type") as never,
    domain: formData.get("domain") as never,
    audience: formData.get("audience") as never,
    confidentiality: formData.get("confidentiality") as never,
    status: formData.get("status") as never,
    pipelineStage: formData.get("pipelineStage") as never,
    slug: String(formData.get("slug") ?? ""),
    briefMarkdown: (String(formData.get("briefMarkdown") ?? "") || null) as string | null,
    targetKeyword: (String(formData.get("targetKeyword") ?? "") || null) as string | null,
    targetWordCount: formData.get("targetWordCount")
      ? Number(formData.get("targetWordCount"))
      : null,
  });
}

async function bodySubmit(_prev: unknown, formData: FormData) {
  const entryId = String(formData.get("entryId") ?? "");
  const bodyTextRaw = String(formData.get("body_fr_text") ?? "");
  const excerptRaw = String(formData.get("excerpt") ?? "");
  return await saveDraftAction({
    entryId,
    locale: "fr",
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body_fr_html") ?? ""),
    bodyJson: formData.get("body_fr_json")
      ? JSON.parse(String(formData.get("body_fr_json")))
      : null,
    ...(bodyTextRaw ? { bodyText: bodyTextRaw } : {}),
    ...(excerptRaw ? { excerpt: excerptRaw } : {}),
  });
}

async function deleteSubmit(_prev: unknown, formData: FormData) {
  return await deleteEntryAction({ id: String(formData.get("entryId") ?? "") });
}

export function ConnaissancesEditForm({ adminPrefix, entry }: Props) {
  const [metaState, metaAction, metaPending] = useActionState(updateSubmit, null);
  const [bodyState, bodyAction, bodyPending] = useActionState(bodySubmit, null);
  const [delState, delAction, delPending] = useActionState(deleteSubmit, null);

  return (
    <div className="admin-grid-2">
      {/* ============= Métadonnées ============= */}
      <form action={metaAction} className="admin-card admin-form">
        <h2 className="admin-h2">Métadonnées</h2>
        <input type="hidden" name="entryId" value={entry.id} />
        <div className="admin-field">
          <label className="admin-label" htmlFor="type-edit">
            Type
          </label>
          <select id="type-edit" name="type" className="admin-input" defaultValue={entry.type}>
            {KB_TYPES.map((t) => (
              <option key={t} value={t}>
                {getKbTypeMeta(t).labelFr}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="domain-edit">
            Domaine
          </label>
          <select
            id="domain-edit"
            name="domain"
            className="admin-input"
            defaultValue={entry.domain}
          >
            {KB_DOMAINS.map((d) => (
              <option key={d} value={d}>
                {getDomainLabel(d, "fr")}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="audience-edit">
            Audience
          </label>
          <select
            id="audience-edit"
            name="audience"
            className="admin-input"
            defaultValue={entry.audience}
          >
            {KB_AUDIENCES.map((a) => (
              <option key={a} value={a}>
                {getAudienceLabel(a, "fr")}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="conf-edit">
            Confidentialité
          </label>
          <select
            id="conf-edit"
            name="confidentiality"
            className="admin-input"
            defaultValue={entry.confidentiality}
          >
            {KB_CONFIDENTIALITIES.map((c) => (
              <option key={c} value={c}>
                {getConfidentialityLabel(c, "fr")}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="status-edit">
            Statut
          </label>
          <select
            id="status-edit"
            name="status"
            className="admin-input"
            defaultValue={entry.status}
          >
            {KB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {getStatusLabel(s, "fr")}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="pipe-edit">
            Pipeline
          </label>
          <select
            id="pipe-edit"
            name="pipelineStage"
            className="admin-input"
            defaultValue={entry.pipelineStage}
          >
            {KB_PIPELINE_STAGES.map((p) => (
              <option key={p} value={p}>
                {getPipelineStageLabel(p, "fr")}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="slug-edit">
            Slug racine
          </label>
          <input
            id="slug-edit"
            name="slug"
            className="admin-input"
            defaultValue={entry.slug}
            required
            pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
          />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="brief-edit">
            Brief éditorial
          </label>
          <textarea
            id="brief-edit"
            name="briefMarkdown"
            className="admin-input"
            rows={3}
            maxLength={5000}
            defaultValue={entry.briefMarkdown ?? ""}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="kw-edit">
            Mot-clé cible
          </label>
          <input
            id="kw-edit"
            name="targetKeyword"
            className="admin-input"
            maxLength={180}
            defaultValue={entry.targetKeyword ?? ""}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="wc-edit">
            Objectif mots
          </label>
          <input
            id="wc-edit"
            name="targetWordCount"
            type="number"
            className="admin-input"
            min={0}
            max={50000}
            defaultValue={entry.targetWordCount ?? ""}
          />
        </div>
        <div className="admin-form-actions">
          <button type="submit" disabled={metaPending} className="admin-button">
            {metaPending ? "Enregistrement..." : "Enregistrer métadonnées"}
          </button>
        </div>
        {metaState?.ok ? (
          <p className="admin-success" role="status">
            Sauvegardé
          </p>
        ) : null}
        {metaState?.error && metaState.error !== "validation" ? (
          <p className="admin-error" role="alert">
            {messageErreurKb(metaState.error)}
          </p>
        ) : null}
      </form>

      {/* ============= Contenu FR ============= */}
      <form action={bodyAction} className="admin-card admin-form">
        <h2 className="admin-h2">Contenu (FR)</h2>
        <input type="hidden" name="entryId" value={entry.id} />
        <div className="admin-field">
          <label className="admin-label" htmlFor="title-fr-edit">
            Titre FR
          </label>
          <input
            id="title-fr-edit"
            name="title"
            className="admin-input"
            defaultValue={entry.fr?.title ?? ""}
            minLength={0}
            maxLength={255}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="excerpt-fr-edit">
            Extrait FR
          </label>
          <textarea
            id="excerpt-fr-edit"
            name="excerpt"
            className="admin-input"
            rows={2}
            maxLength={500}
            defaultValue={entry.fr?.excerpt ?? ""}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label">Corps</label>
          <TiptapEditor name="body_fr" initialHtml={entry.fr?.body ?? ""} />
        </div>
        <div className="admin-form-actions">
          <button type="submit" disabled={bodyPending} className="admin-button">
            {bodyPending ? "Enregistrement..." : "Enregistrer brouillon"}
          </button>
        </div>
        {bodyState && "ok" in bodyState && bodyState.ok ? (
          <p className="admin-success" role="status">
            Sauvegardé{" "}
            {bodyState.savedAt ? new Date(bodyState.savedAt).toLocaleTimeString("fr-FR") : ""}
          </p>
        ) : null}
        {bodyState && "error" in bodyState && bodyState.error ? (
          <p className="admin-error" role="alert">
            {messageErreurKb(String(bodyState.error))}
          </p>
        ) : null}
      </form>

      {/* ============= Zone danger ============= */}
      <form action={delAction} className="admin-card admin-form admin-danger-zone">
        <h2 className="admin-h2">Zone danger</h2>
        <input type="hidden" name="entryId" value={entry.id} />
        <p className="admin-meta">
          L&apos;entrée part à la corbeille : elle reste récupérable pendant 30 jours, puis est
          effacée définitivement.
        </p>
        <button type="submit" disabled={delPending} className="admin-button-danger">
          {delPending ? "Suppression..." : "Supprimer l'entrée"}
        </button>
        {delState && "ok" in delState && delState.ok ? (
          <p className="admin-success" role="status">
            Supprimée.{" "}
            <a href={`/fr/${adminPrefix}/connaissances`} className="admin-link">
              Retour liste
            </a>
          </p>
        ) : null}
        {delState && "error" in delState && delState.error ? (
          <p className="admin-error" role="alert">
            {messageErreurKb(String(delState.error))}
          </p>
        ) : null}
      </form>
    </div>
  );
}
