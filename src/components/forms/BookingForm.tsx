"use client";
// use-client: posts to createBookingAction and reads the slot passed by the
// parent calendar via props — needs interactive submit UI.

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { bookingSchema, type BookingInput } from "@/lib/schemas/forms";
import { createBookingAction } from "@/features/booking/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTurnstileToken } from "@/components/forms/TurnstileWidget";
import { trackEvent } from "@/components/analytics/Plausible";

interface BookingFormProps {
  /** Pre-filled by the calendar selection. */
  date: string; // ISO yyyy-mm-dd
  time: string; // hh:mm
  /** Slug intervention sélectionnée par le parent — passé à createBookingAction. */
  interventionType?: BookingInput["interventionType"];
  /** Effectif estimé (defaut 1 si non précisé). */
  participantsCount?: number;
  /** Locale FR/EN (défaut FR) — passée au Server Action pour email + tracking. */
  locale?: "fr" | "en";
  onCancel?: () => void;
  labels: {
    headerPrefix: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    consent: string;
    cancel: string;
    submit: string;
    sending: string;
    success: string;
    failure: string;
  };
}

export function BookingForm({
  date,
  time,
  interventionType = "essentielle",
  participantsCount = 1,
  locale = "fr",
  onCancel,
  labels,
}: BookingFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<BookingInput>({
    resolver: zodResolver(bookingSchema as never) as never,
    defaultValues: {
      date,
      time,
      interventionType,
      participantsCount,
    } as never,
  });
  const consent = watch("consent");
  const {
    token: turnstileToken,
    widget: turnstileWidget,
    reset: resetTurnstile,
  } = useTurnstileToken("booking");
  const [serverError, setServerError] = React.useState<string | null>(null);
  // Méta-cert 2026-05-15 AGENT 12 P0 OWASP A04 — UUID v4 stable au mount
  // pour neutraliser double-submit (clic rapide / retry réseau / prefetch).
  // Le Server Action `createBookingAction` check unicité avant insert :
  // si Booking existe déjà avec cette clé → retourne l'existant sans recréer.
  // `crypto.randomUUID()` est natif browser (Chrome 92+, Firefox 95+, Safari 15.4+) —
  // pas de dépendance externe.
  const idempotencyKey = React.useRef<string>(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `fallback-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  // Keep date/time in sync if the parent re-selects.
  React.useEffect(() => {
    setValue("date", date as never);
    setValue("time", time as never);
    setValue("interventionType", interventionType as never);
    setValue("participantsCount", participantsCount as never);
  }, [date, time, interventionType, participantsCount, setValue]);

  async function onSubmit(values: BookingInput) {
    setServerError(null);
    try {
      const formData = new FormData();
      formData.set("date", values.date);
      formData.set("time", values.time);
      formData.set("contact", values.contact);
      formData.set("email", values.email);
      if (values.phone) formData.set("phone", values.phone);
      formData.set("consent", values.consent ? "true" : "false");
      formData.set("interventionType", values.interventionType);
      formData.set("participantsCount", String(values.participantsCount));
      formData.set("locale", locale);
      formData.set("idempotencyKey", idempotencyKey.current);
      if (turnstileToken) formData.set("cf-turnstile-response", turnstileToken);

      const res = await createBookingAction({ ok: false, error: "" }, formData);
      if (!res.ok) {
        resetTurnstile();
        setServerError(res.error || labels.failure);
        trackEvent("Booking Failed", {
          props: {
            intervention: values.interventionType,
            participants: values.participantsCount,
            locale,
          },
        });
      } else {
        trackEvent("Booking Submitted", {
          props: {
            intervention: values.interventionType,
            participants: values.participantsCount,
            locale,
          },
        });
      }
    } catch {
      setServerError(labels.failure);
      trackEvent("Booking Failed", {
        props: { intervention: values.interventionType, locale, reason: "network" },
      });
    }
  }

  if (isSubmitSuccessful && !serverError) {
    return (
      <Alert variant="success" role="status">
        <AlertDescription>{labels.success}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <p className="text-fg text-sm font-medium" aria-live="polite">
        {labels.headerPrefix} <span className="tabular-nums">{date}</span>{" "}
        <span className="tabular-nums">{time}</span>
      </p>

      {/* Hidden but registered so RHF + Zod see them. */}
      <input type="hidden" {...register("date")} />
      <input type="hidden" {...register("time")} />

      <div className="grid gap-2">
        <Label htmlFor="booking-name">{labels.contactName}</Label>
        <Input
          id="booking-name"
          autoComplete="name"
          {...register("contact")}
          aria-invalid={!!errors.contact}
        />
        {errors.contact ? (
          <p role="alert" className="text-accent-red text-xs">
            {errors.contact.message}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="booking-email">{labels.contactEmail}</Label>
        <Input
          id="booking-email"
          type="email"
          autoComplete="email"
          {...register("email")}
          aria-invalid={!!errors.email}
        />
        {errors.email ? (
          <p role="alert" className="text-accent-red text-xs">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="booking-phone">{labels.contactPhone}</Label>
        <Input
          id="booking-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          {...register("phone")}
        />
      </div>

      <div className="flex items-start gap-3">
        <Checkbox
          id="booking-consent"
          checked={!!consent}
          onCheckedChange={(c) =>
            setValue("consent", c === true ? true : (false as never), { shouldValidate: true })
          }
        />
        <Label htmlFor="booking-consent" className="text-sm leading-relaxed">
          {labels.consent}
        </Label>
      </div>
      {errors.consent ? (
        <p role="alert" className="text-accent-red text-xs">
          {errors.consent.message}
        </p>
      ) : null}

      {serverError ? (
        <Alert variant="danger" role="alert">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      {turnstileWidget}

      <div className="flex flex-wrap gap-3">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            ← {labels.cancel}
          </Button>
        ) : null}
        <Button type="submit" loading={isSubmitting} size="lg">
          {isSubmitting ? labels.sending : labels.submit} →
        </Button>
      </div>
    </form>
  );
}
