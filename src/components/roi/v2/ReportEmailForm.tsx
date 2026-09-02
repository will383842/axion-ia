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
import { Check, Loader2, Mail, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/routing";
import type { RoiReport } from "@/content/roi/model/types";
import { encodeAnswers } from "@/lib/roi/encode";
import { attachRoiCallbackAction, submitRoiReportAction } from "@/features/roi-report/actions";
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
  const [submissionId, setSubmissionId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const sent = submissionId !== null;

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
        setSubmissionId(result.submissionId);
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
        className={cn(
          "rounded-2xl border-2 border-[var(--sim-accent-border)]/40 bg-[var(--sim-accent-soft)] p-6",
          className,
        )}
        role="status"
      >
        <p className="flex items-center gap-2.5 text-[17px] font-bold tracking-tight text-[var(--sim-fg)]">
          <Check aria-hidden="true" className="h-5 w-5 shrink-0 text-[var(--sim-accent-text)]" />
          C&apos;est parti
        </p>
        <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--sim-fg-soft)]">
          Votre rapport arrive dans quelques instants à l&apos;adresse indiquée. S&apos;il tarde,
          regardez dans les indésirables — et gardez le lien de cette page, il reste valable.
        </p>

        {/* Deuxième temps : le téléphone. Il n'apparaît QU'ICI, une fois le
            rapport parti. Cf. `attachRoiCallbackAction`. */}
        {submissionId ? <CallbackAsk submissionId={submissionId} /> : null}
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={cn(
        "rounded-2xl border border-[var(--sim-border)] bg-[var(--sim-surface)] p-5 sm:p-6",
        className,
      )}
    >
      <p className="flex items-center gap-2.5 text-[17px] font-bold tracking-tight text-[var(--sim-fg)]">
        <Mail aria-hidden="true" className="h-5 w-5 shrink-0 text-[var(--sim-accent-strong)]" />
        Recevez ce rapport par e-mail
      </p>
      <p className="mt-2 text-[14px] leading-relaxed text-[var(--sim-fg-soft)]">
        Vos chiffres, votre plan d&apos;action et le lien permanent vers cette page — pour le relire
        au calme ou le transmettre à votre équipe.
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
          // 24 px : la case elle-même reste sous le seuil WCAG 2.5.8, mais le
          // `<label>` qui l'entoure est cliquable sur toute sa surface — c'est
          // lui la vraie cible. On l'élargit quand même, parce qu'au pouce on
          // vise instinctivement la case, pas le texte.
          className="focus-visible:ring-terracotta mt-0.5 h-6 w-6 shrink-0 rounded border-[var(--sim-border-strong)] text-[var(--sim-accent-text)] focus-visible:ring-2 focus-visible:ring-offset-2"
        />
        <span className="text-[13.5px] leading-relaxed text-[var(--sim-fg-soft)]">
          J&apos;accepte de recevoir ce rapport et d&apos;être recontacté par Axion-IA à ce sujet.
          Aucune revente de données ; chaque e-mail porte un lien pour ne plus être sollicité.
        </span>
      </label>

      <HoneypotField />
      {turnstileWidget}

      {error ? (
        <p
          role="alert"
          className="mt-4 text-[14px] leading-relaxed font-medium text-[var(--sim-accent-strong)]"
        >
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
      <label
        htmlFor={id}
        className="mb-1.5 flex items-baseline gap-2 text-[14px] font-semibold text-[var(--sim-fg)]"
      >
        {label}
        {hint ? (
          <span className="text-[12px] font-normal text-[var(--sim-fg-muted)]">{hint}</span>
        ) : null}
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
        className="focus-visible:ring-terracotta min-h-[52px] w-full rounded-xl border-2 border-[var(--sim-border-strong)] bg-[var(--sim-bg)] px-4 text-[16px] text-[var(--sim-fg)] focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
      />
    </div>
  );
}

/**
 * Demande du numéro de téléphone — DEUXIÈME temps, après l'envoi du rapport.
 *
 * ── Ce qui fait que ce champ ne coûte rien ────────────────────────────────
 * • Il n'existe pas tant que le rapport n'est pas parti. La personne a déjà
 *   obtenu ce qu'elle venait chercher : refuser ici ne lui retire rien, et
 *   nous, on garde un lead complet.
 * • Il annonce une contrepartie PRÉCISE et bornée — quinze minutes, sur le
 *   plan qu'elle vient de lire. Un « pour être recontacté » sans objet ni
 *   durée est exactement ce qui fait fermer l'onglet.
 * • Il dit non seulement ce qu'on va faire, mais ce qu'on ne fera pas. La
 *   crainte attachée au téléphone n'est pas d'être appelé une fois, c'est
 *   d'être rappelé indéfiniment.
 * • Il se ferme sans culpabilisation : pas de « non merci, je préfère perdre
 *   du temps ». Le refus se fait en ignorant le bloc, ce qui est le geste par
 *   défaut.
 */
function CallbackAsk({ submissionId }: { submissionId: string }) {
  const [telephone, setTelephone] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (pending) return;
      setError(null);
      setPending(true);
      try {
        const fd = new FormData();
        fd.set("submissionId", submissionId);
        fd.set("telephone", telephone);
        const result = await attachRoiCallbackAction({ ok: false, error: "" }, fd);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        trackFunnel("Simulator Callback Requested", {});
        setDone(true);
      } catch (err) {
        setError(
          isStaleServerActionError(err)
            ? STALE_PAGE_MESSAGE
            : "L'enregistrement a échoué. Réessayez dans un instant.",
        );
      } finally {
        setPending(false);
      }
    },
    [pending, submissionId, telephone],
  );

  if (done) {
    return (
      <p
        role="status"
        className="mt-5 flex items-start gap-2.5 border-t border-[var(--sim-border)] pt-5 text-[14px] leading-relaxed text-[var(--sim-fg-soft)]"
      >
        <Check
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sim-accent-text)]"
        />
        <span>
          C&apos;est noté. Nous vous appelons sous deux jours ouvrés, à l&apos;heure qui vous
          arrange — vous pourrez la choisir par retour d&apos;e-mail.
        </span>
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-5 border-t border-[var(--sim-border)] pt-5">
      <p className="flex items-center gap-2.5 text-[15px] font-bold tracking-tight text-[var(--sim-fg)]">
        <Phone aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--sim-accent-text)]" />
        Vous voulez qu&apos;on le passe en revue avec vous ?
      </p>
      <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--sim-fg-soft)]">
        Quinze minutes au téléphone sur votre plan : par quoi commencer chez vous, ce qui ne vaut
        pas le coup, ce que ça demande. Laissez un numéro si vous le souhaitez —{" "}
        <strong className="font-semibold text-[var(--sim-fg)]">
          un seul appel, jamais de relance automatique
        </strong>
        , et votre rapport vous est acquis dans tous les cas.
      </p>

      <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
        <input
          id="roi-tel"
          name="telephone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          aria-label="Votre numéro de téléphone"
          placeholder="06 12 34 56 78"
          value={telephone}
          onChange={(e) => setTelephone(e.target.value)}
          className="focus-visible:ring-terracotta min-h-[52px] w-full rounded-xl border-2 border-[var(--sim-border-strong)] bg-[var(--sim-bg)] px-4 text-[16px] text-[var(--sim-fg)] focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
        />
        <button
          type="submit"
          disabled={pending || telephone.trim().length < 8}
          className={cn(
            "bg-terracotta text-paper hover:bg-terracotta-deep focus-visible:ring-terracotta flex min-h-[52px] shrink-0 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-bold transition",
            "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          {pending ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            "Me rappeler"
          )}
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-[13.5px] font-medium text-[var(--sim-accent-strong)]">
          {error}
        </p>
      ) : null}
    </form>
  );
}
