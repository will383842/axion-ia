/**
 * Lot L4 (2026-09-30), correction de revue — les écrans retirés de la barre
 * latérale (`parent`), listés en liens sur leur page parente. Sans ce bloc, ils
 * ne restaient trouvables que par ⌘K. Server Component, aucun JS client.
 *
 * La liste vient de `ecransRattaches` (dérivée du menu, jamais recopiée).
 */

import Link from "next/link";

import { ecransRattaches } from "@/lib/admin-nav";

export function EcransRattaches({
  adminPrefix,
  parent,
  titre,
}: {
  adminPrefix: string;
  /** Chemin de la page courante sans préfixe, ex. `qualiopi/formations`. */
  parent: string;
  titre: string;
}): React.ReactElement | null {
  const ecrans = ecransRattaches(adminPrefix, parent);
  if (ecrans.length === 0) return null;
  return (
    <nav
      aria-label={titre}
      className="mb-[var(--space-admin-6)] text-[length:var(--text-admin-sm)]"
    >
      <p className="mb-[var(--space-admin-2)] font-medium text-[color:var(--color-admin-fg)]">
        {titre}
      </p>
      <ul className="flex flex-wrap gap-x-[var(--space-admin-4)] gap-y-[var(--space-admin-2)]">
        {ecrans.map((it) => (
          <li key={it.href}>
            <Link href={it.href} className="underline">
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
