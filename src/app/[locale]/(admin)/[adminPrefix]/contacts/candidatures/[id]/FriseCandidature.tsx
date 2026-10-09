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

import { LIBELLE_EVENEMENT } from "@/features/admin-job-applications/timeline";
import type { EntreeFrise } from "@/features/admin-job-applications/timeline";
import type { AccuseReception } from "@/features/admin-job-applications/accuse-reception";
import { LigneAccuse } from "@/components/admin/accuse/AccuseReceptionAuto";
import { FilEchanges } from "@/components/admin/echanges/FilEchanges";
import { faitsEmploi, type FaitFil } from "@/features/echanges/fil";

/**
 * L7 (Candidatures unifiées) — la frise RENDRA DÉSORMAIS DES LIGNES DU FIL :
 * bulles « Reçu » à gauche, « Envoyé » à droite, notes au centre
 * (`components/admin/echanges/FilEchanges.tsx`). La page lui passe le fil
 * complet (`lireFilEmploi` : journal, réponses reçues L3, liens et fichiers
 * L5/L5b) ; sans `faits`, elle le dérive du seul journal.
 */
export function FriseCandidature({
  entrees,
  accuse = null,
  faits,
}: {
  entrees: ReadonlyArray<EntreeFrise>;
  /** `null` = rôle sans accès au dossier : rien n'est dit, pas même l'absence. */
  accuse?: AccuseReception | null;
  /** Le fil complet, lu par la page. */
  faits?: ReadonlyArray<FaitFil>;
}): React.ReactElement {
  const fil =
    faits ??
    faitsEmploi({
      evenements: entrees.map((e) => ({
        id: e.id,
        type: e.type,
        libelle: LIBELLE_EVENEMENT[e.type],
        occurredAt: e.occurredAt,
        authorName: e.authorName,
        summary: e.summary,
        body: e.body,
        replyId: e.replyId ?? null,
        reponseRecueId: e.reponseRecueId ?? null,
        livraison: e.livraison
          ? {
              statut: e.livraison.statut,
              erreur: e.livraison.erreur,
              reessais: e.livraison.reessais,
            }
          : null,
      })),
      recues: [],
      liens: [],
    });

  if (fil.length === 0 && accuse === null) {
    return (
      <p className="admin-meta-small">
        Rien n’a encore été consigné. Une réponse, un appel ou une note apparaîtront ici, dans
        l’ordre des faits.
      </p>
    );
  }

  return (
    <FilEchanges
      faits={fil}
      vide="Aucune réponse, aucun appel ni aucune note n’a encore été consigné."
      pied={accuse !== null ? <LigneAccuse accuse={accuse} /> : null}
    />
  );
}
