import Link from "next/link";
import { Clock } from "lucide-react";

import type { HorodatageEnRetard } from "@/server/qualiopi/documents/signature/lire-horodatages";

/** Page « À traiter » : horodatages de signature en attente depuis plus de 24 h (lecture seule). */
export function BlocHorodatagesEnRetard({
  lignes,
  base,
}: {
  /** `null` = lecture impossible. */
  lignes: readonly HorodatageEnRetard[] | null;
  base: string;
}): React.ReactElement | null {
  const carte =
    "mb-[var(--space-admin-6)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)]";
  if (lignes === null) {
    return (
      <div className={carte}>
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-danger)]">
          Les horodatages en attente n&apos;ont pas pu être lus : leur absence ci-dessous n&apos;est
          PAS un constat.
        </p>
      </div>
    );
  }
  if (lignes.length === 0) return null;
  return (
    <div className={carte}>
      <h2 className="mb-[var(--space-admin-3)] flex items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        <Clock size={18} aria-hidden="true" className="shrink-0" />
        Horodatages en attente depuis plus de 24 h
      </h2>
      <ul>
        {lignes.map((l) => (
          <li
            key={l.id}
            className="flex flex-wrap items-center justify-between gap-[var(--space-admin-2)] border-b border-[color:var(--color-admin-border)] py-[var(--space-admin-2)] last:border-b-0"
          >
            <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
              <strong>{l.numero}</strong> — en attente depuis le{" "}
              {l.depuis.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })} ({l.essais} essai
              {l.essais > 1 ? "s" : ""})
            </span>
            {l.devisId !== null ? (
              <Link href={`${base}/qualiopi/devis/${l.devisId}`} className="admin-link">
                Ouvrir le devis
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
