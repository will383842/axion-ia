"use client";
// use-client: useActionState + RHF for client-side validation feedback.

import * as React from "react";
import { useForm } from "react-hook-form";
import { useLocale } from "next-intl";
import { zodResolver } from "@hookform/resolvers/zod";
import { contactSchema, type ContactInput } from "@/lib/schemas/forms";
import { submitContactAction } from "@/features/contact/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTurnstileToken } from "@/components/forms/TurnstileWidget";
import { HoneypotField } from "@/components/forms/HoneypotField";

interface ContactFormProps {
  labels: {
    name: string;
    email: string;
    company: string;
    message: string;
    consent: string;
    submit: string;
    sending: string;
    success: string;
    failure: string;
  };
  /**
   * Message pré-rempli au chargement (ex : depuis `/interventions/demande?objet=...`).
   * Sprint 14.10.7 (Will 2026-05-11) — préfill contextuel pour les pages de
   * cadrage interventions qui dirigent vers ce formulaire avec un objet.
   */
  defaultMessage?: string;
}

export function ContactForm({ labels, defaultMessage }: ContactFormProps) {
  const locale = useLocale();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<ContactInput>({
    // See AuditForm — same TS drift workaround.
    resolver: zodResolver(contactSchema as never) as never,
    // `as never` aligne avec le pattern existant (drift TS RHF + Zod literal).
    ...(defaultMessage ? { defaultValues: { message: defaultMessage } as never } : {}),
  });
  const consent = watch("consent");
  const {
    token: turnstileToken,
    widget: turnstileWidget,
    reset: resetTurnstile,
  } = useTurnstileToken("contact");

  const [serverError, setServerError] = React.useState<string | null>(null);

  // E4 cert 2026-05-08 — wired to Sprint 15 server action `submitContactAction`
  // (rate-limit + Turnstile + Telegram + email queue).
  // Audit E2E 2026-05-11 P0-CONF-02 — Turnstile widget client câblé.
  async function onSubmit(values: ContactInput) {
    setServerError(null);
    try {
      const fd = new FormData();
      fd.set("name", values.name);
      fd.set("email", values.email);
      if (values.company) fd.set("company", values.company);
      fd.set("message", values.message);
      fd.set("consent", values.consent ? "true" : "false");
      fd.set("locale", locale);
      if (turnstileToken) fd.set("cf-turnstile-response", turnstileToken);

      const result = await submitContactAction({ ok: false, error: "" }, fd);
      if (!result.ok) {
        resetTurnstile();
        setServerError(result.error || labels.failure);
        throw new Error(result.error || labels.failure);
      }
    } catch (err) {
      if (!serverError) setServerError(labels.failure);
      throw err instanceof Error ? err : new Error(String(err));
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
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      <HoneypotField />
      <div className="grid gap-2">
        <Label htmlFor="contact-name">{labels.name}</Label>
        <Input id="contact-name" {...register("name")} aria-invalid={!!errors.name} />
        {errors.name ? (
          <p role="alert" className="text-accent-red text-xs">
            {errors.name.message}
          </p>
        ) : null}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="contact-email">{labels.email}</Label>
        <Input
          id="contact-email"
          type="email"
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
        <Label htmlFor="contact-company">{labels.company}</Label>
        <Input id="contact-company" {...register("company")} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="contact-message">{labels.message}</Label>
        <Textarea
          id="contact-message"
          rows={5}
          {...register("message")}
          aria-invalid={!!errors.message}
        />
        {errors.message ? (
          <p role="alert" className="text-accent-red text-xs">
            {errors.message.message}
          </p>
        ) : null}
      </div>
      <div className="flex items-start gap-3">
        <Checkbox
          id="contact-consent"
          checked={!!consent}
          onCheckedChange={(c) =>
            setValue("consent", c === true ? true : (false as never), { shouldValidate: true })
          }
        />
        <Label htmlFor="contact-consent" className="text-sm leading-relaxed">
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

      <Button type="submit" loading={isSubmitting} size="lg">
        {isSubmitting ? labels.sending : labels.submit} →
      </Button>
    </form>
  );
}
