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
 *
 * ## L'accusé de réception automatique — la ligne la plus ancienne
 *
 * 🔴 Ajoutée le 2026-09-18. Une fiche dont l'accusé était livré affichait
 * « Rien n'a encore été consigné » ; une fiche dont l'accusé était en échec
 * affichait EXACTEMENT la même chose. L'accusé se lit désormais en bas de la
 * frise (c'est le premier fait du dossier), avec son état réel — et son
 * ABSENCE se dit aussi. Il n'est pas un geste humain : il ne compte pas comme
 * une réponse, et la frise le rappelle. Cf. `accuse-reception.ts`.
 */

import { AdminBadge } from "@/components/admin/ui";
import { LIBELLE_EVENEMENT, LIBELLE_LIVRAISON } from "@/features/admin-job-applications/timeline";
import type { EntreeFrise } from "@/features/admin-job-applications/timeline";
import type { AccuseReception } from "@/features/admin-job-applications/accuse-reception";

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

/** Ton et libellé du badge de l'accusé, par état. */
const BADGE_ACCUSE: Record<
  AccuseReception["etat"],
  { tone: "success" | "warning" | "destructive" | "neutral"; libelle: string }
> = {
  envoye: { tone: "success", libelle: "envoyé" },
  en_attente: { tone: "warning", libelle: "en file d’envoi" },
  echec: { tone: "destructive", libelle: "échec d’envoi" },
  rebond: { tone: "destructive", libelle: "refusé par le destinataire" },
  annule: { tone: "neutral", libelle: "annulé" },
  absent: { tone: "neutral", libelle: "introuvable" },
};

function phraseAccuse(a: AccuseReception): string {
  const le = a.date ? ` le ${DATE_FR.format(a.date)}` : "";
  switch (a.etat) {
    case "envoye":
      return a.essais > 1
        ? `L’accusé de réception automatique est parti${le}, au ${a.essais}ᵉ essai : les tentatives précédentes avaient échoué. Ce n’est pas une réponse — la candidature reste à traiter.`
        : `L’accusé de réception automatique est parti${le}. Ce n’est pas une réponse — la candidature reste à traiter.`;
    case "en_attente":
      return `L’accusé de réception automatique est en file d’envoi depuis${le} : il n’est pas encore parti.`;
    case "echec":
      return `L’accusé de réception automatique n’est pas parti (échec${le}). Il peut être renvoyé depuis « E-mails envoyés ».`;
    case "rebond":
      return `L’accusé de réception automatique a été refusé par le serveur du destinataire${le} : l’adresse est peut-être erronée.`;
    case "annule":
      return `L’accusé de réception automatique a été annulé avant son départ.`;
    case "absent":
      return "Aucun accusé de réception automatique n’a été trouvé pour cette candidature : rien ne dit que le candidat a été averti de sa bonne réception.";
  }
}

function LigneAccuse({ accuse }: { accuse: AccuseReception }): React.ReactElement {
  const badge = BADGE_ACCUSE[accuse.etat];
  const alerte = accuse.etat === "echec" || accuse.etat === "rebond";
  return (
    <li className="border-border-subtle border-l-2 pl-[var(--space-admin-4)]">
      <div className="flex flex-wrap items-baseline gap-x-[var(--space-admin-3)]">
        <span className="text-[length:var(--text-admin-sm)] font-semibold">
          Accusé de réception automatique
        </span>
        <span className="admin-meta-small">
          {accuse.date ? `${DATE_FR.format(accuse.date)} · ` : ""}Envoi automatique
        </span>
        <AdminBadge tone={badge.tone}>{badge.libelle}</AdminBadge>
      </div>
      {alerte ? (
        <p role="alert" className="admin-alert admin-alert-error">
          {phraseAccuse(accuse)}
          {accuse.motif ? ` Motif : ${accuse.motif}` : ""}
        </p>
      ) : (
        <p className="text-[length:var(--text-admin-sm)]">{phraseAccuse(accuse)}</p>
      )}
      {accuse.rattachement === "adresse_et_date" ? (
        <p className="admin-meta-small">
          Rattaché à cette candidature par l’adresse et l’heure de dépôt (envoi antérieur au lien
          direct).
        </p>
      ) : null}
    </li>
  );
}

export function FriseCandidature({
  entrees,
  accuse = null,
}: {
  entrees: ReadonlyArray<EntreeFrise>;
  /** `null` = rôle sans accès au dossier : rien n'est dit, pas même l'absence. */
  accuse?: AccuseReception | null;
}): React.ReactElement {
  if (entrees.length === 0 && accuse === null) {
    return (
      <p className="admin-meta-small">
        Rien n’a encore été consigné. Une réponse, un appel ou une note apparaîtront ici, dans
        l’ordre des faits.
      </p>
    );
  }

  if (entrees.length === 0 && accuse !== null) {
    return (
      <>
        <p className="admin-meta-small">
          Aucune réponse, aucun appel ni aucune note n’a encore été consigné.
        </p>
        <ol className="m-0 mt-[var(--space-admin-3)] list-none p-0">
          <LigneAccuse accuse={accuse} />
        </ol>
      </>
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
      {accuse !== null ? <LigneAccuse accuse={accuse} /> : null}
    </ol>
  );
}
