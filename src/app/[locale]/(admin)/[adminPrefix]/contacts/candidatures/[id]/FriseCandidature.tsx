/**
 * LA FRISE d'une candidature — composant SERVEUR.
 *
 * Aucun état, aucun geste : elle ne fait que rendre ce que le journal contient.
 * La garder serveur évite d'envoyer au navigateur le contenu des échanges dans
 * un payload de props, et lui épargne un composant client de plus.
 *
 * ## Ce que chaque ligne dit, et dans quel ordre
 *
 * Du plus récent au plus ancien, sur la date du FAIT — pas celle de la saisie.
 * Un appel passé lundi et consigné mardi se lit à lundi ; c'est ce qui permet de
 * relire un dossier comme une histoire plutôt que comme un journal de frappe.
 *
 * Une réponse envoyée porte EN PLUS l'état de sa livraison. Les deux faits sont
 * distincts : « j'ai répondu lundi » et « ce n'est jamais parti » doivent
 * pouvoir coexister sur la même ligne, sinon on ne relance jamais personne.
 */

import { AdminBadge } from "@/components/admin/ui";
import { LIBELLE_EVENEMENT, LIBELLE_LIVRAISON } from "@/features/admin-job-applications/timeline";
import type { EntreeFrise } from "@/features/admin-job-applications/timeline";

/** Ton du badge de livraison. Le vert ne vaut que pour une remise CONFIRMÉE. */
const TON_LIVRAISON: Record<string, "success" | "warning" | "destructive" | "neutral"> = {
  sent: "success",
  pending: "warning",
  failed: "destructive",
  bounced: "destructive",
};

const DATE_FR = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  dateStyle: "medium",
  timeStyle: "short",
});

export function FriseCandidature({
  entrees,
}: {
  entrees: ReadonlyArray<EntreeFrise>;
}): React.ReactElement {
  if (entrees.length === 0) {
    return (
      <p className="admin-meta-small">
        Rien n’a encore été consigné. Une réponse, un appel ou une note apparaîtront ici, dans
        l’ordre des faits.
      </p>
    );
  }

  return (
    <ol className="m-0 list-none p-0">
      {entrees.map((e) => (
        <li
          key={e.id}
          className="border-border-subtle border-l-2 pb-[var(--space-admin-4)] pl-[var(--space-admin-4)] last:pb-0"
        >
          <div className="flex flex-wrap items-baseline gap-x-[var(--space-admin-3)]">
            <span className="text-[length:var(--text-admin-sm)] font-semibold">
              {LIBELLE_EVENEMENT[e.type]}
            </span>
            <span className="admin-meta-small">
              {DATE_FR.format(e.occurredAt)} · {e.authorName}
            </span>
            {e.livraison ? (
              <AdminBadge tone={TON_LIVRAISON[e.livraison.statut] ?? "neutral"}>
                {LIBELLE_LIVRAISON[e.livraison.statut]}
                {e.livraison.reessais > 0 ? ` · ${e.livraison.reessais} réessai(s)` : ""}
              </AdminBadge>
            ) : null}
          </div>

          <p className="text-[length:var(--text-admin-sm)]">{e.summary}</p>

          {/* 🔴 L'erreur d'envoi est affichée EN ENTIER, pas résumée. C'est elle
              qui distingue « clé de chiffrement absente » de « boîte pleine » —
              deux pannes qui n'appellent pas le même geste, et qu'un libellé
              générique rendrait indiscernables. */}
          {e.livraison?.erreur ? (
            <p role="alert" className="admin-alert admin-alert-error">
              {e.livraison.erreur}
            </p>
          ) : null}

          {e.body && e.body !== e.summary ? (
            <details className="mt-[var(--space-admin-2)]">
              <summary className="admin-meta-small cursor-pointer">Voir le détail</summary>
              <p className="admin-meta-small mt-[var(--space-admin-2)] whitespace-pre-wrap">
                {e.body}
              </p>
            </details>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
