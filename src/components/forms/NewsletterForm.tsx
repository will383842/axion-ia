"use client";
// use-client: react-hook-form needs client runtime for register/handleSubmit.

// Formulaire du GUIDE IA — page du guide et encarts d'articles (lot L2, 2026-09-24).
//
// Le nom du fichier est historique (il n'inscrivait qu'à la lettre) ; son contrat
// a changé : l'adresse suffit pour recevoir le guide TOUT DE SUITE par e-mail,
// et la lettre est une case FACULTATIVE, DÉCOCHÉE, à double opt-in (décision
// n° 1 de Will). La refonte visuelle vient avec le lot L1.
//
// Tous les textes arrivent par `libelles`, calculés côté serveur depuis
// `content/guide-ia-formulaire.ts` — l'archive de preuve des textes affichés.

import * as React from "react";
import { useForm } from "react-hook-form";
import { useLocale } from "next-intl";
import { zodResolver } from "@hookform/resolvers/zod";
import { demandeGuideSchema, type DemandeGuideInput } from "@/lib/schemas/forms";
import { demanderGuideAction } from "@/features/guide-ia/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTurnstileToken } from "@/components/forms/TurnstileWidget";
import { HoneypotField } from "@/components/forms/HoneypotField";
import { isStaleServerActionError } from "@/lib/forms/form-errors";
import type { LibellesFormulaireGuide, SourceGuide } from "@/content/guide-ia-formulaire";

interface NewsletterFormProps {
  libelles: LibellesFormulaireGuide;
  /** Point de collecte, transmis tel quel au serveur (liste fermée). */
  source: SourceGuide;
  variant?: "inline" | "stacked";
}

export function NewsletterForm({ libelles, source, variant = "stacked" }: NewsletterFormProps) {
  const locale = useLocale();
  const idBase = React.useId();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<DemandeGuideInput>({
    // Same TS drift workaround as the other forms (zodResolver + exactOptionalPropertyTypes).
    resolver: zodResolver(demandeGuideSchema as never) as never,
    defaultValues: { email: "", lettre: false },
  });
  const lettre = watch("lettre");
  const [lettreEnvoyee, setLettreEnvoyee] = React.useState(false);
  const {
    token: turnstileToken,
    widget: turnstileWidget,
    reset: resetTurnstile,
  } = useTurnstileToken("newsletter");
  const [serverError, setServerError] = React.useState<string | null>(null);

  const isFr = locale === "fr";
  const pageOutdatedMsg = isFr
    ? "Cette page a expiré suite à une mise à jour du site. Rechargez la page (Ctrl+R / ⌘+R) puis réessayez."
    : "This page expired after a site update. Reload the page (Ctrl+R / ⌘+R) and try again.";

  async function onSubmit(values: DemandeGuideInput) {
    setServerError(null);
    try {
      const fd = new FormData();
      fd.set("email", values.email);
      fd.set("lettre", values.lettre ? "true" : "false");
      fd.set("locale", locale);
      fd.set("source", source);
      // Turnstile est BLOQUANT (D3) : sans jeton, le serveur refuse et le dit.
      if (turnstileToken) fd.set("cf-turnstile-response", turnstileToken);

      const result = await demanderGuideAction({ ok: false, error: "" }, fd);
      if (!result.ok) {
        resetTurnstile();
        const message = result.error || libelles.failure;
        setServerError(message);
        throw new Error(message);
      }
      setLettreEnvoyee(values.lettre === true);
    } catch (err) {
      // Deploy-skew (Server Action introuvable, page chargée avant un déploiement).
      if (isStaleServerActionError(err)) {
        setServerError(pageOutdatedMsg);
      } else if (!serverError) {
        setServerError(libelles.failure);
      }
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  if (isSubmitSuccessful && !serverError) {
    return (
      <Alert variant="success" role="status">
        <AlertDescription>
          {libelles.success}
          {lettreEnvoyee ? ` ${libelles.successLettre}` : null}
        </AlertDescription>
      </Alert>
    );
  }

  const inline = variant === "inline";
  const idEmail = `${idBase}-email`;
  const idLettre = `${idBase}-lettre`;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className={inline ? "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end" : "space-y-4"}
    >
      <HoneypotField />
      <div className="grid flex-1 gap-2">
        <Label htmlFor={idEmail}>{libelles.email}</Label>
        <Input
          id={idEmail}
          type="email"
          autoComplete="email"
          {...register("email")}
          aria-invalid={!!errors.email}
        />
        {errors.email ? (
          <p role="alert" className="text-error text-xs">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <Button type="submit" loading={isSubmitting} className={inline ? "sm:self-end" : undefined}>
        {isSubmitting ? libelles.sending : libelles.submit}
      </Button>

      {/* Case FACULTATIVE, DÉCOCHÉE par défaut : le guide ne dépend pas d'elle. */}
      <div className="flex items-start gap-3 sm:basis-full">
        <Checkbox
          id={idLettre}
          checked={!!lettre}
          onCheckedChange={(c) => setValue("lettre", c === true)}
        />
        <Label htmlFor={idLettre} className="text-fg-soft text-xs leading-relaxed">
          {libelles.lettre}
        </Label>
      </div>

      <p className="text-fg-muted text-xs leading-relaxed sm:basis-full">
        {libelles.mention}{" "}
        <a className="underline" href={libelles.politique.href}>
          {libelles.politique.libelle}
        </a>
        .
      </p>

      {serverError ? (
        <Alert variant="danger" role="alert" className="sm:basis-full">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="sm:basis-full">{turnstileWidget}</div>
    </form>
  );
}
