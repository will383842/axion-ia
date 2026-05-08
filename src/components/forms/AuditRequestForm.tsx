"use client";
// use-client: 6-step wizard pour /audit/demande. State local volatile,
// validation step-by-step via Zod, pré-remplissage via ?type=slug.
// Submit en stub `[audit-request:submit:stub]` pour Sprint 17.

import * as React from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardCheck,
  Building2,
  MapPin,
  Brain,
  User,
  Sparkles,
  Zap,
  Workflow,
  Briefcase,
  Network,
} from "lucide-react";
import {
  auditRequestStep1Schema,
  auditRequestStep2Schema,
  auditRequestStep3Schema,
  auditRequestStep4Schema,
  auditRequestStep5Schema,
  auditRequestStep6Schema,
} from "@/lib/schemas/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AUDIT_TIERS, formatAmount, getTierById } from "@/content/pricing";
import { cn } from "@/lib/utils";

type AuditTypeKey = "flash" | "process" | "strategique-pme" | "strategique-eti";
type SizeKey = "tpe" | "pme" | "mid" | "enterprise";
type ModalityKey = "remote" | "onsite";
type ScopeKey = "global" | "single-area";
type MaturityKey = "zero" | "starting" | "mature";

interface Labels {
  // Generic
  step: string; // "Étape" / "Step"
  next: string;
  previous: string;
  cancel: string;
  submit: string;
  sending: string;
  successHeader: string;
  successTitle: string;
  successBody: string;
  successCta: string;
  failure: string;
  // Step 1 — type
  s1Eyebrow: string;
  s1Title: string;
  s1Description: string;
  auditTypes: ReadonlyArray<{
    key: AuditTypeKey;
    label: string;
    description: string;
    priceFrom: string;
  }>;
  // Step 2 — company
  s2Eyebrow: string;
  s2Title: string;
  s2Description: string;
  sizeLabel: string;
  sizes: ReadonlyArray<{ key: SizeKey; label: string }>;
  industryLabel: string;
  industryPlaceholder: string;
  companyNameLabel: string;
  companyNamePlaceholder: string;
  // Step 3 — modality + location
  s3Eyebrow: string;
  s3Title: string;
  s3Description: string;
  modalityLabel: string;
  modalityRemote: string;
  modalityRemoteHint: string;
  modalityOnsite: string;
  modalityOnsiteHint: string;
  cityLabel: string;
  cityPlaceholder: string;
  countryLabel: string;
  countryPlaceholder: string;
  // Step 4 — scope + maturity + goals
  s4Eyebrow: string;
  s4Title: string;
  s4Description: string;
  scopeLabel: string;
  scopeGlobal: string;
  scopeGlobalHint: string;
  scopeSingleArea: string;
  scopeSingleAreaHint: string;
  scopeDetailLabel: string;
  scopeDetailPlaceholder: string;
  maturityLabel: string;
  maturityZero: string;
  maturityStarting: string;
  maturityMature: string;
  goalsLabel: string;
  goalsPlaceholder: string;
  // Step 5 — contact
  s5Eyebrow: string;
  s5Title: string;
  s5Description: string;
  contactLabel: string;
  emailLabel: string;
  phoneLabel: string;
  roleLabel: string;
  rolePlaceholder: string;
  // Step 6 — recap + consent
  s6Eyebrow: string;
  s6Title: string;
  s6Description: string;
  consentLabel: string;
  recapTitle: string;
  recapModality: string;
  recapType: string;
  recapSize: string;
  recapIndustry: string;
  recapLocation: string;
  recapScope: string;
  recapMaturity: string;
  recapContact: string;
  // Step circle labels (mobile)
  stepLabels: ReadonlyArray<string>; // 6 entries
}

interface AuditRequestFormProps {
  labels: Labels;
  /** Locale active — utilisée par le helper de prix `priceFor`. */
  locale: "fr" | "en";
}

const STEP_ICONS = [ClipboardCheck, Building2, MapPin, Brain, User, Check] as const;

// Prix par niveau et modalité — utilisé par le bandeau persistent en
// haut du form, le différentiel modalité Step 3 et le récap Step 6.
// Les niveaux Process/PME/ETI ont le même prix indicatif distance/onsite
// (le différentiel sera précisé dans le devis personnalisé).
// Sprint 14.10.5 : entièrement dérivé de SSOT pricing.ts (zéro hardcode).
const TIER_ID_BY_TYPE: Record<AuditTypeKey, string> = {
  flash: "audit-flash",
  process: "audit-cible",
  "strategique-pme": "audit-strategique-pme",
  "strategique-eti": "audit-strategique-eti",
};

function buildPriceTable(): Record<
  AuditTypeKey,
  { remote: { fr: string; en: string }; onsite: { fr: string; en: string } }
> {
  const flash = getTierById(AUDIT_TIERS, "audit-flash");
  const cible = getTierById(AUDIT_TIERS, "audit-cible");
  const pme = getTierById(AUDIT_TIERS, "audit-strategique-pme");
  const eti = getTierById(AUDIT_TIERS, "audit-strategique-eti");
  const flashRemoteFr = formatAmount(flash.priceFlat!, "fr", { compact: true });
  const flashRemoteEn = formatAmount(flash.priceFlat!, "en", { compact: true });
  const flashOnsiteFr = formatAmount(flash.priceFlatOnsite!, "fr", { compact: true });
  const flashOnsiteEn = formatAmount(flash.priceFlatOnsite!, "en", { compact: true });
  const cibleFr = `Dès ${formatAmount(cible.priceMin!, "fr", { compact: true })}`;
  const cibleEn = `From ${formatAmount(cible.priceMin!, "en", { compact: true })}`;
  const pmeFr = `Dès ${formatAmount(pme.priceMin!, "fr", { compact: true })}`;
  const pmeEn = `From ${formatAmount(pme.priceMin!, "en", { compact: true })}`;
  const etiFr = `À partir de ${formatAmount(eti.priceMin!, "fr", { compact: true })}`;
  const etiEn = `From ${formatAmount(eti.priceMin!, "en", { compact: true })}`;
  return {
    flash: {
      remote: { fr: flashRemoteFr, en: flashRemoteEn },
      onsite: { fr: flashOnsiteFr, en: flashOnsiteEn },
    },
    process: {
      remote: { fr: cibleFr, en: cibleEn },
      onsite: { fr: cibleFr, en: cibleEn },
    },
    "strategique-pme": {
      remote: { fr: pmeFr, en: pmeEn },
      onsite: { fr: pmeFr, en: pmeEn },
    },
    "strategique-eti": {
      remote: { fr: etiFr, en: etiEn },
      onsite: { fr: etiFr, en: etiEn },
    },
  };
}

const PRICE_TABLE = buildPriceTable();
// Suppress unused warning — TIER_ID_BY_TYPE est exposé pour usage futur (admin pricing).
void TIER_ID_BY_TYPE;

/** Helper : retourne le prix à afficher selon type + modalité + locale. */
function priceFor(
  type: AuditTypeKey | null,
  modality: ModalityKey | null,
  locale: "fr" | "en",
): string {
  if (!type) return "—";
  const tier = PRICE_TABLE[type];
  const m: "remote" | "onsite" = modality === "onsite" ? "onsite" : "remote";
  return tier[m][locale];
}

export function AuditRequestForm({ labels, locale }: AuditRequestFormProps) {
  const isFr = locale === "fr";
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Pré-remplissage via ?type=slug
  const typeFromUrl = searchParams.get("type") as AuditTypeKey | null;
  const validTypes: ReadonlyArray<AuditTypeKey> = [
    "flash",
    "process",
    "strategique-pme",
    "strategique-eti",
  ];
  const initialType: AuditTypeKey | null =
    typeFromUrl && validTypes.includes(typeFromUrl) ? typeFromUrl : null;

  const [step, setStep] = React.useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [submittingState, setSubmittingState] = React.useState<"idle" | "submitting" | "success">(
    "idle",
  );
  const [serverError, setServerError] = React.useState<string | null>(null);

  // Form fields
  const [auditType, setAuditType] = React.useState<AuditTypeKey | null>(initialType);
  const [size, setSize] = React.useState<SizeKey | null>(null);
  const [industry, setIndustry] = React.useState("");
  const [companyName, setCompanyName] = React.useState("");
  const [modality, setModality] = React.useState<ModalityKey | null>(null);
  const [city, setCity] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [scope, setScope] = React.useState<ScopeKey | null>(null);
  const [scopeDetail, setScopeDetail] = React.useState("");
  const [maturity, setMaturity] = React.useState<MaturityKey | null>(null);
  const [goals, setGoals] = React.useState("");
  // Outils utilisés — multi-select optionnel (ne bloque jamais le passage step).
  const [tools, setTools] = React.useState<ReadonlyArray<string>>([]);
  const [toolsOther, setToolsOther] = React.useState("");
  const [contact, setContact] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [role, setRole] = React.useState("");
  const [consent, setConsent] = React.useState(false);

  // Sync URL ↔ state when user changes auditType in step 1.
  function pickAuditType(key: AuditTypeKey) {
    setAuditType(key);
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("type", key);
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  }

  // Step validity gates
  const canStep1 = auditRequestStep1Schema.safeParse({ auditType }).success;
  const canStep2 = auditRequestStep2Schema.safeParse({
    size,
    industry,
    companyName: companyName || undefined,
  }).success;
  const canStep3 = auditRequestStep3Schema.safeParse({ modality, city, country }).success;
  const canStep4 = auditRequestStep4Schema.safeParse({
    scope,
    scopeDetail,
    maturity,
    goals,
  }).success;
  const canStep5 = auditRequestStep5Schema.safeParse({
    contact,
    email,
    phone: phone || undefined,
    role: role || undefined,
  }).success;
  const canStep6 = auditRequestStep6Schema.safeParse({ consent }).success;

  async function handleSubmit() {
    setServerError(null);
    setSubmittingState("submitting");
    try {
      await new Promise((r) => setTimeout(r, 600));
      const payload = {
        auditType,
        size,
        industry,
        companyName: companyName || undefined,
        modality,
        city,
        country,
        scope,
        scopeDetail,
        maturity,
        goals,
        tools: tools.length > 0 ? tools : undefined,
        toolsOther: toolsOther || undefined,
        contact,
        email,
        phone: phone || undefined,
        role: role || undefined,
        consent,
      };

      if (process.env.NODE_ENV !== "production") {
        console.warn("[audit-request:submit:stub]", payload);
      }
      setSubmittingState("success");
    } catch {
      setServerError(labels.failure);
      setSubmittingState("idle");
    }
  }

  // Success state — popup-style block, but inline in the page.
  if (submittingState === "success") {
    return (
      <div className="bg-paper border-terracotta/25 shadow-card mx-auto max-w-3xl rounded-3xl border-2 p-8 sm:p-10">
        <div className="bg-halo-warm border-terracotta/30 mb-6 rounded-2xl border-2 p-5">
          <p className="text-terracotta-deep text-[12px] font-semibold tracking-[0.16em] uppercase">
            {labels.successHeader}
          </p>
          <p
            className="text-fg mt-2 text-2xl leading-tight font-medium tracking-tight sm:text-3xl"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {labels.successTitle}
          </p>
          <p className="text-fg-soft mt-3 text-base leading-relaxed">{labels.successBody}</p>
        </div>

        <Button
          type="button"
          onClick={() => {
            // Reset to start a new request
            setStep(1);
            setAuditType(initialType);
            setSize(null);
            setIndustry("");
            setCompanyName("");
            setModality(null);
            setCity("");
            setCountry("");
            setScope(null);
            setScopeDetail("");
            setMaturity(null);
            setGoals("");
            setContact("");
            setEmail("");
            setPhone("");
            setRole("");
            setTools([]);
            setToolsOther("");
            setConsent(false);
            setSubmittingState("idle");
          }}
          shape="pill"
          variant="outline"
        >
          {labels.successCta}
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-paper border-border shadow-subtle mx-auto max-w-4xl rounded-3xl border-2 p-6 sm:p-8 lg:p-10">
      {/* Bandeau prix persistent — visible sur les 6 steps. Le user voit
          en permanence ce qu'il s'engage à payer. Disparaît avant la
          sélection du type au step 1 (auditType null). */}
      {auditType ? (
        <div className="bg-halo-warm border-terracotta/30 mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 px-5 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <p className="text-fg-muted text-[10px] font-bold tracking-[0.18em] uppercase sm:text-[11px]">
              {isFr ? "Vous demandez" : "You're requesting"}
            </p>
            <p className="text-fg mt-1 text-[15px] leading-tight font-bold sm:text-base">
              {labels.auditTypes.find((t) => t.key === auditType)?.label ?? "—"}
              {modality
                ? ` · ${modality === "remote" ? labels.modalityRemote : labels.modalityOnsite}`
                : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-fg-muted text-[10px] font-bold tracking-[0.16em] uppercase">
              {isFr ? "Prix indicatif HT" : "Indicative price"}
            </p>
            <p
              className="text-terracotta mt-0.5 text-2xl leading-none font-medium tracking-tight italic tabular-nums sm:text-3xl"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {priceFor(auditType, modality, locale)}
            </p>
          </div>
        </div>
      ) : null}

      {/* Indicateur de durée — réduit l'anxiété "ça va prendre combien ?" */}
      <p className="text-fg-muted mb-4 flex items-center gap-2 text-[12px]">
        <Check aria-hidden="true" className="text-terracotta-deep h-3.5 w-3.5" strokeWidth={2.5} />
        {isFr
          ? "≈ 3 minutes · vous pouvez revenir en arrière à tout moment"
          : "≈ 3 minutes · you can go back at any time"}
      </p>

      {/* Progress bar — 6 cercles */}
      <ProgressBar step={step} stepLabels={labels.stepLabels} stepWord={labels.step} />

      <div className="py-2">
        {step === 1 ? <Step1 labels={labels} auditType={auditType} onPick={pickAuditType} /> : null}

        {step === 2 ? (
          <Step2
            labels={labels}
            size={size}
            setSize={setSize}
            industry={industry}
            setIndustry={setIndustry}
            companyName={companyName}
            setCompanyName={setCompanyName}
          />
        ) : null}

        {step === 3 ? (
          <Step3
            labels={labels}
            modality={modality}
            setModality={setModality}
            city={city}
            setCity={setCity}
            country={country}
            setCountry={setCountry}
            auditType={auditType}
            locale={locale}
          />
        ) : null}

        {step === 4 ? (
          <Step4
            labels={labels}
            scope={scope}
            setScope={setScope}
            scopeDetail={scopeDetail}
            setScopeDetail={setScopeDetail}
            maturity={maturity}
            setMaturity={setMaturity}
            goals={goals}
            setGoals={setGoals}
            tools={tools}
            setTools={setTools}
            toolsOther={toolsOther}
            setToolsOther={setToolsOther}
            isFr={isFr}
          />
        ) : null}

        {step === 5 ? (
          <Step5
            labels={labels}
            contact={contact}
            setContact={setContact}
            email={email}
            setEmail={setEmail}
            phone={phone}
            setPhone={setPhone}
            role={role}
            setRole={setRole}
          />
        ) : null}

        {step === 6 ? (
          <Step6
            labels={labels}
            auditType={auditType}
            size={size}
            industry={industry}
            companyName={companyName}
            modality={modality}
            city={city}
            country={country}
            scope={scope}
            maturity={maturity}
            tools={tools}
            toolsOther={toolsOther}
            contact={contact}
            email={email}
            consent={consent}
            setConsent={setConsent}
            locale={locale}
          />
        ) : null}
      </div>

      {serverError ? (
        <Alert variant="danger" role="alert" className="mt-4">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      {/* Footer nav */}
      <div className="border-border mt-6 flex items-center justify-between gap-3 border-t pt-6">
        <Button
          type="button"
          variant="ghost"
          onClick={() => (step > 1 ? setStep((s) => (s - 1) as 1 | 2 | 3 | 4 | 5 | 6) : undefined)}
          disabled={step === 1}
          shape="pill"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {labels.previous}
        </Button>

        {step < 6 ? (
          <Button
            type="button"
            onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3 | 4 | 5 | 6)}
            shape="pill"
            disabled={
              (step === 1 && !canStep1) ||
              (step === 2 && !canStep2) ||
              (step === 3 && !canStep3) ||
              (step === 4 && !canStep4) ||
              (step === 5 && !canStep5)
            }
          >
            {labels.next}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSubmit}
            shape="pill"
            disabled={!canStep6 || submittingState === "submitting"}
            loading={submittingState === "submitting"}
          >
            {submittingState === "submitting" ? labels.sending : labels.submit}
            <Check className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}

// === Sub-components ===

function ProgressBar({
  step,
  stepLabels,
  stepWord,
}: {
  step: 1 | 2 | 3 | 4 | 5 | 6;
  stepLabels: ReadonlyArray<string>;
  stepWord: string;
}) {
  return (
    <div className="border-border-strong mb-8 grid grid-cols-3 gap-2 border-b-2 pb-6 sm:grid-cols-6 sm:gap-3 sm:pb-7">
      {stepLabels.map((label, i) => {
        const Icon = STEP_ICONS[i] ?? Check;
        const idx = (i + 1) as 1 | 2 | 3 | 4 | 5 | 6;
        const isActive = step === idx;
        const isDone = step > idx;
        return (
          <div
            key={label}
            className={cn(
              "flex flex-col items-center gap-1.5 text-center",
              isActive && "text-terracotta-deep",
              isDone && "text-fg",
              !isActive && !isDone && "text-fg-muted",
            )}
          >
            <span
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-all sm:h-14 sm:w-14",
                isActive &&
                  "bg-terracotta text-mocha-fg ring-terracotta/30 ring-offset-paper shadow-card scale-105 ring-4 ring-offset-2",
                isDone && "bg-mocha text-mocha-fg shadow-subtle",
                !isActive && !isDone && "bg-sand border-border-strong text-fg-muted border-2",
              )}
            >
              {isDone ? (
                <Check className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" strokeWidth={3} />
              ) : (
                <Icon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
              )}
            </span>
            <span
              className={cn(
                "block text-[10px] tracking-[0.18em] uppercase",
                isActive ? "text-terracotta-deep font-bold" : "text-fg-muted font-semibold",
              )}
            >
              {stepWord} {idx}
            </span>
            <span
              className={cn(
                "text-xs leading-tight font-bold sm:text-sm",
                isActive && "text-terracotta-deep",
              )}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const TYPE_ICONS: Record<AuditTypeKey, typeof ClipboardCheck> = {
  flash: Zap,
  process: Workflow,
  "strategique-pme": Briefcase,
  "strategique-eti": Network,
};

function Step1({
  labels,
  auditType,
  onPick,
}: {
  labels: Labels;
  auditType: AuditTypeKey | null;
  onPick: (k: AuditTypeKey) => void;
}) {
  return (
    <div className="space-y-6">
      <Header
        eyebrow={labels.s1Eyebrow}
        title={labels.s1Title}
        description={labels.s1Description}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {labels.auditTypes.map((opt) => {
          const Icon = TYPE_ICONS[opt.key];
          const isSel = auditType === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onPick(opt.key)}
              className={cn(
                "border-border bg-paper hover:border-terracotta hover:bg-halo-warm focus-visible:ring-terracotta group flex min-h-[120px] flex-col gap-3 rounded-2xl border-2 p-5 text-left transition-all focus-visible:ring-2 focus-visible:outline-none",
                isSel && "border-terracotta bg-halo-warm shadow-card scale-[1.02]",
              )}
              aria-pressed={isSel}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    isSel
                      ? "bg-terracotta text-mocha-fg"
                      : "bg-terracotta-soft text-terracotta-deep",
                  )}
                >
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <p className="text-fg text-base leading-snug font-semibold">{opt.label}</p>
                {isSel ? (
                  <Check
                    className="text-terracotta-deep ml-auto h-5 w-5"
                    aria-hidden="true"
                    strokeWidth={3}
                  />
                ) : null}
              </div>
              <p className="text-fg-soft text-sm leading-relaxed">{opt.description}</p>
              <p className="text-terracotta-deep mt-auto text-[13px] font-semibold tabular-nums">
                {opt.priceFrom}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Step2({
  labels,
  size,
  setSize,
  industry,
  setIndustry,
  companyName,
  setCompanyName,
}: {
  labels: Labels;
  size: SizeKey | null;
  setSize: (s: SizeKey) => void;
  industry: string;
  setIndustry: (s: string) => void;
  companyName: string;
  setCompanyName: (s: string) => void;
}) {
  return (
    <div className="space-y-6">
      <Header
        eyebrow={labels.s2Eyebrow}
        title={labels.s2Title}
        description={labels.s2Description}
      />

      <fieldset className="space-y-3">
        <Label className="text-fg block text-base font-bold sm:text-lg">
          {labels.sizeLabel}
          <span className="text-terracotta-deep ml-1.5 font-bold">*</span>
        </Label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {labels.sizes.map((s) => {
            const isSel = size === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setSize(s.key)}
                className={cn(
                  "border-border bg-paper hover:border-terracotta focus-visible:ring-terracotta min-h-[76px] rounded-xl border-2 p-4 text-left text-sm font-semibold transition-all focus-visible:ring-2 focus-visible:outline-none",
                  isSel
                    ? "border-terracotta bg-halo-warm text-fg shadow-subtle scale-[1.02]"
                    : "text-fg",
                )}
                aria-pressed={isSel}
              >
                {s.label}
                {isSel ? (
                  <Check
                    aria-hidden="true"
                    strokeWidth={3}
                    className="text-terracotta-deep ml-auto inline-block h-4 w-4"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-2">
        <Label htmlFor="industry" className="text-fg text-base font-bold sm:text-lg">
          {labels.industryLabel}
          <span className="text-terracotta-deep ml-1.5 font-bold">*</span>
        </Label>
        <Input
          id="industry"
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          placeholder={labels.industryPlaceholder}
          className="h-12 rounded-lg"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="company-name" className="text-fg text-base font-bold sm:text-lg">
          {labels.companyNameLabel}
        </Label>
        <Input
          id="company-name"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder={labels.companyNamePlaceholder}
          className="h-12 rounded-lg"
          autoComplete="organization"
        />
      </div>
    </div>
  );
}

function Step3({
  labels,
  modality,
  setModality,
  city,
  setCity,
  country,
  setCountry,
  auditType,
  locale,
}: {
  labels: Labels;
  modality: ModalityKey | null;
  setModality: (m: ModalityKey) => void;
  city: string;
  setCity: (s: string) => void;
  country: string;
  setCountry: (s: string) => void;
  auditType: AuditTypeKey | null;
  locale: "fr" | "en";
}) {
  const isFr = locale === "fr";
  const remotePrice = auditType ? PRICE_TABLE[auditType].remote[locale] : null;
  const onsitePrice = auditType ? PRICE_TABLE[auditType].onsite[locale] : null;
  // Différentiel prix visible uniquement si les deux modalités ont un prix
  // distinct (Flash 490/890). Les autres niveaux ont le même prix de base.
  const hasModalityDiff = remotePrice !== onsitePrice;

  return (
    <div className="space-y-6">
      <Header
        eyebrow={labels.s3Eyebrow}
        title={labels.s3Title}
        description={labels.s3Description}
      />

      <fieldset className="space-y-3">
        <Label className="text-fg block text-base font-bold sm:text-lg">
          {labels.modalityLabel}
          <span className="text-terracotta-deep ml-1.5 font-bold">*</span>
        </Label>
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            selected={modality === "remote"}
            onClick={() => setModality("remote")}
            title={labels.modalityRemote}
            hint={labels.modalityRemoteHint}
            {...(hasModalityDiff && remotePrice ? { priceTag: remotePrice } : {})}
          />
          <ChoiceCard
            selected={modality === "onsite"}
            onClick={() => setModality("onsite")}
            title={labels.modalityOnsite}
            hint={labels.modalityOnsiteHint}
            {...(hasModalityDiff && onsitePrice ? { priceTag: onsitePrice } : {})}
          />
        </div>
        {hasModalityDiff ? (
          <p className="text-fg-muted text-[12px] leading-relaxed">
            {isFr
              ? "Le tarif sur site couvre le déplacement de notre équipe pour une journée terrain — observation directe et atelier de priorisation inclus."
              : "On-site fee covers our team's travel for a field day — direct observation and prioritisation workshop included."}
          </p>
        ) : null}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="city" className="text-fg text-base font-bold sm:text-lg">
            {labels.cityLabel}
            <span className="text-terracotta-deep ml-1.5 font-bold">*</span>
          </Label>
          <Input
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder={labels.cityPlaceholder}
            className="h-12 rounded-lg"
            autoComplete="address-level2"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="country" className="text-fg text-base font-bold sm:text-lg">
            {labels.countryLabel}
            <span className="text-terracotta-deep ml-1.5 font-bold">*</span>
          </Label>
          <Input
            id="country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder={labels.countryPlaceholder}
            className="h-12 rounded-lg"
            autoComplete="country-name"
          />
        </div>
      </div>
    </div>
  );
}

// Liste prédéfinie d'outils — multi-select Step 4. Mix outils business
// (Excel/CRM/ERP/...) + outils IA (ChatGPT/Claude/...) pour comprendre
// l'écosystème complet du client en un seul champ. "Autres" → champ libre.
const TOOL_OPTIONS: ReadonlyArray<string> = [
  "Excel",
  "CRM",
  "ERP",
  "Email",
  "Drive / Cloud",
  "Notion",
  "Slack",
  "Office 365",
  "Google Workspace",
  "Salesforce",
  "HubSpot",
  "ChatGPT",
  "Claude",
  "Copilot",
  "Mistral",
  "Gemini",
];

function Step4({
  labels,
  scope,
  setScope,
  scopeDetail,
  setScopeDetail,
  maturity,
  setMaturity,
  goals,
  setGoals,
  tools,
  setTools,
  toolsOther,
  setToolsOther,
  isFr,
}: {
  labels: Labels;
  scope: ScopeKey | null;
  setScope: (s: ScopeKey) => void;
  scopeDetail: string;
  setScopeDetail: (s: string) => void;
  maturity: MaturityKey | null;
  setMaturity: (m: MaturityKey) => void;
  goals: string;
  setGoals: (s: string) => void;
  tools: ReadonlyArray<string>;
  setTools: (t: ReadonlyArray<string>) => void;
  toolsOther: string;
  setToolsOther: (s: string) => void;
  isFr: boolean;
}) {
  // Compteurs caractères : guident le user vers le minimum 20 chars exigé
  // par le schéma Zod, sans laisser le bouton "Suivant" disabled sans
  // explication.
  const scopeChars = scopeDetail.length;
  const goalsChars = goals.length;
  const MIN = 20;

  // Toggle d'un tool dans le multi-select.
  function toggleTool(tool: string) {
    if (tools.includes(tool)) {
      setTools(tools.filter((t) => t !== tool));
    } else {
      setTools([...tools, tool]);
    }
  }

  return (
    <div className="space-y-6">
      <Header
        eyebrow={labels.s4Eyebrow}
        title={labels.s4Title}
        description={labels.s4Description}
      />

      <fieldset className="space-y-3">
        <Label className="text-fg block text-base font-bold sm:text-lg">
          {labels.scopeLabel}
          <span className="text-terracotta-deep ml-1.5 font-bold">*</span>
        </Label>
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            selected={scope === "global"}
            onClick={() => setScope("global")}
            title={labels.scopeGlobal}
            hint={labels.scopeGlobalHint}
          />
          <ChoiceCard
            selected={scope === "single-area"}
            onClick={() => setScope("single-area")}
            title={labels.scopeSingleArea}
            hint={labels.scopeSingleAreaHint}
          />
        </div>
      </fieldset>

      <div className="grid gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor="scope-detail" className="text-fg text-base font-bold sm:text-lg">
            {labels.scopeDetailLabel}
            <span className="text-terracotta-deep ml-1.5 font-bold">*</span>
          </Label>
          <span
            className={cn(
              "text-[11px] font-bold tabular-nums",
              scopeChars < MIN ? "text-fg-muted" : "text-sage",
            )}
            aria-live="polite"
          >
            {scopeChars} / {MIN}
            {scopeChars >= MIN ? (
              <Check aria-hidden="true" className="ml-1 inline h-3 w-3" strokeWidth={3} />
            ) : (
              <span className="ml-1">{isFr ? "min." : "min."}</span>
            )}
          </span>
        </div>
        <Textarea
          id="scope-detail"
          rows={3}
          value={scopeDetail}
          onChange={(e) => setScopeDetail(e.target.value)}
          placeholder={labels.scopeDetailPlaceholder}
          className="rounded-lg"
        />
      </div>

      <fieldset className="space-y-3">
        <Label className="text-fg block text-base font-bold sm:text-lg">
          {labels.maturityLabel}
          <span className="text-terracotta-deep ml-1.5 font-bold">*</span>
        </Label>
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              { key: "zero", label: labels.maturityZero },
              { key: "starting", label: labels.maturityStarting },
              { key: "mature", label: labels.maturityMature },
            ] as const
          ).map((m) => (
            <ChoiceCard
              key={m.key}
              selected={maturity === m.key}
              onClick={() => setMaturity(m.key)}
              title={m.label}
            />
          ))}
        </div>
      </fieldset>

      <div className="grid gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor="goals" className="text-fg text-base font-bold sm:text-lg">
            {labels.goalsLabel}
            <span className="text-terracotta-deep ml-1.5 font-bold">*</span>
          </Label>
          <span
            className={cn(
              "text-[11px] font-bold tabular-nums",
              goalsChars < MIN ? "text-fg-muted" : "text-sage",
            )}
            aria-live="polite"
          >
            {goalsChars} / {MIN}
            {goalsChars >= MIN ? (
              <Check aria-hidden="true" className="ml-1 inline h-3 w-3" strokeWidth={3} />
            ) : (
              <span className="ml-1">{isFr ? "min." : "min."}</span>
            )}
          </span>
        </div>
        <Textarea
          id="goals"
          rows={4}
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          placeholder={labels.goalsPlaceholder}
          className="rounded-lg"
        />
      </div>

      {/* Outils utilisés — multi-select chips, optionnel.
          Aide à contextualiser le devis (l'écosystème logiciel + outils IA
          déjà testés dictent les recommandations possibles). */}
      <fieldset className="space-y-3">
        <Label className="text-fg block text-base font-bold sm:text-lg">
          {isFr
            ? "Outils principaux que vous utilisez (optionnel)"
            : "Main tools you use (optional)"}
        </Label>
        <p className="text-fg-muted -mt-1 text-[12.5px] leading-relaxed">
          {isFr
            ? "Cliquez sur ceux qui vous concernent. Aide à calibrer le devis selon votre écosystème actuel."
            : "Click those that apply. Helps calibrate the quote against your current ecosystem."}
        </p>
        <div className="flex flex-wrap gap-2">
          {TOOL_OPTIONS.map((tool) => {
            const isSel = tools.includes(tool);
            return (
              <button
                key={tool}
                type="button"
                onClick={() => toggleTool(tool)}
                aria-pressed={isSel}
                className={cn(
                  "border-border bg-paper hover:border-terracotta focus-visible:ring-terracotta inline-flex items-center gap-1.5 rounded-full border-2 px-3.5 py-1.5 text-[13px] font-semibold transition-all focus-visible:ring-2 focus-visible:outline-none",
                  isSel && "border-terracotta bg-halo-warm text-terracotta-deep shadow-subtle",
                )}
              >
                {isSel ? (
                  <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={3} />
                ) : null}
                {tool}
              </button>
            );
          })}
        </div>
        <div className="grid gap-2 pt-1">
          <Label htmlFor="tools-other" className="text-fg-muted text-[13px] font-semibold">
            {isFr ? "Autres outils (optionnel)" : "Other tools (optional)"}
          </Label>
          <Input
            id="tools-other"
            value={toolsOther}
            onChange={(e) => setToolsOther(e.target.value)}
            placeholder={
              isFr
                ? "Ex : Pipedrive, Airtable, Asana, Zapier…"
                : "e.g. Pipedrive, Airtable, Asana, Zapier…"
            }
            className="h-11 rounded-lg"
          />
        </div>
      </fieldset>
    </div>
  );
}

function Step5({
  labels,
  contact,
  setContact,
  email,
  setEmail,
  phone,
  setPhone,
  role,
  setRole,
}: {
  labels: Labels;
  contact: string;
  setContact: (s: string) => void;
  email: string;
  setEmail: (s: string) => void;
  phone: string;
  setPhone: (s: string) => void;
  role: string;
  setRole: (s: string) => void;
}) {
  return (
    <div className="space-y-6">
      <Header
        eyebrow={labels.s5Eyebrow}
        title={labels.s5Title}
        description={labels.s5Description}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="contact" className="text-fg text-base font-bold sm:text-lg">
            {labels.contactLabel}
            <span className="text-terracotta-deep ml-1.5 font-bold">*</span>
          </Label>
          <Input
            id="contact"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            className="h-12 rounded-lg"
            autoComplete="name"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email" className="text-fg text-base font-bold sm:text-lg">
            {labels.emailLabel}
            <span className="text-terracotta-deep ml-1.5 font-bold">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-lg"
            autoComplete="email"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone" className="text-fg text-base font-bold sm:text-lg">
            {labels.phoneLabel}
          </Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-12 rounded-lg"
            autoComplete="tel"
            inputMode="tel"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="role" className="text-fg text-base font-bold sm:text-lg">
            {labels.roleLabel}
          </Label>
          <Input
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder={labels.rolePlaceholder}
            className="h-12 rounded-lg"
            autoComplete="organization-title"
          />
        </div>
      </div>
    </div>
  );
}

function Step6({
  labels,
  auditType,
  size,
  industry,
  companyName,
  modality,
  city,
  country,
  scope,
  maturity,
  tools,
  toolsOther,
  contact,
  email,
  consent,
  setConsent,
  locale,
}: {
  labels: Labels;
  auditType: AuditTypeKey | null;
  size: SizeKey | null;
  industry: string;
  companyName: string;
  modality: ModalityKey | null;
  city: string;
  country: string;
  scope: ScopeKey | null;
  maturity: MaturityKey | null;
  tools: ReadonlyArray<string>;
  toolsOther: string;
  contact: string;
  email: string;
  consent: boolean;
  setConsent: (b: boolean) => void;
  locale: "fr" | "en";
}) {
  const isFr = locale === "fr";
  const typeLabel = labels.auditTypes.find((t) => t.key === auditType)?.label ?? "—";
  const sizeLabel = labels.sizes.find((s) => s.key === size)?.label ?? "—";
  const modalityLabel =
    modality === "remote"
      ? labels.modalityRemote
      : modality === "onsite"
        ? labels.modalityOnsite
        : "—";
  const scopeLabel =
    scope === "global"
      ? labels.scopeGlobal
      : scope === "single-area"
        ? labels.scopeSingleArea
        : "—";
  const maturityLabel =
    maturity === "zero"
      ? labels.maturityZero
      : maturity === "starting"
        ? labels.maturityStarting
        : maturity === "mature"
          ? labels.maturityMature
          : "—";

  // Prix engagé — affiché en gros au-dessus du récap pour que le user
  // voie clairement ce qu'il signe avant le consentement RGPD.
  const finalPrice = priceFor(auditType, modality, locale);
  const isFlash = auditType === "flash";

  return (
    <div className="space-y-6">
      <Header
        eyebrow={labels.s6Eyebrow}
        title={labels.s6Title}
        description={labels.s6Description}
      />

      {/* Prix engagé — affiché en gros, c'est ce que le user signe */}
      <div className="bg-mocha-rich text-mocha-fg border-terracotta/30 flex flex-wrap items-center justify-between gap-5 rounded-2xl border-2 p-6 sm:p-7">
        <div className="min-w-0">
          <p className="text-mocha-fg/65 text-[10px] font-bold tracking-[0.18em] uppercase sm:text-[11px]">
            {isFr ? "Vous demandez" : "You're requesting"}
          </p>
          <p className="text-mocha-fg mt-1.5 text-lg leading-snug font-bold sm:text-xl">
            {labels.auditTypes.find((t) => t.key === auditType)?.label ?? "—"}
          </p>
          <p className="text-mocha-fg/75 mt-0.5 text-[13px]">
            {modality === "remote"
              ? labels.modalityRemote
              : modality === "onsite"
                ? labels.modalityOnsite
                : ""}
            {modality && (city || country)
              ? ` · ${city}${city && country ? ", " : ""}${country}`
              : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-mocha-fg/65 text-[10px] font-bold tracking-[0.16em] uppercase">
            {isFlash
              ? isFr
                ? "À régler"
                : "To pay"
              : isFr
                ? "Prix indicatif HT"
                : "Indicative price"}
          </p>
          <p
            className="text-terracotta-soft mt-1 text-4xl leading-none font-medium tracking-tight italic tabular-nums sm:text-5xl"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {finalPrice}
          </p>
          {!isFlash ? (
            <p className="text-mocha-fg/60 mt-1 text-[11px]">
              {isFr ? "Devis personnalisé sous 48 h" : "Personalised quote within 48 h"}
            </p>
          ) : null}
        </div>
      </div>

      <div className="bg-halo-warm border-terracotta/25 rounded-2xl border-2 p-5 sm:p-6">
        <p className="text-terracotta-deep mb-4 text-[12px] font-semibold tracking-[0.16em] uppercase">
          {labels.recapTitle}
        </p>
        <dl className="grid gap-4 sm:grid-cols-2">
          <RecapRow label={labels.recapType} value={typeLabel} />
          <RecapRow label={labels.recapSize} value={sizeLabel} />
          <RecapRow
            label={labels.recapIndustry}
            value={industry ? `${industry}${companyName ? ` · ${companyName}` : ""}` : "—"}
          />
          <RecapRow label={labels.recapModality} value={modalityLabel} />
          <RecapRow
            label={labels.recapLocation}
            value={city || country ? `${city}${city && country ? ", " : ""}${country}` : "—"}
          />
          <RecapRow label={labels.recapScope} value={scopeLabel} />
          <RecapRow label={labels.recapMaturity} value={maturityLabel} />
          {/* Outils — seulement si l'utilisateur en a sélectionné. Sinon
              on n'affiche pas la ligne pour rester aéré. */}
          {tools.length > 0 || toolsOther ? (
            <RecapRow
              label={isFr ? "Outils" : "Tools"}
              value={[...tools, ...(toolsOther ? [toolsOther] : [])].join(" · ")}
            />
          ) : null}
          <RecapRow
            label={labels.recapContact}
            value={contact || email ? `${contact}${contact && email ? " · " : ""}${email}` : "—"}
          />
        </dl>
      </div>

      <label className="bg-paper border-border hover:border-terracotta flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-colors">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="text-terracotta focus-visible:ring-terracotta mt-1 h-5 w-5 shrink-0 rounded border-2 focus-visible:ring-2 focus-visible:outline-none"
        />
        <span className="text-fg text-sm leading-relaxed">{labels.consentLabel}</span>
      </label>
    </div>
  );
}

function Header({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-terracotta-deep text-[12px] font-semibold tracking-[0.16em] uppercase">
        <span
          aria-hidden="true"
          className="bg-terracotta mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle"
        />
        {eyebrow}
      </p>
      <h2
        className="text-fg text-[clamp(1.4rem,2.4vw,2rem)] leading-tight font-medium tracking-tight"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {title}
      </h2>
      <p className="text-fg-soft text-base leading-relaxed">{description}</p>
    </div>
  );
}

function ChoiceCard({
  selected,
  onClick,
  title,
  hint,
  priceTag,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  hint?: string;
  /** Étiquette de prix optionnelle affichée en haut à droite. */
  priceTag?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "border-border bg-paper hover:border-terracotta focus-visible:ring-terracotta relative flex min-h-[76px] flex-col items-start gap-1 rounded-xl border-2 p-4 text-left transition-all focus-visible:ring-2 focus-visible:outline-none",
        selected && "border-terracotta bg-halo-warm shadow-subtle scale-[1.02]",
        priceTag && "pr-20 sm:pr-24",
      )}
    >
      <span className="text-fg text-sm font-bold sm:text-base">{title}</span>
      {hint ? (
        <span className="text-fg-soft text-xs leading-relaxed sm:text-sm">{hint}</span>
      ) : null}
      {priceTag ? (
        <span
          className="text-terracotta absolute top-3 right-3 text-lg leading-none font-medium tracking-tight italic tabular-nums sm:text-xl"
          style={{ fontFamily: "var(--font-serif)" }}
          aria-hidden="true"
        >
          {priceTag}
        </span>
      ) : null}
      {selected && !priceTag ? (
        <Sparkles aria-hidden="true" className="text-terracotta-deep ml-auto h-4 w-4 self-end" />
      ) : null}
    </button>
  );
}

function RecapRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-fg-muted text-[11px] font-semibold tracking-[0.12em] uppercase">
        {label}
      </dt>
      <dd className="text-fg mt-1 text-sm leading-snug font-semibold">{value}</dd>
    </div>
  );
}
