"use client";
// use-client: 5-step wizard with local state + RHF validation per step +
// Zustand-style local store kept in component state (volatile, no persistence).

import * as React from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { useLocale } from "next-intl";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  auditStep1Schema,
  auditStep2Schema,
  auditStep3Schema,
  auditStep4Schema,
  auditStep5Schema,
  type AuditInput,
} from "@/lib/schemas/forms";
import { submitAuditAction } from "@/features/audit/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type Partial5<T> = Partial<T>;

interface AuditFormProps {
  labels: {
    stepLabels: ReadonlyArray<string>; // 5 entries
    next: string;
    previous: string;
    submit: string;
    sending: string;
    success: string;
    failure: string;
    sizeQuestion: string;
    sizes: ReadonlyArray<{ key: "tpe" | "pme" | "mid" | "enterprise"; label: string }>;
    modalityQuestion: string;
    modalityRemote: string;
    modalityOnsite: string;
    industryQuestion: string;
    industryPlaceholder: string;
    goalsQuestion: string;
    goalsPlaceholder: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    consentLabel: string;
  };
}

const SCHEMAS = [
  auditStep1Schema,
  auditStep2Schema,
  auditStep3Schema,
  auditStep4Schema,
  auditStep5Schema,
] as const;

export function AuditForm({ labels }: AuditFormProps) {
  const locale = useLocale();
  const [step, setStep] = React.useState(0);
  const [data, setData] = React.useState<Partial5<AuditInput>>({});
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const schema = SCHEMAS[step]!;
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    // zodResolver type signature drifts under TS exactOptionalPropertyTypes;
    // runtime contract is correct — cast keeps the code shippable.
    resolver: zodResolver(schema as never) as never,
    defaultValues: data as never,
  });
  const watchAll = watch();

  React.useEffect(() => {
    reset(data as never);
  }, [step, data, reset]);

  const onNext: SubmitHandler<unknown> = async (values) => {
    const next = { ...data, ...(values as object) };
    setData(next);
    if (step < SCHEMAS.length - 1) {
      setStep((s) => s + 1);
    } else {
      // E4 cert 2026-05-08 — wired to Sprint 15 `submitAuditAction`.
      setServerError(null);
      try {
        const fd = new FormData();
        const finalValues = next as Partial<AuditInput>;
        if (finalValues.size) fd.set("size", finalValues.size);
        if (finalValues.modality) fd.set("modality", finalValues.modality);
        if (finalValues.industry) fd.set("industry", finalValues.industry);
        if (finalValues.goals) fd.set("goals", finalValues.goals);
        if (finalValues.contact) fd.set("contact", finalValues.contact);
        if (finalValues.email) fd.set("email", finalValues.email);
        if (finalValues.phone) fd.set("phone", finalValues.phone);
        if (finalValues.companyName) fd.set("companyName", finalValues.companyName);
        fd.set("consent", finalValues.consent ? "true" : "false");
        fd.set("locale", locale);

        const result = await submitAuditAction({ ok: false, error: "" }, fd);
        if (!result.ok) {
          setServerError(result.error || labels.failure);
          return;
        }
        setDone(true);
      } catch {
        setServerError(labels.failure);
      }
    }
  };

  if (done) {
    return (
      <Alert variant="success" role="status">
        <AlertDescription>{labels.success}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      {/* Progress bar */}
      <ol
        role="list"
        aria-label="progress"
        className="flex flex-wrap items-center gap-2 text-xs tracking-wide uppercase"
      >
        {labels.stepLabels.map((s, i) => (
          <li
            key={i}
            aria-current={i === step ? "step" : undefined}
            className={cn(
              "rounded-sm border px-2.5 py-1.5",
              i === step
                ? "border-primary bg-primary text-primary-fg"
                : i < step
                  ? "border-primary text-primary"
                  : "border-border text-fg-muted",
            )}
          >
            <span className="tabular-nums">{String(i + 1).padStart(2, "0")}</span> · {s}
          </li>
        ))}
      </ol>

      <form onSubmit={handleSubmit(onNext)} noValidate className="space-y-6">
        {step === 0 ? (
          <fieldset className="space-y-3">
            <legend className="text-fg text-base font-semibold">{labels.sizeQuestion}</legend>
            <RadioGroup
              value={(watchAll as { size?: string }).size ?? ""}
              onValueChange={(v) => setValue("size" as never, v as never, { shouldValidate: true })}
              aria-label={labels.sizeQuestion}
              aria-invalid={!!errors["size" as never]}
            >
              {labels.sizes.map((s) => (
                <div key={s.key} className="flex items-center gap-2">
                  <RadioGroupItem value={s.key} id={`size-${s.key}`} />
                  <Label htmlFor={`size-${s.key}`}>{s.label}</Label>
                </div>
              ))}
            </RadioGroup>
            {errors["size" as never] ? (
              <p role="alert" className="text-accent-red text-xs">
                {(errors["size" as never] as { message?: string })?.message}
              </p>
            ) : null}
          </fieldset>
        ) : null}

        {step === 1 ? (
          <fieldset className="space-y-3">
            <legend className="text-fg text-base font-semibold">{labels.modalityQuestion}</legend>
            <RadioGroup
              value={(watchAll as { modality?: string }).modality ?? ""}
              onValueChange={(v) =>
                setValue("modality" as never, v as never, { shouldValidate: true })
              }
              aria-label={labels.modalityQuestion}
              aria-invalid={!!errors["modality" as never]}
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="remote" id="m-remote" />
                <Label htmlFor="m-remote">{labels.modalityRemote}</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="onsite" id="m-onsite" />
                <Label htmlFor="m-onsite">{labels.modalityOnsite}</Label>
              </div>
            </RadioGroup>
          </fieldset>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="industry">{labels.industryQuestion}</Label>
              <Input
                id="industry"
                placeholder={labels.industryPlaceholder}
                aria-invalid={!!errors["industry" as never]}
                {...register("industry" as never)}
              />
              {errors["industry" as never] ? (
                <p role="alert" className="text-accent-red text-xs">
                  {(errors["industry" as never] as { message?: string })?.message}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="goals">{labels.goalsQuestion}</Label>
              <Textarea
                id="goals"
                rows={5}
                placeholder={labels.goalsPlaceholder}
                aria-invalid={!!errors["goals" as never]}
                {...register("goals" as never)}
              />
              {errors["goals" as never] ? (
                <p role="alert" className="text-accent-red text-xs">
                  {(errors["goals" as never] as { message?: string })?.message}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="contact-name">{labels.contactName}</Label>
              <Input
                id="contact-name"
                aria-invalid={!!errors["contact" as never]}
                {...register("contact" as never)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact-email">{labels.contactEmail}</Label>
              <Input
                id="contact-email"
                type="email"
                aria-invalid={!!errors["email" as never]}
                {...register("email" as never)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact-phone">{labels.contactPhone}</Label>
              <Input
                id="contact-phone"
                type="tel"
                aria-invalid={!!errors["phone" as never]}
                {...register("phone" as never)}
              />
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="flex items-start gap-3">
            <Checkbox
              id="audit-consent"
              checked={(watchAll as { consent?: boolean }).consent === true}
              onCheckedChange={(c) =>
                setValue("consent" as never, (c === true ? true : false) as never, {
                  shouldValidate: true,
                })
              }
            />
            <Label htmlFor="audit-consent" className="text-sm leading-relaxed">
              {labels.consentLabel}
            </Label>
          </div>
        ) : null}

        {serverError ? (
          <Alert variant="danger" role="alert">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {step > 0 ? (
            <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
              ← {labels.previous}
            </Button>
          ) : null}
          <Button type="submit" loading={isSubmitting}>
            {step < SCHEMAS.length - 1 ? `${labels.next} →` : `${labels.submit} →`}
          </Button>
        </div>
      </form>
    </div>
  );
}
