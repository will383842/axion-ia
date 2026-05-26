"use client";
// use-client: composer modal interactif (états locaux subject/body + submit).

import { useState, useTransition } from "react";
import { replyToSubmissionAction } from "@/features/admin-submissions/reply-actions";

interface Props {
  readonly submissionId: string;
  readonly contactName: string;
  readonly contactEmail: string;
  /** Sujet initial suggéré (ex: "Re: <subject de la submission>"). */
  readonly defaultSubject?: string;
}

const TEMPLATES = [
  { value: "default", label: "Réponse par défaut", body: "" },
  {
    value: "audit_followup",
    label: "Suivi audit",
    body: "Bonjour,\n\nMerci pour votre demande d'audit IA. Je reviens vers vous pour planifier un premier échange et cadrer le périmètre.\n\nQuelles sont vos disponibilités cette semaine pour un appel de 30 minutes ?\n\nCordialement,",
  },
  {
    value: "intervention_followup",
    label: "Suivi intervention",
    body: "Bonjour,\n\nMerci pour votre demande d'intervention. Je vous propose les créneaux suivants :\n\n- ...\n- ...\n- ...\n\nDites-moi celui qui vous convient le mieux.\n\nCordialement,",
  },
  { value: "custom", label: "Personnalisée", body: "" },
] as const;

type TemplateValue = (typeof TEMPLATES)[number]["value"];

export function ReplyComposer({
  submissionId,
  contactName,
  contactEmail,
  defaultSubject,
}: Props): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState<TemplateValue>("default");
  const [subject, setSubject] = useState(defaultSubject ?? "Re: votre demande Axion-IA");
  const [body, setBody] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function onTemplateChange(value: TemplateValue) {
    setTemplate(value);
    const t = TEMPLATES.find((x) => x.value === value);
    if (t && t.body) setBody(t.body);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await replyToSubmissionAction({
        submissionId,
        subject,
        bodyMarkdown: body,
        template,
        ...(internalNote ? { internalNote } : {}),
      });
      if (r.ok) {
        setDone(true);
        setTimeout(() => {
          setOpen(false);
          setDone(false);
        }, 1500);
      } else {
        setError(r.error);
      }
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="admin-button">
        ✉️ Répondre
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reply-composer-title"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-12 sm:items-center sm:pt-4"
    >
      <div className="bg-paper relative w-full max-w-2xl rounded-lg border border-[color:var(--color-admin-border-default)] p-6 shadow-2xl">
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Fermer"
          className="absolute top-3 right-3 text-2xl leading-none text-[color:var(--color-admin-fg-muted)] hover:text-[color:var(--color-admin-fg-default)]"
        >
          ×
        </button>
        <h2 id="reply-composer-title" className="admin-h2">
          Répondre à {contactName}
        </h2>
        <p className="mt-1 text-sm text-[color:var(--color-admin-fg-muted)]">{contactEmail}</p>

        <form onSubmit={onSubmit} className="admin-form mt-4 space-y-4">
          <div className="admin-field">
            <label htmlFor="reply-template" className="admin-label">
              Template
            </label>
            <select
              id="reply-template"
              value={template}
              onChange={(e) => onTemplateChange(e.target.value as TemplateValue)}
              className="admin-input"
              disabled={isPending}
            >
              {TEMPLATES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-field">
            <label htmlFor="reply-subject" className="admin-label">
              Sujet
            </label>
            <input
              id="reply-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={500}
              required
              className="admin-input"
              disabled={isPending}
            />
          </div>

          <div className="admin-field">
            <label htmlFor="reply-body" className="admin-label">
              Message{" "}
              <span className="text-xs">(markdown léger : **gras**, *italique*, [lien](url))</span>
            </label>
            <textarea
              id="reply-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              maxLength={50_000}
              required
              className="admin-input admin-textarea font-mono text-sm"
              disabled={isPending}
            />
          </div>

          <div className="admin-field">
            <label htmlFor="reply-note" className="admin-label">
              Note interne <span className="text-xs">(privée, jamais envoyée)</span>
            </label>
            <textarea
              id="reply-note"
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              rows={2}
              maxLength={2000}
              className="admin-input admin-textarea text-sm"
              disabled={isPending}
            />
          </div>

          {error && (
            <p role="alert" className="admin-alert admin-alert-error">
              {error}
            </p>
          )}
          {done && (
            <p role="status" className="admin-alert admin-alert-success">
              ✓ Réponse envoyée, fermeture automatique...
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="admin-button-ghost"
              disabled={isPending}
            >
              Annuler
            </button>
            <button type="submit" className="admin-button" disabled={isPending || done}>
              {isPending ? "Envoi..." : "Envoyer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
