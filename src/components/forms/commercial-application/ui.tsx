// Candidature commerciale — primitives UI du wizard (tunnel sans CV).
//
// Mobile-first STRICT (règles du brief) : zones tapables ≥ 48 px, boutons
// pleine largeur, inputs ≥ 16 px (sinon iOS zoome), chips tapables plutôt que
// <select> natifs, feedback immédiat au tap, prefers-reduced-motion respecté.
//
// Pas de directive "use client" ici : ces composants ne sont importés que par
// le wizard (client), ils héritent de sa frontière.

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Champs texte ────────────────────────────────────────────────────────────

export const FIELD_CLASS =
  "border-border bg-bg focus:border-terracotta focus:ring-terracotta/20 w-full min-h-[52px] rounded-xl border px-4 py-3 text-base outline-none focus:ring-4";

export const LABEL_CLASS = "text-fg mb-1.5 block text-sm font-semibold";

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  fieldId: string;
  error?: string | undefined;
  optionalHint?: boolean;
}

export function TextField({ label, fieldId, error, optionalHint, ...rest }: TextFieldProps) {
  return (
    <div>
      <label className={LABEL_CLASS} htmlFor={fieldId}>
        {label}
        {optionalHint ? (
          <span className="text-fg-muted ml-1.5 font-normal">(facultatif)</span>
        ) : null}
      </label>
      <input
        id={fieldId}
        className={cn(FIELD_CLASS, error && "border-terracotta-deep")}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        {...rest}
      />
      {error ? (
        <p id={`${fieldId}-error`} className="text-terracotta-deep mt-1.5 text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// ── Chips (choix unique ou multiple) ────────────────────────────────────────
//
// Inputs radio/checkbox natifs masqués (sr-only) : clavier + lecteur d’écran
// gratuits, l’anneau de focus est porté par focus-within sur le label.

interface ChipProps {
  name: string;
  value: string;
  label: string;
  hint?: string;
  checked: boolean;
  multi?: boolean;
  onToggle: (value: string) => void;
  /** Chip pleine largeur mise en avant (ex. « Peu importe, je suis mobile »). */
  prominent?: boolean;
}

export function Chip({ name, value, label, hint, checked, multi, onToggle, prominent }: ChipProps) {
  return (
    <label
      className={cn(
        "group relative flex min-h-[48px] cursor-pointer items-center gap-2.5 rounded-2xl border-2 px-4 py-3 transition-colors select-none",
        "focus-within:ring-terracotta focus-within:ring-2 focus-within:ring-offset-2",
        prominent && "w-full justify-center py-4 text-center",
        checked
          ? "border-terracotta bg-terracotta-soft"
          : "border-border bg-bg hover:border-fg-muted/40 active:bg-paper",
      )}
    >
      <input
        type={multi ? "checkbox" : "radio"}
        name={name}
        value={value}
        checked={checked}
        onChange={() => onToggle(value)}
        className="sr-only"
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block leading-snug font-semibold",
            prominent ? "text-base" : "text-[15px]",
            checked ? "text-terracotta-deep" : "text-fg",
          )}
        >
          {label}
        </span>
        {hint ? (
          <span className="text-fg-muted mt-0.5 block text-[13px] leading-snug">{hint}</span>
        ) : null}
      </span>
      {/* Pastille d’état — repère non chromatique (daltonisme, WCAG 1.4.1). */}
      <span
        aria-hidden="true"
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          checked ? "border-terracotta bg-terracotta text-white" : "border-border bg-bg",
        )}
      >
        {checked ? <Check strokeWidth={3.5} className="h-3 w-3" /> : null}
      </span>
    </label>
  );
}

interface ChipGroupProps {
  legend: string;
  error?: string | undefined;
  optionalHint?: boolean;
  columns?: 1 | 2;
  children: React.ReactNode;
}

export function ChipGroup({ legend, error, optionalHint, columns = 2, children }: ChipGroupProps) {
  return (
    <fieldset>
      <legend className={LABEL_CLASS}>
        {legend}
        {optionalHint ? (
          <span className="text-fg-muted ml-1.5 font-normal">(facultatif)</span>
        ) : null}
      </legend>
      <div className={cn("grid gap-2", columns === 2 && "grid-cols-2")}>{children}</div>
      {error ? (
        <p className="text-terracotta-deep mt-1.5 text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

// ── Boutons ─────────────────────────────────────────────────────────────────

export function PrimaryButton({
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "bg-primary text-primary-fg hover:bg-primary-hover inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-base font-semibold shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)] transition-colors active:scale-[0.99] disabled:opacity-60 motion-reduce:active:scale-100",
        "focus-visible:ring-terracotta focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "text-fg-soft hover:text-terracotta-deep inline-flex min-h-[48px] items-center gap-2 rounded-full px-4 text-[15px] font-semibold transition-colors",
        "focus-visible:ring-terracotta focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

// ── Transition d’écran ──────────────────────────────────────────────────────
//
// Micro-animation fade + translation, désarmée par prefers-reduced-motion
// (motion-reduce:transition-none → l’état final s’affiche sans mouvement).

export function StepTransition({ children }: { children: React.ReactNode }) {
  const [entered, setEntered] = React.useState(false);
  React.useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div
      className={cn(
        "transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none",
        entered ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
      )}
    >
      {children}
    </div>
  );
}

// ── Titre d’étape ───────────────────────────────────────────────────────────

export function StepHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-fg text-[26px] leading-[1.15] font-bold tracking-tight text-balance sm:text-[30px]">
        {title}
      </h2>
      {hint ? (
        <p className="text-fg-soft mt-2.5 text-[15px] leading-relaxed text-pretty">{hint}</p>
      ) : null}
    </div>
  );
}

// ── Sélecteur mois + année ──────────────────────────────────────────────────
//
// Deux <select> natifs assumés : 12 mois × ~15 ans ne se traitent pas en
// chips (le brief interdit le select quand un choix VISUEL est possible — ici
// il ne l’est pas). Hauteur 52 px, texte 16 px.

interface MonthYearProps {
  idPrefix: string;
  label: string;
  monthValue: string;
  yearValue: string;
  years: readonly string[];
  months: readonly string[];
  onMonthChange: (v: string) => void;
  onYearChange: (v: string) => void;
  error?: string | undefined;
  disabled?: boolean;
  optionalHint?: boolean;
}

export function MonthYearSelect({
  idPrefix,
  label,
  monthValue,
  yearValue,
  years,
  months,
  onMonthChange,
  onYearChange,
  error,
  disabled,
  optionalHint,
}: MonthYearProps) {
  return (
    <div>
      <label className={LABEL_CLASS} htmlFor={`${idPrefix}-mois`}>
        {label}
        {optionalHint ? (
          <span className="text-fg-muted ml-1.5 font-normal">(facultatif)</span>
        ) : null}
      </label>
      <div className="grid grid-cols-2 gap-2">
        <select
          id={`${idPrefix}-mois`}
          className={cn(FIELD_CLASS, "appearance-none", error && "border-terracotta-deep")}
          value={monthValue}
          onChange={(e) => onMonthChange(e.target.value)}
          disabled={disabled}
          aria-label={`${label} — mois`}
          aria-invalid={error ? true : undefined}
        >
          <option value="">Mois</option>
          {months.map((m, i) => (
            <option key={m} value={String(i + 1).padStart(2, "0")}>
              {m}
            </option>
          ))}
        </select>
        <select
          id={`${idPrefix}-annee`}
          className={cn(FIELD_CLASS, "appearance-none", error && "border-terracotta-deep")}
          value={yearValue}
          onChange={(e) => onYearChange(e.target.value)}
          disabled={disabled}
          aria-label={`${label} — année`}
          aria-invalid={error ? true : undefined}
        >
          <option value="">Année</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <p className="text-terracotta-deep mt-1.5 text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
