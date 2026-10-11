// Conformité RGPD (console) — petits blocs d'affichage partagés par la page et la fiche.
// Server Components purs, composés des primitives de la console — aucune couleur propre.

import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminSubmitButton } from "@/components/admin/ui/AdminSubmitButton";
import {
  marquerEcartCorrigeAction,
  rouvrirEcartAction,
} from "@/features/conformite-rgpd/actions-ecarts";
import type { EcartBase } from "@/features/conformite-rgpd/base";
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

const dateCourte = (d: Date) =>
  d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Paris",
  });

/** Où revenir après un geste : la liste, le sous-onglet « Corrigés » ou la fiche. */
export type RetourGeste = { vers: "points" | "corriges" } | { vers: "fiche"; cle: string };

/**
 * « Marquer corrigé » (note facultative) ou « Rouvrir ». Affiché aux administrateurs ;
 * le rôle est revérifié par l'action serveur.
 */
export function GestesEcart({ ecart, retour }: { ecart: EcartBase; retour: RetourGeste }) {
  const caches = (
    <>
      <input type="hidden" name="ecartId" value={ecart.id} />
      <input type="hidden" name="retour" value={retour.vers} />
      {retour.vers === "fiche" ? <input type="hidden" name="cle" value={retour.cle} /> : null}
    </>
  );
  if (ecart.statut === "corrige") {
    return (
      <form action={rouvrirEcartAction} className="mt-[var(--space-admin-3)]">
        {caches}
        <button type="submit" className="admin-button-secondary admin-button-sm">
          Rouvrir
        </button>
      </form>
    );
  }
  return (
    <form
      action={marquerEcartCorrigeAction}
      className="mt-[var(--space-admin-3)] flex flex-wrap items-end gap-[var(--space-admin-2)]"
    >
      {caches}
      <label className="flex min-w-[14rem] flex-1 flex-col gap-[var(--space-admin-1)]">
        <span className="admin-label">Note (facultatif)</span>
        <input type="text" name="note" maxLength={2000} className="admin-input" />
      </label>
      <AdminSubmitButton pendingLabel="Enregistrement…">Marquer corrigé</AdminSubmitButton>
    </form>
  );
}

/** Une carte d'écart : constat, puis la correction proposée. */
export function CarteEcart({
  ecart,
  contexte,
  gestes,
}: {
  ecart: Ecart | EcartBase;
  contexte?: React.ReactNode;
  gestes?: React.ReactNode;
}) {
  const suivi = "corrigeLe" in ecart ? ecart : null;
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
      {suivi && ecart.statut === "corrige" && suivi.corrigeLe ? (
        <p className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          Corrigé le {dateCourte(suivi.corrigeLe)}
          {suivi.corrigeParNom ? ` par ${suivi.corrigeParNom}` : ""}
          {suivi.note ? ` — ${suivi.note}` : ""}
        </p>
      ) : null}
      {gestes}
    </li>
  );
}
