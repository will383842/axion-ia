"use client";
// use-client: useActionState + react-hook-form pour validation client + Turnstile.
//
// Sprint X.5bis (Booking V1) — formulaire parcours B « devis qualifié ».
// Pattern miroir de ContactForm.tsx mais avec 10 champs qualifiants.

import * as React from "react";
import { useForm } from "react-hook-form";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { quoteRequestSchema, type QuoteRequestInput } from "@/lib/schemas/forms";
import { submitQuoteRequestAction } from "@/features/quote-request/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTurnstileToken } from "@/components/forms/TurnstileWidget";

export interface QuoteRequestFormLabels {
  // Sections
  sectionCompany: string;
  sectionContact: string;
  sectionProject: string;
  sectionConsents: string;
  // Champs entreprise
  companyName: string;
  companySize: string;
  companySizeOptions: { tpe: string; pme: string; eti: string; grande_entreprise: string };
  companySector: string;
  companySectorPlaceholder: string;
  // Champs contact
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  // Champs projet
  contextBusiness: string;
  contextBusinessHint: string;
  budgetIndicative: string;
  budgetIndicativePlaceholder: string;
  timingWeeks: string;
  timingWeeksOptions: { "0-4": string; "4-8": string; "8-12": string; "12+": string };
  city: string;
  willingToTravel: string;
  participantsEstimate: string;
  // Consentements
  consentTerms: string;
  consentGdpr: string;
  // Submit
  submit: string;
  sending: string;
  failure: string;
}

interface QuoteRequestFormProps {
  labels: QuoteRequestFormLabels;
  /** Préfill depuis `?intervention=<slug>`. */
  defaultInterventionSlug?: string;
}

export function QuoteRequestForm({ labels, defaultInterventionSlug }: QuoteRequestFormProps) {
  const locale = useLocale();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<QuoteRequestInput>({
    resolver: zodResolver(quoteRequestSchema as never) as never,
    ...(defaultInterventionSlug
      ? ({ defaultValues: { interventionSlug: defaultInterventionSlug } } as never)
      : {}),
  });
  const consentTerms = watch("consentTerms");
  const consentGdpr = watch("consentGdpr");
  const willingToTravel = watch("willingToTravel");

  const {
    token: turnstileToken,
    widget: turnstileWidget,
    reset: resetTurnstile,
  } = useTurnstileToken("quote-request");

  const [serverError, setServerError] = React.useState<string | null>(null);

  async function onSubmit(values: QuoteRequestInput) {
    setServerError(null);
    const fd = new FormData();
    fd.set("companyName", values.companyName);
    fd.set("companySize", values.companySize);
    fd.set("companySector", values.companySector);
    fd.set("contactName", values.contactName);
    fd.set("contactEmail", values.contactEmail);
    fd.set("contactPhone", values.contactPhone);
    if (values.interventionSlug) fd.set("interventionSlug", values.interventionSlug);
    fd.set("contextBusiness", values.contextBusiness);
    if (values.budgetIndicative) fd.set("budgetIndicative", values.budgetIndicative);
    if (values.timingWeeks) fd.set("timingWeeks", values.timingWeeks);
    fd.set("city", values.city);
    fd.set("willingToTravel", values.willingToTravel ? "true" : "false");
    if (values.participantsEstimate !== undefined) {
      fd.set("participantsEstimate", String(values.participantsEstimate));
    }
    fd.set("consentTerms", values.consentTerms ? "true" : "false");
    fd.set("consentGdpr", values.consentGdpr ? "true" : "false");
    fd.set("locale", locale);
    if (turnstileToken) fd.set("cf-turnstile-response", turnstileToken);
    // Honeypot — vide volontairement.

    const result = await submitQuoteRequestAction({ ok: false, error: "" }, fd);
    if (!result.ok) {
      resetTurnstile();
      setServerError(result.error || labels.failure);
      return;
    }
    // Redirige vers la page de confirmation.
    router.push("/demande-devis/confirmation" as never);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-8">
      {/* Honeypot anti-bot */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", opacity: 0 }}
      />

      {/* === Section Entreprise === */}
      <section className="space-y-4">
        <h2 className="text-fg text-lg font-semibold tracking-tight">{labels.sectionCompany}</h2>
        <div className="grid gap-2">
          <Label htmlFor="qr-company-name">{labels.companyName}</Label>
          <Input
            id="qr-company-name"
            {...register("companyName")}
            aria-invalid={!!errors.companyName}
          />
          {errors.companyName ? (
            <p role="alert" className="text-accent-red text-xs">
              {errors.companyName.message}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="qr-company-size">{labels.companySize}</Label>
          <select
            id="qr-company-size"
            {...register("companySize")}
            className="border-border bg-paper text-fg focus-visible:ring-terracotta rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
            aria-invalid={!!errors.companySize}
          >
            <option value="">—</option>
            <option value="tpe">{labels.companySizeOptions.tpe}</option>
            <option value="pme">{labels.companySizeOptions.pme}</option>
            <option value="eti">{labels.companySizeOptions.eti}</option>
            <option value="grande_entreprise">{labels.companySizeOptions.grande_entreprise}</option>
          </select>
          {errors.companySize ? (
            <p role="alert" className="text-accent-red text-xs">
              {errors.companySize.message}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="qr-company-sector">{labels.companySector}</Label>
          <Input
            id="qr-company-sector"
            placeholder={labels.companySectorPlaceholder}
            {...register("companySector")}
            aria-invalid={!!errors.companySector}
          />
          {errors.companySector ? (
            <p role="alert" className="text-accent-red text-xs">
              {errors.companySector.message}
            </p>
          ) : null}
        </div>
      </section>

      {/* === Section Contact === */}
      <section className="space-y-4">
        <h2 className="text-fg text-lg font-semibold tracking-tight">{labels.sectionContact}</h2>
        <div className="grid gap-2">
          <Label htmlFor="qr-contact-name">{labels.contactName}</Label>
          <Input
            id="qr-contact-name"
            {...register("contactName")}
            aria-invalid={!!errors.contactName}
          />
          {errors.contactName ? (
            <p role="alert" className="text-accent-red text-xs">
              {errors.contactName.message}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="qr-contact-email">{labels.contactEmail}</Label>
            <Input
              id="qr-contact-email"
              type="email"
              {...register("contactEmail")}
              aria-invalid={!!errors.contactEmail}
            />
            {errors.contactEmail ? (
              <p role="alert" className="text-accent-red text-xs">
                {errors.contactEmail.message}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="qr-contact-phone">{labels.contactPhone}</Label>
            <Input
              id="qr-contact-phone"
              type="tel"
              {...register("contactPhone")}
              aria-invalid={!!errors.contactPhone}
            />
            {errors.contactPhone ? (
              <p role="alert" className="text-accent-red text-xs">
                {errors.contactPhone.message}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* === Section Projet === */}
      <section className="space-y-4">
        <h2 className="text-fg text-lg font-semibold tracking-tight">{labels.sectionProject}</h2>
        <input type="hidden" {...register("interventionSlug")} />
        <div className="grid gap-2">
          <Label htmlFor="qr-context">{labels.contextBusiness}</Label>
          <Textarea
            id="qr-context"
            rows={6}
            {...register("contextBusiness")}
            aria-invalid={!!errors.contextBusiness}
          />
          <p className="text-fg-muted text-xs">{labels.contextBusinessHint}</p>
          {errors.contextBusiness ? (
            <p role="alert" className="text-accent-red text-xs">
              {errors.contextBusiness.message}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="qr-budget">{labels.budgetIndicative}</Label>
            <Input
              id="qr-budget"
              placeholder={labels.budgetIndicativePlaceholder}
              {...register("budgetIndicative")}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="qr-timing">{labels.timingWeeks}</Label>
            <select
              id="qr-timing"
              {...register("timingWeeks")}
              className="border-border bg-paper text-fg focus-visible:ring-terracotta rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              <option value="">—</option>
              <option value="0-4">{labels.timingWeeksOptions["0-4"]}</option>
              <option value="4-8">{labels.timingWeeksOptions["4-8"]}</option>
              <option value="8-12">{labels.timingWeeksOptions["8-12"]}</option>
              <option value="12+">{labels.timingWeeksOptions["12+"]}</option>
            </select>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="qr-city">{labels.city}</Label>
            <Input id="qr-city" {...register("city")} aria-invalid={!!errors.city} />
            {errors.city ? (
              <p role="alert" className="text-accent-red text-xs">
                {errors.city.message}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="qr-participants">{labels.participantsEstimate}</Label>
            <Input
              id="qr-participants"
              type="number"
              min={1}
              max={5000}
              {...register("participantsEstimate", { valueAsNumber: true })}
            />
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Checkbox
            id="qr-travel"
            checked={!!willingToTravel}
            onCheckedChange={(c) => setValue("willingToTravel", c === true ? true : false)}
          />
          <Label htmlFor="qr-travel" className="text-sm leading-relaxed">
            {labels.willingToTravel}
          </Label>
        </div>
      </section>

      {/* === Section Consentements === */}
      <section className="space-y-4">
        <h2 className="text-fg text-lg font-semibold tracking-tight">{labels.sectionConsents}</h2>
        <div className="flex items-start gap-3">
          <Checkbox
            id="qr-consent-terms"
            checked={!!consentTerms}
            onCheckedChange={(c) =>
              setValue("consentTerms", c === true ? true : (false as never), {
                shouldValidate: true,
              })
            }
          />
          <Label htmlFor="qr-consent-terms" className="text-sm leading-relaxed">
            {labels.consentTerms}
          </Label>
        </div>
        {errors.consentTerms ? (
          <p role="alert" className="text-accent-red text-xs">
            {errors.consentTerms.message}
          </p>
        ) : null}
        <div className="flex items-start gap-3">
          <Checkbox
            id="qr-consent-gdpr"
            checked={!!consentGdpr}
            onCheckedChange={(c) =>
              setValue("consentGdpr", c === true ? true : (false as never), {
                shouldValidate: true,
              })
            }
          />
          <Label htmlFor="qr-consent-gdpr" className="text-sm leading-relaxed">
            {labels.consentGdpr}
          </Label>
        </div>
        {errors.consentGdpr ? (
          <p role="alert" className="text-accent-red text-xs">
            {errors.consentGdpr.message}
          </p>
        ) : null}
      </section>

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
