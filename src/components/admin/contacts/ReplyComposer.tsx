"use client";
// use-client: composer modal interactif (états locaux subject/body + submit).
// Fiche I2-1 : plus de second moteur de mise en forme dans le navigateur. L'aperçu est
// celui du serveur (« Voir l'aperçu exact »), masqué et inerte ; « Envoyer » reste verrouillé
// tant que l'aperçu du contenu en cours n'a pas été vu.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LecteurEmail } from "@/components/admin/ui/LecteurEmail";
import type { ApercuLecteur } from "@/lib/email/apercu-lecteur";
import {
  apercuReponseDemandeAction,
  replyToSubmissionAction,
  retryFailedReplyAction,
  getReplyDeliveryStatusAction,
} from "@/features/admin-submissions/reply-actions";

/** Machine d'états de l'envoi d'une réponse (feedback honnête à l'admin). */
type ReplyUiState =
  | { phase: "idle" }
  | { phase: "sending" }
  | { phase: "queued"; replyId: string; background?: boolean }
  | { phase: "sent" }
  | { phase: "failed"; replyId?: string; message: string };

/** Codes d'erreur bruts → messages FR lisibles. */
const REPLY_ERROR_LABELS: Record<string, string> = {
  submission_not_found: "Demande introuvable.",
  render_failed: "Erreur de génération de l'email.",
  db_failed: "Échec d'enregistrement en base.",
  enqueue_failed: "File d'envoi indisponible — réessayez dans un instant.",
  invalid_recipient: "Adresse du destinataire illisible (à vérifier avec l'admin).",
  unauthorized: "Session expirée — reconnectez-vous.",
  forbidden: "Droits insuffisants.",
  not_found: "Réponse introuvable.",
  not_retryable: "Cette réponse n'est pas rejouable.",
};
function replyErrorLabel(code: string): string {
  return REPLY_ERROR_LABELS[code] ?? `Échec de l'envoi (${code}).`;
}

const MESSAGE_PERTE_BROUILLON = "Fermer sans envoyer ? Le message en cours sera perdu.";

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
    body: "Bonjour,\n\nMerci pour votre demande d'audit IA. Je reviens vers vous pour planifier un premier échange et cadrer le périmètre.\n\nQuelles sont vos disponibilités cette semaine pour un appel de 45 minutes ?\n\nCordialement,",
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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState<TemplateValue>("default");
  const [subject, setSubject] = useState(defaultSubject ?? "Re: votre demande Axion-IA");
  const [body, setBody] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [, startTransition] = useTransition();
  const [state, setState] = useState<ReplyUiState>({ phase: "idle" });
  // Aperçu serveur + empreinte locale de la saisie qui l'a produit : « Envoyer » ne s'active
  // que si l'empreinte de la saisie en cours est la même.
  const [apercu, setApercu] = useState<{ empreinte: string; contenu: ApercuLecteur } | null>(null);
  const [apercuEnCours, setApercuEnCours] = useState(false);
  const [apercuErreur, setApercuErreur] = useState<string | null>(null);
  const empreinteCourante = JSON.stringify([subject, body]);
  const apercuAJour = apercu !== null && apercu.empreinte === empreinteCourante;

  // Le vrai « ✓ envoyée » vient du worker (envoi asynchrone). Tant qu'on est
  // « queued », on interroge le statut réel toutes les 2 s (max ~12 s) jusqu'à
  // sent/delivered (succès) ou failed/bounced (erreur). Au-delà → « en arrière-plan ».
  useEffect(() => {
    if (state.phase !== "queued" || state.background) return;
    const replyId = state.replyId;
    let attempts = 0;
    let cancelled = false;
    const timer = setInterval(async () => {
      attempts += 1;
      const st = await getReplyDeliveryStatusAction(replyId).catch(() => null);
      if (cancelled) return;
      if (st && (st.status === "sent" || st.status === "delivered")) {
        clearInterval(timer);
        setState({ phase: "sent" });
        router.refresh();
      } else if (st && (st.status === "failed" || st.status === "bounced")) {
        clearInterval(timer);
        setState({ phase: "failed", replyId, message: st.errorMsg ?? "L'envoi a échoué." });
        router.refresh();
      } else if (attempts >= 6) {
        clearInterval(timer);
        setState({ phase: "queued", replyId, background: true });
      }
    }, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [state, router]);

  const inputsDisabled =
    state.phase === "sending" || state.phase === "queued" || state.phase === "sent";

  function onTemplateChange(value: TemplateValue) {
    setTemplate(value);
    const t = TEMPLATES.find((x) => x.value === value);
    if (t && t.body) setBody(t.body);
  }

  function voirApercu() {
    const empreinte = empreinteCourante;
    setApercuEnCours(true);
    setApercuErreur(null);
    startTransition(async () => {
      const r = await apercuReponseDemandeAction({ submissionId, subject, bodyMarkdown: body });
      setApercuEnCours(false);
      if (r.ok) setApercu({ empreinte, contenu: r.apercu });
      else {
        setApercu(null);
        setApercuErreur(replyErrorLabel(r.error));
      }
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!apercuAJour) return;
    setState({ phase: "sending" });
    startTransition(async () => {
      const r = await replyToSubmissionAction({
        submissionId,
        subject,
        bodyMarkdown: body,
        template,
        ...(internalNote ? { internalNote } : {}),
      });
      if (r.ok) {
        setState({ phase: "queued", replyId: r.replyId });
        router.refresh();
      } else {
        setState({
          phase: "failed",
          ...(r.replyId ? { replyId: r.replyId } : {}),
          message: replyErrorLabel(r.error),
        });
      }
    });
  }

  function onRetry(replyId: string) {
    setState({ phase: "sending" });
    startTransition(async () => {
      const r = await retryFailedReplyAction(replyId);
      if (r.ok) {
        setState({ phase: "queued", replyId });
        router.refresh();
      } else {
        setState({
          phase: "failed",
          replyId,
          message: replyErrorLabel(r.error ?? "enqueue_failed"),
        });
      }
    });
  }

  /** Fermeture demandée par l'utilisateur : confirme avant de perdre un brouillon. */
  function demanderFermeture() {
    const brouillonEnCours =
      (state.phase === "idle" || state.phase === "failed") &&
      (body.trim() !== "" || internalNote.trim() !== "");
    if (brouillonEnCours && !window.confirm(MESSAGE_PERTE_BROUILLON)) return;
    onClose();
  }

  function onClose() {
    // 🔴 Fermer VIDE le brouillon : la confirmation dit « le message sera
    // perdu », et un message envoyé ne doit pas réapparaître prérempli (il
    // partirait une seconde fois). Les seuls appels à `onClose` sont la
    // fermeture confirmée et la fermeture après envoi.
    setBody("");
    setInternalNote("");
    setTemplate("default");
    setApercu(null);
    setApercuErreur(null);
    setState({ phase: "idle" });
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="admin-button">
        Répondre
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
      <div className="bg-paper relative max-h-[calc(100dvh-4rem)] w-full max-w-4xl overflow-y-auto rounded-lg border border-[color:var(--color-admin-border-default)] p-6 shadow-2xl">
        <button
          type="button"
          onClick={demanderFermeture}
          disabled={state.phase === "sending"}
          aria-label="Fermer"
          className="absolute top-3 right-3 text-2xl leading-none text-[color:var(--color-admin-fg-muted)] hover:text-[color:var(--color-admin-fg-default)] disabled:opacity-40"
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
              Modèle de réponse
            </label>
            <select
              id="reply-template"
              value={template}
              onChange={(e) => onTemplateChange(e.target.value as TemplateValue)}
              className="admin-input"
              disabled={inputsDisabled}
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
              disabled={inputsDisabled}
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
              rows={12}
              maxLength={50_000}
              required
              className="admin-input admin-textarea admin-input-mono"
              disabled={inputsDisabled}
            />
          </div>

          <div className="admin-field">
            <button
              type="button"
              onClick={voirApercu}
              className="admin-button-ghost"
              disabled={inputsDisabled || apercuEnCours || body.trim() === ""}
            >
              {apercuEnCours ? "Génération de l'aperçu…" : "Voir l'aperçu exact"}
            </button>
            {apercuErreur ? (
              <p role="alert" className="admin-alert admin-alert-error mt-2">
                {apercuErreur}
              </p>
            ) : null}
            {apercu && !apercuAJour ? (
              <p role="status" className="mt-2 text-sm text-[color:var(--color-admin-fg-muted)]">
                Le message a changé depuis l&apos;aperçu : regardez-le de nouveau avant
                d&apos;envoyer.
              </p>
            ) : null}
            {apercu ? (
              <div className="mt-3" aria-label="Aperçu exact du message">
                <LecteurEmail
                  apercu={apercu.contenu}
                  liensInertes
                  titre="Aperçu exact de la réponse"
                />
              </div>
            ) : null}
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
              className="admin-input admin-textarea"
              disabled={inputsDisabled}
            />
          </div>

          {state.phase === "queued" && (
            <p role="status" aria-live="polite" className="admin-alert admin-alert-info">
              {state.background
                ? "Réponse enregistrée. L'envoi se poursuit en arrière-plan — voir l'historique ci-dessous."
                : "Réponse enregistrée, envoi en cours…"}
            </p>
          )}
          {state.phase === "sent" && (
            <p role="status" aria-live="polite" className="admin-alert admin-alert-success">
              Réponse envoyée à {contactName}.
            </p>
          )}
          {state.phase === "failed" && (
            <p role="alert" className="admin-alert admin-alert-error">
              {state.message}
            </p>
          )}

          {/* Pied collant : sur un écran peu haut, « Envoyer » reste toujours visible. */}
          <div className="bg-paper sticky bottom-0 -mx-6 flex justify-end gap-2 border-t border-[color:var(--color-admin-border-default)] px-6 py-3">
            {state.phase === "queued" || state.phase === "sent" ? (
              <button type="button" onClick={onClose} className="admin-button">
                Fermer
              </button>
            ) : state.phase === "failed" ? (
              <>
                <button type="button" onClick={demanderFermeture} className="admin-button-ghost">
                  Fermer
                </button>
                {state.replyId ? (
                  <button
                    type="button"
                    onClick={() => onRetry(state.replyId as string)}
                    className="admin-button"
                  >
                    Réessayer
                  </button>
                ) : (
                  <button type="submit" className="admin-button" disabled={!apercuAJour}>
                    Renvoyer
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={demanderFermeture}
                  className="admin-button-ghost"
                  disabled={state.phase === "sending"}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="admin-button"
                  disabled={state.phase === "sending" || !apercuAJour}
                >
                  {state.phase === "sending" ? "Envoi…" : "Envoyer"}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
