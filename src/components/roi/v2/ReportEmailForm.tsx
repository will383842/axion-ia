"use client";
// use-client: état de formulaire contrôlé + appel de la Server Action.
// Simulateur de gains v2 — recevoir le rapport par e-mail.
//
// ── Ce que ce formulaire n'est PAS ────────────────────────────────────────
// Ce n'est pas un mur. Le rapport complet est déjà lisible juste au-dessus,
// sans rien demander. Le formulaire propose un SERVICE — retrouver le rapport,
// l'imprimer, le transmettre — et c'est la seule raison pour laquelle un
// dirigeant laisse une adresse qui fonctionne. Un mur produit du volume et des
// adresses jetables ; un service produit des rendez-vous.
//
// ── Choix techniques ──────────────────────────────────────────────────────
// Pas de `react-hook-form` ici : trois champs ne justifient pas une douzaine de
// kilo-octets sur une page tenue par un budget de charge (cf. AGENTS.md). État
// local, validation côté serveur par Zod, messages d'erreur inline.
//
// `type="email"` + `inputMode="email"` + `autoComplete` : sur mobile, le bon
// clavier et le remplissage automatique évitent la moitié des fautes de
// frappe — donc la moitié des rapports jamais reçus.

import * as React from "react";
import { Check, Loader2, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/routing";
import type { RoiReport } from "@/content/roi/model/types";
import { encodeAnswers } from "@/lib/roi/encode";
import { submitRoiReportAction } from "@/features/roi-report/actions";
import { useTurnstileToken } from "@/components/forms/TurnstileWidget";
import { HoneypotField } from "@/components/forms/HoneypotField";
import { isStaleServerActionError } from "@/lib/forms/form-errors";
import { gainBucketOf, trackFunnel } from "@/lib/tracking";

interface ReportEmailFormProps {
  report: RoiReport;
  locale: Locale;
  className?: string;
}

const STALE_PAGE_MESSAGE =
  "Cette page a expiré suite à une mise à jour du site. Rechargez-la (Ctrl+R / ⌘+R) puis réessayez.";

export function ReportEmailForm({ report, locale, className }: ReportEmailFormProps) {
  const [nom, setNom] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [companyName, setCompanyName] = React.useState("");
  const [consent, setConsent] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const {
    token: turnstileToken,
    widget: turnstileWidget,
    reset: resetTurnstile,
  } = useTurnstileToken("roi-report");

  const diagnostic = React.useMemo(() => encodeAnswers(report.answers), [report.answers]);

  const onSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (pending) return;

      setError(null);
      if (!consent) {
        setError("Merci de cocher la case pour recevoir votre rapport.");
        return;
      }
      setPending(true);

      try {
        const fd = new FormData(event.currentTarget);
        fd.set("diagnostic", diagnostic);
        fd.set("locale", locale);
        fd.set("consent", consent ? "true" : "false");
        if (turnstileToken) fd.set("cf-turnstile-response", turnstileToken);

        const result = await submitRoiReportAction({ ok: false, error: "" }, fd);
        if (!result.ok) {
          resetTurnstile();
          setError(result.error || "L'envoi a échoué. Réessayez dans un instant.");
          return;
        }
        // Événement émis APRÈS confirmation du serveur, jamais à la soumission :
        // compter les tentatives gonflerait le taux de conversion du tunnel.
        trackFunnel("Simulator Report Requested", {
          sector: report.answers.sector,
          headcount: report.answers.headcount,
          taskCount: report.tasks.length,
          gainBucket: gainBucketOf(report.totalSavedEurPerYear),
        });
        setSent(true);
      } catch (err) {
        setError(
          isStaleServerActionError(err)
            ? STALE_PAGE_MESSAGE
            : "L'envoi a échoué. Réessayez dans un instant.",
        );
      } finally {
        setPending(false);
      }
    },
    [consent, diagnostic, locale, pending, report, resetTurnstile, turnstileToken],
  );

  if (sent) {
    return (
      <div
        className={cn("border-terracotta/40 bg-terracotta-soft/40 rounded-2xl border-2 p-6", className)}
        role="status"
      >
        <p className="text-fg flex items-center gap-2.5 text-[17px] font-bold tracking-tight">
          <Check aria-hidden="true" className="text-terracotta h-5 w-5 shrink-0" />
          C&apos;est parti
        </p>
        <p className="text-fg-soft mt-2 text-[14.5px] leading-relaxed">
          Votre rapport arrive dans quelques instants à l&apos;adresse indiquée. S&apos;il tarde,
          regardez dans les indésirables — et gardez le lien de cette page, il reste valable.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={cn("border-border bg-paper rounded-2xl border p-5 sm:p-6", className)}
    >
      <p className="text-fg flex items-center gap-2.5 text-[17px] font-bold tracking-tight">
        <Mail aria-hidden="true" className="text-terracotta-deep h-5 w-5 shrink-0" />
        Recevez ce rapport par e-mail
      </p>
      <p className="text-fg-soft mt-2 text-[14px] leading-relaxed">
        Vos chiffres, votre plan d&apos;action et le lien permanent vers cette page — pour le
        relire au calme ou le transmettre à votre équipe.
      </p>

      <div className="mt-5 flex flex-col gap-3.5">
        <Field
          id="roi-nom"
          name="nom"
          label="Votre prénom"
          value={nom}
          onChange={setNom}
          autoComplete="given-name"
          required
        />
        <Field
          id="roi-email"
          name="email"
          label="Votre e-mail professionnel"
          type="email"
          inputMode="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
        />
        <Field
          id="roi-company"
          name="companyName"
          label="Votre entreprise"
          hint="Facultatif"
          value={companyName}
          onChange={setCompanyName}
          autoComplete="organization"
        />
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="consent"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="border-border-strong text-terracotta focus-visible:ring-terracotta mt-0.5 h-5 w-5 shrink-0 rounded focus-visible:ring-2 focus-visible:ring-offset-2"
        />
        <span className="text-fg-soft text-[13.5px] leading-relaxed">
          J&apos;accepte de recevoir ce rapport et d&apos;être recontacté par Axion-IA à ce sujet.
          Aucune revente de données, désinscription en un clic.
        </span>
      </label>

      <HoneypotField />
      {turnstileWidget}

      {error ? (
        <p role="alert" className="text-terracotta-deep mt-4 text-[14px] leading-relaxed font-medium">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className={cn(
          "bg-terracotta text-paper mt-5 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full px-6 text-[16px] font-bold transition",
          "focus-visible:ring-terracotta focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          "hover:bg-terracotta-deep disabled:cursor-wait disabled:opacity-60",
        )}
      >
        {pending ? (
          <>
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            Envoi…
          </>
        ) : (
          "Recevoir mon rapport"
        )}
      </button>
    </form>
  );
}

function Field({
  id,
  name,
  label,
  hint,
  value,
  onChange,
  type = "text",
  inputMode,
  autoComplete,
  required = false,
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  inputMode?: "text" | "email";
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-fg mb-1.5 flex items-baseline gap-2 text-[14px] font-semibold">
        {label}
        {hint ? <span className="text-fg-muted text-[12px] font-normal">{hint}</span> : null}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        {...(inputMode ? { inputMode } : {})}
        {...(autoComplete ? { autoComplete } : {})}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // 16 px minimum : en dessous, Safari iOS zoome à la mise au point et
        // casse la mise en page du formulaire.
        className="border-border-strong bg-canvas text-fg focus-visible:ring-terracotta min-h-[52px] w-full rounded-xl border-2 px-4 text-[16px] focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
      />
    </div>
  );
}
