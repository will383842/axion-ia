/**
 * BandeauEtatFonds — état des fonds de l'OPCO du client (lot OPCO A5).
 *
 * Rouge : financement suspendu pour la branche. Orange : date limite de dépôt
 * (à venir ou dépassée), ou financement réduit. Rien sans relevé. Server
 * Component : aucun JavaScript envoyé au navigateur.
 */

import type { Bandeau } from "@/server/qualiopi/financements/etat-fonds-opco";

const TON_CLS: Record<Bandeau["ton"], string> = {
  rouge:
    "border-[color:var(--color-admin-danger-border)] bg-[color:var(--color-admin-error-subtle)] text-[color:var(--color-admin-danger)]",
  orange:
    "border-[color:var(--color-admin-warning-border)] bg-[color:var(--color-admin-warning-soft)] text-[color:var(--color-admin-warning-fg)]",
};

export function BandeauEtatFonds({ bandeau }: { bandeau: Bandeau | null }) {
  if (!bandeau) return null;
  return (
    <div
      role={bandeau.ton === "rouge" ? "alert" : "status"}
      data-ton={bandeau.ton}
      className={`mb-[var(--space-admin-6)] rounded-[var(--radius-admin-md)] border px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] ${TON_CLS[bandeau.ton]}`}
    >
      <p className="font-semibold">{bandeau.texte}</p>
      {bandeau.note ? <p className="mt-1">{bandeau.note}</p> : null}
      <p className="mt-1 text-[length:var(--text-admin-xs)]">
        Source :{" "}
        <a href={bandeau.source} target="_blank" rel="noopener noreferrer" className="underline">
          {bandeau.source}
        </a>
      </p>
    </div>
  );
}
