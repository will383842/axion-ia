"use client";
// use-client: formulaire interactif (état de soumission, consentement, Turnstile,
// honeypot). Envoie la demande de tournage → submitPodcastRequestAction →
// PodcastRequest (status "new") + notification Telegram.
//
// Volontairement sobre : 7 champs natifs, aucune librairie de formulaire, aucun
// state lourd — budget perf AGENTS.md (INP ≤ 100 ms, First Load ≤ 75 KB gz).

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Mic } from "lucide-react";
import { submitPodcastRequestAction } from "@/features/podcast-request/actions";
import { useTurnstileToken } from "@/components/forms/TurnstileWidget";
import { HoneypotField } from "@/components/forms/HoneypotField";
import { PODCAST_ACTIVITY_MAX } from "@/lib/schemas/podcast-request-schema";

const FIELD =
  "border-border-strong bg-paper focus:border-terracotta focus:ring-terracotta/25 w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-colors focus:ring-4";
const LABEL = "text-fg mb-1.5 block text-sm font-medium";

/**
 * Origine du lead, lue à la soumission depuis `?src=` (le QR du flyer papier
 * pointe sur `/qr/podcast`, dont la destination configurée en console peut être
 * `…/fr/podcast?src=qr`). Lu à la volée plutôt que via `searchParams` côté page :
 * ça garderait la page dynamique et casserait son ISR (`revalidate = 86400`).
 * Valeurs inconnues → ignorées côté serveur (allow-list dans l'action).
 */
function readSourceParam(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("src");
}

export function PodcastRequestForm() {
  const locale = useLocale();
  const t = useTranslations("podcast.form");
  const [consent, setConsent] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const {
    token: turnstileToken,
    widget: turnstileWidget,
    reset: resetTurnstile,
  } = useTurnstileToken("podcast");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!consent) {
      setError(t("errorConsent"));
      return;
    }
    const form = e.currentTarget;
    setSubmitting(true);
    try {
      const fd = new FormData(form);
      fd.set("locale", locale);
      fd.set("consent", "true");
      const src = readSourceParam();
      if (src) fd.set("source", src);
      if (turnstileToken) fd.set("cf-turnstile-response", turnstileToken);
      const result = await submitPodcastRequestAction({ ok: false, error: "" }, fd);
      if (!result.ok) {
        resetTurnstile();
        setError(result.error || t("errorGeneric"));
        return;
      }
      setDone(true);
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div
        className="bg-paper border-terracotta/30 shadow-card rounded-3xl border-2 p-8 sm:p-10"
        role="status"
      >
        <div className="bg-halo-warm border-terracotta/30 mb-5 inline-flex items-center gap-2 rounded-full border px-4 py-1.5">
          <Check aria-hidden="true" strokeWidth={3} className="text-terracotta-deep h-4 w-4" />
          <span className="text-terracotta-deep text-sm font-semibold">{t("successTitle")}</span>
        </div>
        <p className="text-fg text-lg">{t("successBody")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <HoneypotField />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor="companyName" className={LABEL}>
            {t("companyName")}
          </label>
          <input
            id="companyName"
            name="companyName"
            required
            maxLength={200}
            autoComplete="organization"
            className={FIELD}
            disabled={submitting}
          />
        </div>
        <div>
          <label htmlFor="leaderName" className={LABEL}>
            {t("leaderName")}
          </label>
          <input
            id="leaderName"
            name="leaderName"
            required
            maxLength={120}
            autoComplete="name"
            className={FIELD}
            disabled={submitting}
          />
        </div>
        <div>
          <label htmlFor="email" className={LABEL}>
            {t("email")}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            maxLength={180}
            autoComplete="email"
            className={FIELD}
            disabled={submitting}
          />
        </div>
        <div>
          <label htmlFor="phone" className={LABEL}>
            {t("phone")}
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            maxLength={30}
            autoComplete="tel"
            className={FIELD}
            disabled={submitting}
          />
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div>
            <label htmlFor="city" className={LABEL}>
              {t("city")}
            </label>
            <input
              id="city"
              name="city"
              required
              maxLength={120}
              autoComplete="address-level2"
              className={FIELD}
              disabled={submitting}
            />
          </div>
          <div className="w-28">
            <label htmlFor="postalCode" className={LABEL}>
              {t("postalCode")}
            </label>
            <input
              id="postalCode"
              name="postalCode"
              required
              maxLength={10}
              inputMode="numeric"
              autoComplete="postal-code"
              className={FIELD}
              disabled={submitting}
            />
          </div>
        </div>
        <p className="text-fg-muted -mt-2 text-xs md:col-span-2">{t("locationHint")}</p>
        <div className="md:col-span-2">
          <label htmlFor="activity" className={LABEL}>
            {t("activity")}
          </label>
          <textarea
            id="activity"
            name="activity"
            required
            rows={4}
            maxLength={PODCAST_ACTIVITY_MAX}
            className={FIELD}
            disabled={submitting}
            placeholder={t("activityPlaceholder")}
          />
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={consent}
          onChange={(ev) => setConsent(ev.target.checked)}
          className="mt-1 h-4 w-4"
          disabled={submitting}
        />
        <span>{t("consent")}</span>
      </label>

      {turnstileWidget}

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="bg-terracotta hover:bg-terracotta-deep shadow-card inline-flex h-12 items-center gap-2 rounded-full px-8 text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:translate-y-0 disabled:opacity-60"
      >
        {submitting ? t("submitting") : t("submit")}
        {submitting ? null : <Mic aria-hidden="true" className="h-4 w-4" strokeWidth={2} />}
      </button>
      <p className="text-fg-muted text-xs">{t("privacyNote")}</p>
    </form>
  );
}
