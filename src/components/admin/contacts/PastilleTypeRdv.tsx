// Pastille du TYPE de rendez-vous — Diagnostic IA, Échange projet, Apporteur,
// Salon ; « Autre » en texte discret (2026-10-04, lot L3).
//
// Remplace la pastille binaire « Client » / « Apporteur » du 19/09. Composant
// SERVEUR (aucun état) : zéro octet de JavaScript ajouté à la console.
//
// Pour un échange projet, le service choisi dans le formulaire (« Formation »…)
// s'affiche en petit à côté : c'est ce qu'on veut savoir avant d'appeler.

import { LIBELLE_TYPE_RDV, TEINTE_TYPE_RDV } from "@/features/admin-rendezvous/type-rdv";
import type { TypeRendezVous } from "@/server/calendly/type-rendez-vous";

export function PastilleTypeRdv({
  type,
  besoin = null,
}: {
  type: TypeRendezVous;
  besoin?: string | null;
}): React.ReactElement {
  const teinte = TEINTE_TYPE_RDV[type];
  const libelle = LIBELLE_TYPE_RDV[type];
  const pastille =
    teinte === null ? (
      <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        {libelle}
      </span>
    ) : (
      <span
        className="inline-flex items-center rounded-[var(--radius-admin-sm)] px-2 py-0.5 text-[length:var(--text-admin-xs)] font-medium"
        style={{
          background: `var(--color-admin-id-${teinte}-soft)`,
          color: `var(--color-admin-id-${teinte})`,
        }}
      >
        {libelle}
      </span>
    );
  if (type !== "echange_projet" || !besoin) return pastille;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {pastille}
      <span
        className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
        title="Service choisi dans le formulaire de réservation"
      >
        {besoin}
      </span>
    </span>
  );
}
