"use client";
// use-client: role=alert + aria-live=assertive pour feedback immédiat.
//
// Refonte admin — sprint correctif SP-01.
//
// Bannière d'erreur inline pour les formulaires admin.
// Affichée sous le formulaire quand une Server Action échoue.
//
// Usage :
//   const [error, setError] = useState<string | null>(null);
//   ...
//   {error && <AdminFormError message={error} onDismiss={() => setError(null)} />}

import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface AdminFormErrorProps {
  /** Message d'erreur à afficher. */
  message: string;
  /** Callback optionnel pour fermer la bannière. */
  onDismiss?: () => void;
  className?: string;
}

export function AdminFormError({
  message,
  onDismiss,
  className,
}: AdminFormErrorProps): React.ReactElement {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "flex items-start justify-between gap-[var(--space-admin-4)]",
        "rounded-[var(--radius-admin-md)] border",
        "border-[color:var(--color-admin-destructive)]",
        "bg-[color:var(--color-admin-destructive-soft,_color-mix(in_srgb,_var(--color-admin-destructive)_10%,_transparent))]",
        "px-[var(--space-admin-5)] py-[var(--space-admin-4)]",
        "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-destructive)]",
        className,
      )}
    >
      <span className="flex-1">{message}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fermer le message d'erreur"
          className="shrink-0 opacity-70 hover:opacity-100"
        >
          <X size={14} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
