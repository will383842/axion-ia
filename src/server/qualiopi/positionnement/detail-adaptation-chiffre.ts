/**
 * PRÉCISION DE SANTÉ rangée dans une réponse de positionnement — les trois
 * décisions pures du rattrapage de chiffrement (RGPD art. 9).
 *
 * 🔴 Du 2026-07-26 au 2026-08-20, le portail écrivait le détail du besoin
 * d'adaptation EN CLAIR dans `questionnaires.reponses` (clé `detailAdaptation`).
 * Le rattrapage le chiffre EN PLACE, dans le même JSON, sous la clé réservée
 * `detailAdaptationChiffre` (format `enc:v1:` de `encryptPii`). Rien n'est
 * supprimé : la rétention de 5 ans est une décision permanente.
 *
 * Deux conséquences que ce module porte :
 *   1. `deciderRattrapage` — le script ne chiffre que ce que cette fonction
 *      désigne. L'essai à blanc et l'écriture appliquent la MÊME règle.
 *   2. `retirerCleReservee` + `reporterDetailChiffre` — `soumettreReponses`
 *      remplace tout le JSON. Sans ces deux gardes, une nouvelle soumission
 *      EFFACERAIT le chiffré (perte), et un client pourrait FORGER le marqueur
 *      (l'écran dirait « Précision fournie » sans qu'aucune n'existe).
 *
 * ⚠️ Module PUR : sa seule dépendance est le module pur qui NOMME les clés. Il
 * est lu par le worker (`tsx`, hors Next) : ni `server-only`, ni `next/headers`,
 * ni `"use server"` ne doivent y entrer, même transitivement.
 * 🔴 Il ne journalise rien et ne rend jamais le texte ailleurs que dans la
 * décision `a_chiffrer`, que seul l'appelant chiffre.
 */

import {
  CLE_DETAIL_ADAPTATION_CHIFFRE,
  CLE_DETAIL_ADAPTATION_CLAIR,
} from "@/server/qualiopi/positionnement/lecture-positionnement";

/** Préfixe du format de chiffrement en vigueur (`encryptPii`). */
const PREFIXE_CHIFFRE = "enc:v1:";

export type DecisionRattrapage =
  | { readonly statut: "a_chiffrer"; readonly clair: string }
  | { readonly statut: "deja_chiffre" }
  | { readonly statut: "rien" }
  | { readonly statut: "anomalie"; readonly motif: "vide" | "non_texte" | "deux_cles" };

function estObjet(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Présence d'une clé au sens de PostgreSQL `reponses->'k' IS NOT NULL` : une
 * valeur JSON `null` compte comme PRÉSENTE (c'est un jsonb `null`, pas un NULL
 * SQL). Le script et la base doivent désigner les mêmes lignes.
 */
function porte(r: Record<string, unknown>, cle: string): boolean {
  return Object.prototype.hasOwnProperty.call(r, cle);
}

/**
 * Que faire de cette réponse ?
 *
 * - `a_chiffrer` : clé en clair, texte non vide, pas de chiffré. `clair` est la
 *   valeur EXACTE (non retaillée) : l'aller-retour se compare à elle.
 * - `deja_chiffre` : seul le chiffré est là. Rien à faire (idempotence).
 * - `rien` : ni l'un ni l'autre, ou JSON qui n'est pas un objet.
 * - `anomalie` : clair vide (`vide`), clair non textuel (`non_texte`), ou les
 *   deux clés à la fois (`deux_cles`). Jamais écrite : comptée, pour décision.
 */
export function deciderRattrapage(reponses: unknown): DecisionRattrapage {
  if (!estObjet(reponses)) return { statut: "rien" };

  const aClair = porte(reponses, CLE_DETAIL_ADAPTATION_CLAIR);
  const aChiffre = porte(reponses, CLE_DETAIL_ADAPTATION_CHIFFRE);

  // Les deux à la fois : on ne sait pas lequel dit vrai, et écraser le chiffré
  // pourrait perdre une déclaration. On ne touche à rien.
  if (aClair && aChiffre) return { statut: "anomalie", motif: "deux_cles" };
  if (aChiffre) return { statut: "deja_chiffre" };
  if (!aClair) return { statut: "rien" };

  const clair = reponses[CLE_DETAIL_ADAPTATION_CLAIR];
  if (typeof clair !== "string") return { statut: "anomalie", motif: "non_texte" };
  if (clair.trim() === "") return { statut: "anomalie", motif: "vide" };
  return { statut: "a_chiffrer", clair };
}

/**
 * Retire TOUJOURS la clé réservée au serveur des réponses reçues d'un client.
 * Seul le rattrapage de chiffrement a le droit de la poser. Rend une copie.
 */
export function retirerCleReservee(reponses: Record<string, unknown>): Record<string, unknown> {
  const { [CLE_DETAIL_ADAPTATION_CHIFFRE]: _reservee, ...reste } = reponses;
  return reste;
}

/**
 * Reporte, dans le JSON qui va REMPLACER la réponse, le chiffré que la ligne
 * portait déjà — sinon une nouvelle soumission l'effacerait sans bruit.
 *
 * Seule une valeur au format `enc:v1:` est reportée : le serveur n'en écrit pas
 * d'autre, et une valeur d'une autre forme ne peut être qu'un marqueur forgé
 * avant la garde. `nouveau` doit déjà être passé par `retirerCleReservee`.
 */
export function reporterDetailChiffre(
  ancien: unknown,
  nouveau: Record<string, unknown>,
): Record<string, unknown> {
  if (!estObjet(ancien)) return nouveau;
  const chiffre = ancien[CLE_DETAIL_ADAPTATION_CHIFFRE];
  if (typeof chiffre !== "string" || !chiffre.startsWith(PREFIXE_CHIFFRE)) return nouveau;
  return { ...nouveau, [CLE_DETAIL_ADAPTATION_CHIFFRE]: chiffre };
}
