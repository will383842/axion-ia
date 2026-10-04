/**
 * EstimationBaremeOpco — ce que l'OPCO du client donnerait au barème, en
 * LECTURE SEULE, sur la page Financement de la session (lot OPCO A7b).
 *
 * Toujours dit indicatif : seul l'accord de l'OPCO fait foi. L'avertissement de
 * l'estimation (aucun barème, barème incomplet, 50 salariés et plus) est repris
 * tel quel. Server Component : aucun JavaScript envoyé au navigateur.
 */

import type { OpcoCoverageResult } from "@/server/qualiopi/crm/devis";

const EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

const labelCls =
  "text-[length:var(--text-admin-xs)] tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase";
const valeurCls =
  "mt-0.5 text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]";

export function EstimationBaremeOpco({
  estimation,
}: {
  estimation: OpcoCoverageResult | null;
}): React.ReactElement | null {
  if (!estimation) return null;
  // Un avertissement « Estimation indicative : … » se suffit ; sinon on le dit.
  const note =
    estimation.avertissement ?? "Estimation indicative : seul l'accord de l'OPCO fait foi.";
  return (
    <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]">
      <div className="grid grid-cols-2 gap-[var(--space-admin-3)]">
        <div>
          <p className={labelCls}>Prise en charge estimée</p>
          <p className={valeurCls}>{EUR.format(estimation.montantPriseEnChargeCents / 100)}</p>
        </div>
        <div>
          <p className={labelCls}>Reste à charge estimé</p>
          <p className={valeurCls}>{EUR.format(estimation.resteAChargeCents / 100)}</p>
        </div>
      </div>
      <p
        role="note"
        className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
      >
        {note.startsWith("Estimation indicative") ? note : `Estimation indicative — ${note}`}
      </p>
    </div>
  );
}
