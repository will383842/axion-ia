"use client";
// use-client: useActionState + RHF for client-side validation feedback.

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { contactSchema, type ContactInput } from "@/lib/schemas/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
}

export function ContactForm({ labels }: ContactFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<ContactInput>({
    // See AuditForm — same TS drift workaround.
    resolver: zodResolver(contactSchema as never) as never,
  });
  const consent = watch("consent");

  const [serverError, setServerError] = React.useState<string | null>(null);

  async function onSubmit(values: ContactInput) {
    setServerError(null);
    try {
      // Sprint 17 wires the server action; for now we log and pretend.
      await new Promise((r) => setTimeout(r, 600));

      console.warn("[contact:submit:stub]", values);
    } catch {
      setServerError(labels.failure);
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

      <Button type="submit" loading={isSubmitting} size="lg">
        {isSubmitting ? labels.sending : labels.submit} →
      </Button>
    </form>
  );
}
