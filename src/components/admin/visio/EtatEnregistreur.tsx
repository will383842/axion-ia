// État de l'enregistreur (PR 5) — composant SERVEUR, sans JavaScript client.
//
// Utilisé par la page « Enregistreur » ; destiné aussi au panneau « État du
// circuit » de la PR 4 (témoin de clé, drapeau vu par le site et le worker,
// extension silencieuse). Le jeton n'expire pas (révision du 02/10).

import { AdminBadge } from "@/components/admin/ui";
import type { EtatEnregistreur as Etat } from "@/features/admin-enregistreur/queries";

const LIBELLE_MODE = {
  ferme: "Fermé : rien ne s'enregistre",
  pilote: "Pilote : seul le rendez-vous de test s'enregistre",
  ouvert: "Ouvert : les rendez-vous « Discutons » s'enregistrent (avec l'accord oral)",
} as const;

function dateCourte(d: Date | null): string {
  if (!d) return "jamais";
  return d.toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function EtatEnregistreur({ etat }: { readonly etat: Etat }): React.ReactElement {
  const temoinOk = etat.temoinSite !== "absent" && etat.temoinSite.ok;
  return (
    <dl className="grid grid-cols-1 gap-[var(--space-admin-2)] sm:grid-cols-[max-content_1fr]">
      <dt className="font-medium">Mode vu par le site</dt>
      <dd>
        {LIBELLE_MODE[etat.drapeau.effectif]}
        {etat.drapeau.motif ? (
          <span className="block text-sm text-[color:var(--color-admin-fg-soft)]">
            {etat.drapeau.motif}
          </span>
        ) : null}
      </dd>

      <dt className="font-medium">Clients actifs (préavis)</dt>
      <dd>{etat.preavis}</dd>

      <dt className="font-medium">Mode vu par le worker</dt>
      <dd>{etat.drapeauVuParWorker ?? "pas encore de battement"}</dd>

      <dt className="font-medium">Clé de chiffrement (site)</dt>
      <dd>
        {etat.temoinSite === "absent" ? (
          <AdminBadge tone="neutral">
            pas encore vérifiée (aucun appel de l&apos;extension)
          </AdminBadge>
        ) : temoinOk ? (
          <AdminBadge tone="success">prête</AdminBadge>
        ) : (
          <AdminBadge tone="destructive">
            absente ou différente : rien ne s&apos;enregistre
          </AdminBadge>
        )}
      </dd>

      <dt className="font-medium">Clé de chiffrement (worker)</dt>
      <dd>
        {etat.temoinWorkerOkLe ? (
          <>relue le {dateCourte(etat.temoinWorkerOkLe)}</>
        ) : (
          <AdminBadge tone="warning">pas encore relue par le worker</AdminBadge>
        )}
      </dd>
    </dl>
  );
}
