"use client";
// use-client: 4-step wizard with local state, similar to AuditForm.

import * as React from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  implementationStep1Schema,
  implementationStep2Schema,
  implementationStep3Schema,
  implementationStep4Schema,
  type ImplementationInput,
} from "@/lib/schemas/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const SCHEMAS = [
  implementationStep1Schema,
  implementationStep2Schema,
  implementationStep3Schema,
  implementationStep4Schema,
] as const;

type ProjectType =
  | "chatbot"
  | "processus"
  | "structuration"
  | "crm-erp"
  | "documents"
  | "agents"
  | "integrations"
  | "no-code"
  | "ia-custom";

type Budget = "lt-5k" | "5-15k" | "15-50k" | "gt-50k";

interface ImplementationFormProps {
  /** Pre-selects the project type (e.g. when the form is embedded on `/implementation/chatbot`). */
  initialType?: ProjectType;
  labels: {
    stepLabels: ReadonlyArray<string>; // 4 entries
    next: string;
    previous: string;
    submit: string;
    sending: string;
    success: string;
    failure: string;
    typeQuestion: string;
    typeOptions: ReadonlyArray<{ key: ProjectType; label: string }>;
    budgetQuestion: string;
    budgetOptions: ReadonlyArray<{ key: Budget; label: string }>;
    descriptionQuestion: string;
    descriptionPlaceholder: string;
    contactName: string;
    contactEmail: string;
    consent: string;
  };
}

export function ImplementationForm({ initialType, labels }: ImplementationFormProps) {
  const [step, setStep] = React.useState(0);
  const [data, setData] = React.useState<Partial<ImplementationInput>>(
    initialType ? { type: initialType } : {},
  );
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
    // See AuditForm — same TS drift workaround.
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
      setServerError(null);
      try {
        await new Promise((r) => setTimeout(r, 600));
        if (process.env.NODE_ENV !== "production") {
          console.warn("[implementation:submit:stub]", next);
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
            <legend className="text-fg text-base font-semibold">{labels.typeQuestion}</legend>
            <RadioGroup
              value={(watchAll as { type?: string }).type ?? ""}
              onValueChange={(v) => setValue("type" as never, v as never, { shouldValidate: true })}
              aria-label={labels.typeQuestion}
              aria-invalid={!!errors["type" as never]}
              className="grid gap-2 sm:grid-cols-2"
            >
              {labels.typeOptions.map((o) => (
                <div key={o.key} className="flex items-center gap-2">
                  <RadioGroupItem value={o.key} id={`type-${o.key}`} />
                  <Label htmlFor={`type-${o.key}`}>{o.label}</Label>
                </div>
              ))}
            </RadioGroup>
            {errors["type" as never] ? (
              <p role="alert" className="text-accent-red text-xs">
                {(errors["type" as never] as { message?: string })?.message}
              </p>
            ) : null}
          </fieldset>
        ) : null}

        {step === 1 ? (
          <fieldset className="space-y-3">
            <legend className="text-fg text-base font-semibold">{labels.budgetQuestion}</legend>
            <RadioGroup
              value={(watchAll as { budget?: string }).budget ?? ""}
              onValueChange={(v) =>
                setValue("budget" as never, v as never, { shouldValidate: true })
              }
              aria-label={labels.budgetQuestion}
              aria-invalid={!!errors["budget" as never]}
            >
              {labels.budgetOptions.map((o) => (
                <div key={o.key} className="flex items-center gap-2">
                  <RadioGroupItem value={o.key} id={`budget-${o.key}`} />
                  <Label htmlFor={`budget-${o.key}`}>{o.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </fieldset>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-2">
            <Label htmlFor="description">{labels.descriptionQuestion}</Label>
            <Textarea
              id="description"
              rows={6}
              placeholder={labels.descriptionPlaceholder}
              aria-invalid={!!errors["description" as never]}
              {...register("description" as never)}
            />
            {errors["description" as never] ? (
              <p role="alert" className="text-accent-red text-xs">
                {(errors["description" as never] as { message?: string })?.message}
              </p>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="contact-name">{labels.contactName}</Label>
              <Input
                id="contact-name"
                autoComplete="name"
                aria-invalid={!!errors["contact" as never]}
                {...register("contact" as never)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact-email">{labels.contactEmail}</Label>
              <Input
                id="contact-email"
                type="email"
                autoComplete="email"
                aria-invalid={!!errors["email" as never]}
                {...register("email" as never)}
              />
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="impl-consent"
                checked={(watchAll as { consent?: boolean }).consent === true}
                onCheckedChange={(c) =>
                  setValue("consent" as never, (c === true ? true : false) as never, {
                    shouldValidate: true,
                  })
                }
              />
              <Label htmlFor="impl-consent" className="text-sm leading-relaxed">
                {labels.consent}
              </Label>
            </div>
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
