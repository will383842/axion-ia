// Liste des périodes (préparés, envoyés, échecs, écartés), chacune liée à sa vérification.
import Link from "next/link";

import type { LignePeriode } from "@/features/apporteurs-reseau/releve-mensuel/statistiques";
import { moisLisible } from "./format";

export function ListePeriodes({
  base,
  periodes,
}: {
  /** `/fr/<adminPrefix>` */
  base: string;
  periodes: readonly LignePeriode[];
}) {
  if (periodes.length === 0) {
    return (
      <p className="text-[color:var(--color-admin-fg-muted)]">
        Aucun relevé préparé pour l&apos;instant.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[length:var(--text-admin-sm)]">
        <thead>
          <tr className="text-[color:var(--color-admin-fg-muted)]">
            <th className="py-[var(--space-admin-2)] pr-[var(--space-admin-3)]">Période</th>
            <th className="pr-[var(--space-admin-3)]">Préparés</th>
            <th className="pr-[var(--space-admin-3)]">Envoyés</th>
            <th className="pr-[var(--space-admin-3)]">Échecs</th>
            <th>Écartés</th>
          </tr>
        </thead>
        <tbody>
          {periodes.map((p) => (
            <tr key={p.periode} className="border-t border-[color:var(--color-admin-border)]">
              <td className="py-[var(--space-admin-2)] pr-[var(--space-admin-3)]">
                <Link href={`${base}/apporteurs/releves/${p.periode}`} className="underline">
                  {moisLisible(p.periode)}
                </Link>
              </td>
              <td className="pr-[var(--space-admin-3)]">{p.prepares}</td>
              <td className="pr-[var(--space-admin-3)]">{p.envoyes}</td>
              <td className="pr-[var(--space-admin-3)]">{p.echecs}</td>
              <td>{p.ecartes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
