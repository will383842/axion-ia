"use client";
// use-client: react-hook-form needs client runtime for register/handleSubmit.

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { newsletterSchema, type NewsletterInput } from "@/lib/schemas/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface NewsletterFormProps {
  labels: {
    email: string;
    consent: string;
    submit: string;
    sending: string;
    success: string;
    failure: string;
  };
  variant?: "inline" | "stacked";
}

export function NewsletterForm({ labels, variant = "stacked" }: NewsletterFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<NewsletterInput>({
    // Same TS drift workaround as the other forms (zodResolver + exactOptionalPropertyTypes).
    resolver: zodResolver(newsletterSchema as never) as never,
  });
  const consent = watch("consent");
  const [serverError, setServerError] = React.useState<string | null>(null);

  async function onSubmit(values: NewsletterInput) {
    setServerError(null);
    try {
      await new Promise((r) => setTimeout(r, 400));
      console.warn("[newsletter:submit:stub]", values);
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

  const inline = variant === "inline";

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className={inline ? "flex flex-col gap-3 sm:flex-row sm:items-end" : "space-y-4"}
    >
      <div className="grid flex-1 gap-2">
        <Label htmlFor="newsletter-email">{labels.email}</Label>
        <Input
          id="newsletter-email"
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

      <Button type="submit" loading={isSubmitting} className={inline ? "sm:self-end" : undefined}>
        {isSubmitting ? labels.sending : labels.submit}
      </Button>

      <div className="flex items-start gap-3 sm:basis-full">
        <Checkbox
          id="newsletter-consent"
          checked={!!consent}
          onCheckedChange={(c) =>
            setValue("consent", c === true ? true : (false as never), { shouldValidate: true })
          }
        />
        <Label htmlFor="newsletter-consent" className="text-fg-soft text-xs leading-relaxed">
          {labels.consent}
        </Label>
      </div>
      {errors.consent ? (
        <p role="alert" className="text-accent-red text-xs sm:basis-full">
          {errors.consent.message}
        </p>
      ) : null}

      {serverError ? (
        <Alert variant="danger" role="alert" className="sm:basis-full">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}
