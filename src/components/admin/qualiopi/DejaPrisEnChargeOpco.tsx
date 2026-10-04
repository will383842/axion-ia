/**
 * DejaPrisEnChargeOpco — ce que l'OPCO a déjà pris en charge pour ce client,
 * année en cours et année précédente (lot OPCO A7d). Lecture seule.
 *
 * « Accordé » : dossiers accordés, facturés, payés ou clos. « En cours » :
 * demandes déposées sans réponse. Année civile de la session (cf.
 * `consommation-opco.ts`). Server Component : aucun JavaScript envoyé.
 */

import type { ConsommationOpco } from "@/server/qualiopi/financements/consommation-opco";

const eur = (cents: number): string =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

export function DejaPrisEnChargeOpco({
  opcoLibelle,
  lignes,
}: {
  /** Libellé de l'OPCO du client (`opcoDuClient`), ou `null` s'il n'est pas déterminé. */
  opcoLibelle: string | null;
  /** Années à afficher, la plus récente en premier ; `null` = lecture impossible. */
  lignes: ReadonlyArray<ConsommationOpco> | null;
}) {
  const texteCls = "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]";
  return (
    <div
      data-bloc="deja-pris-en-charge-opco"
      className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]"
    >
      <h2 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        Déjà pris en charge par l&apos;OPCO{opcoLibelle ? ` (${opcoLibelle})` : ""}
      </h2>
      {opcoLibelle === null ? (
        <p className={texteCls}>
          L&apos;OPCO de ce client n&apos;est pas déterminé : renseignez sa branche pour suivre ce
          que l&apos;OPCO a déjà pris en charge.
        </p>
      ) : lignes === null ? (
        <p className={texteCls}>Lecture des dossiers de financement indisponible.</p>
      ) : (
        <table className="w-full text-left text-[length:var(--text-admin-sm)]">
          <thead className="text-[length:var(--text-admin-xs)] tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
            <tr>
              <th scope="col" className="py-1 pr-4 font-medium">
                Année
              </th>
              <th scope="col" className="py-1 pr-4 font-medium">
                Accordé
              </th>
              <th scope="col" className="py-1 font-medium">
                En cours
              </th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.annee} className="border-t border-[color:var(--color-admin-border)]">
                <td className="py-1 pr-4 font-mono">{l.annee}</td>
                <td className="py-1 pr-4 font-mono">{eur(l.accordeCents)}</td>
                <td className="py-1 font-mono">{eur(l.enCoursCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        Accordé : dossiers accordés, facturés, payés ou clos. En cours : demandes déposées, sans
        réponse de l&apos;OPCO. Année civile de la session financée.
      </p>
    </div>
  );
}
