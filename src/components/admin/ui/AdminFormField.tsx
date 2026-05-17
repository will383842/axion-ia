// Refonte admin mai 2026 — PR 3 (ADR 0028, audit A7 duplication #4 / A5 #9).
//
// Champ form unifié : label + input/textarea/select + hint + error inline.
// 311 inputs admin réinventent ce pattern → primitive obligatoire.
//
// A11y :
//  - label ↔ input via htmlFor/id.
//  - aria-invalid + aria-errormessage sur erreur (WCAG 3.3.1).
//  - aria-describedby pour hint (WCAG 1.3.1).
//  - aria-required="true" si required.
//
// Server Component (les inputs HTML standards sont serveur-safe).

import { cn } from "@/lib/utils";

type AdminFormFieldType =
  | "text"
  | "email"
  | "tel"
  | "url"
  | "number"
  | "password"
  | "search"
  | "date"
  | "datetime-local"
  | "textarea"
  | "select";

interface AdminFormFieldBaseProps {
  label: string;
  name: string;
  type: AdminFormFieldType;
  required?: boolean;
  hint?: string;
  error?: string;
  defaultValue?: string;
  placeholder?: string;
  /** Désactive le champ (form en submission, lecture seule). */
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

interface AdminFormFieldTextareaExtras {
  /** Pour type="textarea" : nb de lignes par défaut. */
  rows?: number;
}

interface AdminFormFieldSelectExtras {
  /** Pour type="select" : options. */
  options?: ReadonlyArray<{ value: string; label: string }>;
}

type AdminFormFieldProps = AdminFormFieldBaseProps &
  AdminFormFieldTextareaExtras &
  AdminFormFieldSelectExtras;

export function AdminFormField({
  label,
  name,
  type,
  required = false,
  hint,
  error,
  defaultValue,
  placeholder,
  disabled = false,
  autoFocus = false,
  rows = 4,
  options = [],
  className,
}: AdminFormFieldProps): React.ReactElement {
  const fieldId = `admin-field-${name}`;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const hasError = Boolean(error);

  const inputClass = cn(
    "w-full rounded-[var(--radius-admin-md)] border bg-[color:var(--color-admin-paper)]",
    "px-[var(--space-admin-5)] py-[var(--space-admin-4)]",
    "text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg)]",
    "border-[color:var(--color-admin-border)]",
    "focus:border-[color:var(--color-admin-info)] focus:outline-none",
    "focus-visible:ring-2 focus-visible:ring-[color:var(--color-admin-info)] focus-visible:ring-offset-2",
    "disabled:cursor-not-allowed disabled:opacity-60",
    hasError &&
      "border-[color:var(--color-admin-destructive)] focus:border-[color:var(--color-admin-destructive)]",
  );

  return (
    <div className={cn("admin-form-field flex flex-col gap-[var(--space-admin-2)]", className)}>
      <label
        htmlFor={fieldId}
        className={cn(
          "text-[length:var(--text-admin-sm)] font-medium",
          "text-[color:var(--color-admin-fg)]",
        )}
      >
        {label}
        {required ? (
          <span
            aria-hidden="true"
            className="ml-[var(--space-admin-2)] text-[color:var(--color-admin-destructive)]"
          >
            *
          </span>
        ) : null}
      </label>
      {type === "textarea" ? (
        <textarea
          id={fieldId}
          name={name}
          rows={rows}
          required={required}
          defaultValue={defaultValue}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-required={required}
          aria-invalid={hasError}
          aria-errormessage={errorId}
          aria-describedby={describedBy}
          className={inputClass}
        />
      ) : type === "select" ? (
        <select
          id={fieldId}
          name={name}
          required={required}
          defaultValue={defaultValue}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-required={required}
          aria-invalid={hasError}
          aria-errormessage={errorId}
          aria-describedby={describedBy}
          className={inputClass}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={fieldId}
          name={name}
          type={type}
          required={required}
          defaultValue={defaultValue}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-required={required}
          aria-invalid={hasError}
          aria-errormessage={errorId}
          aria-describedby={describedBy}
          className={inputClass}
        />
      )}
      {hint ? (
        <small
          id={hintId}
          className={cn(
            "text-[length:var(--text-admin-xs)]",
            "text-[color:var(--color-admin-fg-muted)]",
          )}
        >
          {hint}
        </small>
      ) : null}
      {error ? (
        <small
          id={errorId}
          role="alert"
          className={cn(
            "text-[length:var(--text-admin-sm)]",
            "text-[color:var(--color-admin-destructive)]",
          )}
        >
          {error}
        </small>
      ) : null}
    </div>
  );
}

interface AdminFormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Si true, rendu dans `<details>` collapsible. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
}

export function AdminFormSection({
  title,
  description,
  children,
  collapsible = false,
  defaultOpen = true,
  className,
}: AdminFormSectionProps): React.ReactElement {
  const heading = (
    <div className="mb-[var(--space-admin-5)]">
      <h3
        className={cn(
          "text-[length:var(--text-admin-lg)] font-semibold",
          "text-[color:var(--color-admin-fg)]",
        )}
      >
        {title}
      </h3>
      {description ? (
        <p
          className={cn(
            "mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]",
            "text-[color:var(--color-admin-fg-soft)]",
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
  const body = <div className="flex flex-col gap-[var(--space-admin-5)]">{children}</div>;

  if (collapsible) {
    return (
      <details
        open={defaultOpen}
        className={cn(
          "admin-form-section group mb-[var(--space-admin-7)] border-b border-[color:var(--color-admin-border)] pb-[var(--space-admin-6)] last:border-b-0",
          className,
        )}
      >
        <summary
          className={cn(
            "cursor-pointer list-none select-none",
            "text-[length:var(--text-admin-lg)] font-semibold",
            "text-[color:var(--color-admin-fg)]",
            "mb-[var(--space-admin-5)]",
          )}
        >
          {title}
        </summary>
        {description ? (
          <p
            className={cn(
              "mb-[var(--space-admin-5)] text-[length:var(--text-admin-sm)]",
              "text-[color:var(--color-admin-fg-soft)]",
            )}
          >
            {description}
          </p>
        ) : null}
        {body}
      </details>
    );
  }

  return (
    <section
      className={cn(
        "admin-form-section mb-[var(--space-admin-7)] border-b border-[color:var(--color-admin-border)] pb-[var(--space-admin-6)] last:border-b-0",
        className,
      )}
    >
      {heading}
      {body}
    </section>
  );
}
