/**
 * LE PRÉDICAT D'ADMISSIBILITÉ AU DOSSIER DE PREUVES — écrit une seule fois.
 *
 * ## Deux exclusions, deux raisons distinctes
 *
 * **`annuleeAt: null`** — une pièce déclarée sans valeur n'est pas une preuve.
 * L'y glisser sans marquage reviendrait à présenter comme preuve un document
 * qu'on a soi-même annulé.
 *
 * **La session ni ANNULÉE ni REPORTÉE** — 🔴 `D2-5-12` (2026-08-20). Ce filtre
 * manquait. Une session reportée conserve la convention émise pour ses dates
 * INITIALES : la pièce n'est pas annulée — elle a bien été signée — mais aucune
 * formation n'a eu lieu à ces dates. Le certificateur recevait donc **deux
 * conventions pour la même prestation**, dont une pour une période vide. Un
 * dossier qui se contredit lui-même ne fait pas douter d'une pièce : il fait
 * douter de toutes.
 *
 * ⚠️ `sessionId: null` est ADMIS, et ce n'est pas un oubli : les pièces
 * générales de l'organisme (procédures, registres, lettres-cadres couvrant
 * plusieurs sessions) n'ont pas de session et sont précisément ce que la moitié
 * des indicateurs réclame. Les exclure viderait le dossier.
 *
 * 🔑 UNE fonction, pas trois recopies. Ce prédicat vivait en littéral à **trois**
 * endroits — le comptage `groupBy`, la liste par type, et la constitution du
 * ZIP — avec, à chaque fois, un commentaire priant le lecteur de les garder
 * identiques. Une prière n'est pas une garantie : c'est exactement ainsi que
 * `regleSignatureEnAttente` a divergé de `enAttente()` (constat `D3-4-06`, une
 * alerte critique par nuit sur des pièces annulées). Tout nouveau consommateur
 * appelle cette fonction, jamais ne réécrit son prédicat.
 *
 * La trace des annulations et des reports, elle, reste entière au registre
 * (motif, date, auteur) et au journal d'activité — c'est là que l'auditeur la
 * recoupe s'il la demande. Le dossier de PREUVES n'est pas le registre.
 *
 * ## 🔴 Pourquoi ce module existe séparément (2026-08-24, cahier D1-4)
 *
 * La règle ci-dessus était écrite, juste, et **appliquée à un seul site**.
 * `conformite-service.ts` — le moteur qui décide si un indicateur Qualiopi est
 * couvert — ne l'appelait pas : il réécrivait `annuleeAt: null` à **cinq
 * endroits**, donc sans le filtre de statut de session. Une convocation émise
 * pour une session ensuite ANNULÉE couvrait l'indicateur 9 ; un émargement
 * d'une session annulée couvrait le 12.
 *
 * La contradiction se voyait sur une seule page : le manifeste d'audit prend le
 * *statut* de l'indicateur dans `evaluerConformite()` et la *liste des pièces*
 * via ce prédicat. Il pouvait donc écrire « Indicateur 9 — Couvert » au-dessus
 * d'une rubrique « Documents » vide.
 *
 * ⚠️ Il a fallu **sortir la fonction d'`audit-dossier.ts`** pour la rendre
 * appelable : ce fichier-là importe `evaluerConformite`, donc l'importer en
 * retour aurait créé un **cycle**. Et il tire toute la chaîne
 * d'authentification, ce qui rendait le prédicat inutilisable en test unitaire.
 * Ce module-ci n'importe qu'un type.
 */

import type { TrainingSessionStatut } from "../../../../prisma/generated/client";

export function pieceAdmissibleAuDossier(): {
  annuleeAt: null;
  OR: [{ sessionId: null }, { session: { statut: { notIn: TrainingSessionStatut[] } } }];
} {
  return {
    annuleeAt: null,
    OR: [{ sessionId: null }, { session: { statut: { notIn: ["annulee", "reportee"] } } }],
  };
}
