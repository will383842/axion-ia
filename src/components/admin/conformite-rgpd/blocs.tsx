// Conformité RGPD (console) — petits blocs d'affichage partagés par la page et la fiche.
// Server Components purs, composés des primitives de la console — aucune couleur propre.

import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { LIBELLE_GRAVITE, TON_GRAVITE, pastilleEtat } from "@/features/conformite-rgpd/regles";
import type { Ecart, Traitement } from "@/features/conformite-rgpd/schema";

export const TIRET = "—";

export function texteOuTiret(v: string | null | undefined): string {
  return v && v.trim() !== "" ? v : TIRET;
}

export function PastilleEtat({ traitement }: { traitement: Pick<Traitement, "ecarts"> }) {
  const p = pastilleEtat(traitement);
  return (
    <AdminBadge tone={p.ton} dot>
      {p.libelle}
    </AdminBadge>
  );
}

export function PastilleGravite({ gravite }: { gravite: Ecart["gravite"] }) {
  return (
    <AdminBadge tone={TON_GRAVITE[gravite]} dot>
      {LIBELLE_GRAVITE[gravite]}
    </AdminBadge>
  );
}

/** Une carte d'écart : constat, puis la correction proposée. */
export function CarteEcart({ ecart, contexte }: { ecart: Ecart; contexte?: React.ReactNode }) {
  return (
    <li className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]">
      <div className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
        <PastilleGravite gravite={ecart.gravite} />
        {ecart.statut === "corrige" ? <AdminBadge tone="success">Corrigé</AdminBadge> : null}
        {ecart.code ? (
          <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            {ecart.code}
          </span>
        ) : null}
        {contexte}
      </div>
      <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
        {texteOuTiret(ecart.constat)}
      </p>
      <p className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
        <span className="font-semibold">À faire : </span>
        {texteOuTiret(ecart.correction)}
      </p>
    </li>
  );
}
