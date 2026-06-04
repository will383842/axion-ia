"use client";
// use-client: UI interactive (état ouvert/fermé, focus, saisie, streaming).
//
// ChatWidget (T-08) — bulle bas-droite + panneau de discussion.
//
// Contraintes Web Vitals (AGENTS.md) :
//  - CLS 0 : bulle et panneau en `position: fixed` → hors flux, aucun reflow
//    de la page. Aucune dimension n'est poussée dans le layout SSR.
//  - Hors First Load : ce composant est chargé en chunk séparé via
//    `ChatWidgetMount` (next/dynamic ssr:false + requestIdleCallback).
//
// Accessibilité (doc 08 §3 / WCAG) :
//  - Bulle = <button> avec aria-label + aria-expanded + aria-controls.
//  - Panneau = role="dialog" + aria-label ; focus déplacé sur la saisie à
//    l'ouverture ; Échap ferme et rend le focus à la bulle.
//  - Fil de messages en aria-live="polite" (annonce du streaming).
//  - Mention explicite « vous dialoguez avec une IA » (transparence + doc 09).

import * as React from "react";
import { useTranslations } from "next-intl";
import { trackFunnel } from "@/lib/tracking";
import { useChatStream } from "./useChatStream";
import { LeadForm } from "./LeadForm";
import type { ChatCard, ChatMessage } from "./types";

export function ChatWidget() {
  const t = useTranslations("chatbot");
  const [open, setOpen] = React.useState(false);
  const { messages, status, send, sessionUuid } = useChatStream();
  const [draft, setDraft] = React.useState("");
  // Mini-formulaire de capture de lead (flux de consentement RGPD).
  const [showLead, setShowLead] = React.useState(false);

  const bubbleRef = React.useRef<HTMLButtonElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const logRef = React.useRef<HTMLDivElement>(null);
  // La bulle est démontée pendant que le panneau est ouvert ; pour rendre le
  // focus à la fermeture il faut attendre son re-montage (effet, pas appel
  // direct dans le handler où bubbleRef est encore null).
  const restoreFocusRef = React.useRef(false);
  // T-22 funnel Plausible : dédup des events (Started une fois, RDV/Escalated par message).
  const startedRef = React.useRef(false);
  const reportedRef = React.useRef<Set<string>>(new Set());

  // Focus sur la saisie à l'ouverture ; rend le focus à la bulle à la fermeture.
  React.useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    } else if (restoreFocusRef.current) {
      restoreFocusRef.current = false;
      bubbleRef.current?.focus();
    }
  }, [open]);

  // Auto-scroll vers le dernier message au fil du streaming.
  React.useEffect(() => {
    if (open && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages, open]);

  // T-22 — funnel Plausible : émet « Chat RDV » / « Chat Escalated » quand un
  // message assistant porte ces signaux (une fois par message, no-op sans plausible).
  React.useEffect(() => {
    for (const m of messages) {
      if (m.role === "user" || reportedRef.current.has(m.id)) continue;
      if (m.rdvUrl) {
        reportedRef.current.add(m.id);
        trackFunnel("Chat RDV");
      } else if (m.escalated) {
        reportedRef.current.add(m.id);
        trackFunnel("Chat Escalated");
      }
    }
  }, [messages]);

  const close = React.useCallback(() => {
    restoreFocusRef.current = true;
    setOpen(false);
  }, []);

  // Échap ferme le panneau, quel que soit l'élément focalisé dans le widget
  // (listener document-level = pas de handler clavier sur un <div> non-interactif).
  React.useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft;
    setDraft("");
    // T-22 — « Chat Started » au premier message de la session (une seule fois).
    if (!startedRef.current) {
      startedRef.current = true;
      trackFunnel("Chat Started");
    }
    void send(text);
  }

  return (
    <div className="fixed right-4 bottom-4 z-40 print:hidden">
      {open ? (
        <section
          role="dialog"
          aria-label={t("title")}
          className="border-border bg-bg flex h-[min(34rem,calc(100vh-2rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border shadow-2xl"
        >
          <header className="border-border bg-bg-soft flex items-center justify-between gap-2 border-b px-4 py-3">
            <div className="flex flex-col">
              <p className="text-fg text-sm font-semibold tracking-tight">{t("title")}</p>
              <p className="text-fg-soft text-[11px] leading-tight">{t("aiDisclaimer")}</p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label={t("closeLabel")}
              className="text-fg-soft hover:text-fg focus-visible:ring-terracotta rounded-md p-1 transition focus-visible:ring-2 focus-visible:outline-none"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="none">
                <path
                  d="M5 5l10 10M15 5L5 15"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </header>

          <div
            ref={logRef}
            aria-live="polite"
            aria-atomic="false"
            className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3"
          >
            {showLead ? (
              <LeadForm sessionUuid={sessionUuid} onClose={() => setShowLead(false)} />
            ) : (
              <>
                <p className="text-fg-soft text-sm leading-snug">{t("intro")}</p>
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} t={t} />
                ))}
                {status === "error" ? (
                  <p role="status" className="text-terracotta-deep text-sm">
                    {t("errorRetry")}
                  </p>
                ) : null}
              </>
            )}
          </div>

          {!showLead ? (
            <form
              onSubmit={onSubmit}
              className="border-border bg-bg flex flex-col gap-2 border-t px-3 py-3"
            >
              <div className="flex items-center gap-2">
                <label htmlFor="chatbot-input" className="sr-only">
                  {t("placeholder")}
                </label>
                <input
                  id="chatbot-input"
                  ref={inputRef}
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={t("placeholder")}
                  maxLength={2000}
                  autoComplete="off"
                  className="border-border bg-bg-soft text-fg focus-visible:ring-terracotta min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                />
                <button
                  type="submit"
                  disabled={status === "streaming" || draft.trim().length === 0}
                  className="bg-terracotta-deep hover:bg-terracotta focus-visible:ring-terracotta shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-white transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
                >
                  {t("sendLabel")}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowLead(true)}
                className="text-terracotta self-start text-xs hover:underline"
              >
                {t("leadCta")}
              </button>
            </form>
          ) : null}
        </section>
      ) : (
        <button
          ref={bubbleRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          aria-controls="chatbot-dialog"
          aria-label={t("bubbleLabel")}
          className="bg-terracotta-deep hover:bg-terracotta focus-visible:ring-terracotta flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" fill="none">
            <path
              d="M4 5.5A2.5 2.5 0 016.5 3h11A2.5 2.5 0 0120 5.5v7A2.5 2.5 0 0117.5 15H9l-4 4v-4H6.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

function MessageBubble({
  message,
  t,
}: {
  message: ChatMessage;
  t: ReturnType<typeof useTranslations<"chatbot">>;
}) {
  const isUser = message.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex flex-col gap-2"}>
      <div
        className={
          isUser
            ? "bg-terracotta-deep max-w-[85%] rounded-2xl rounded-br-sm px-3 py-2 text-sm text-white"
            : "bg-bg-soft text-fg max-w-[95%] rounded-2xl rounded-bl-sm px-3 py-2 text-sm whitespace-pre-wrap"
        }
      >
        {message.text || (message.pending ? <span className="opacity-60">…</span> : null)}
      </div>

      {!isUser && message.cards && message.cards.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {message.cards.map((card) => (
            <li key={card.id}>
              <OfferCard card={card} showLink={message.sendLinks ?? false} t={t} />
            </li>
          ))}
        </ul>
      ) : null}

      {!isUser && message.rdvUrl ? (
        <a
          href={message.rdvUrl}
          className="border-terracotta-deep text-terracotta-deep hover:bg-terracotta-deep inline-flex w-fit items-center rounded-lg border px-3 py-1.5 text-sm font-medium transition hover:text-white"
        >
          {t("rdvCta")}
        </a>
      ) : null}

      {!isUser && message.escalated ? (
        <p className="text-fg-soft text-xs italic">{t("escalated")}</p>
      ) : null}

      {!isUser && message.sources && message.sources.length > 0 ? (
        <p className="text-fg-soft text-[11px] leading-tight">
          {t("sourcesLabel")} : {message.sources.map((s) => s.sourceRef).join(", ")}
        </p>
      ) : null}
    </div>
  );
}

function OfferCard({
  card,
  showLink,
  t,
}: {
  card: ChatCard;
  showLink: boolean;
  t: ReturnType<typeof useTranslations<"chatbot">>;
}) {
  const meta = [card.dureeFr, card.effectifFr].filter(Boolean).join(" · ");
  return (
    <div className="border-border bg-bg flex flex-col gap-1 rounded-xl border px-3 py-2">
      <p className="text-fg text-sm font-semibold">{card.titre}</p>
      <p className="text-fg-soft text-xs">
        {card.prix}
        {meta ? ` — ${meta}` : ""}
      </p>
      {showLink ? (
        <a
          href={card.urlFR}
          className="text-terracotta-deep hover:text-terracotta mt-1 text-xs font-medium underline"
        >
          {t("offerCta")}
        </a>
      ) : null}
    </div>
  );
}
