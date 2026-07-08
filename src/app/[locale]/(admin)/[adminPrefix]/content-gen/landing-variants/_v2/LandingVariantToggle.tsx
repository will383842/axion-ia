"use client";
// use-client: toggle interactif (useTransition + router.refresh) pour activer/
// désactiver une variante de landing. Délègue à setLandingVariantActiveAction.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLandingVariantActiveAction } from "@/server/actions/content-gen/landing-variants";

export interface LandingVariantToggleProps {
  slug: string;
  active: boolean;
  /** « default » = base non désactivable → affiche un état verrouillé. */
  locked?: boolean;
}

export function LandingVariantToggle({
  slug,
  active,
  locked = false,
}: LandingVariantToggleProps): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (locked) {
    return (
      <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        ✅ Toujours actif
      </span>
    );
  }

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await setLandingVariantActiveAction(slug, !active);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-[var(--space-admin-2)]">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={active}
        className="admin-button-ghost"
      >
        {pending ? "…" : active ? "✅ Actif — désactiver" : "🚫 Inactif — activer"}
      </button>
      {error ? (
        <span
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </span>
      ) : null}
    </span>
  );
}
