/**
 * Version du GABARIT de chaque pièce signable.
 *
 * ## Le défaut que ce module ferme
 *
 * `exemplaire-signe.ts` produit l'exemplaire signé d'une pièce en rejouant un
 * **instantané des données** (`metadata.renderData`) à travers le **composant
 * de rendu d'aujourd'hui**. Son en-tête pose pourtant la bonne règle :
 *
 * > « Reconstruire depuis les entités vivantes aurait produit un document dérivé
 * > du PRÉSENT [...] et l'exemplaire "signé" ne correspondrait plus à ce qui a
 * > été signé. »
 *
 * 🔴 Cette règle était tenue sur l'axe des DONNÉES et rompue sur l'axe du
 * GABARIT. Retoucher le texte d'une convention — ajouter une clause, renuméroter
 * une section — réécrit **rétroactivement** l'exemplaire signé de toutes les
 * conventions déjà signées : le signataire se voit opposer des clauses qu'il n'a
 * jamais lues, sous un document qui se présente comme sa copie signée, et dont
 * l'empreinte scellée dans `document_signatures.document_hash_sha256` ne
 * correspond plus.
 *
 * Le défaut n'est pas théorique : le texte de la convention bipartite a déjà été
 * enrichi le 02/08 (trois mentions L.6353-1 puis cinq sections de fond), et
 * celui de la tripartite le 16/08. Chacune de ces retouches a réécrit le passé
 * en silence.
 *
 * ## La règle
 *
 * > **Une pièce signée ne se reproduit qu'avec le gabarit qui l'a produite.**
 * > Si le gabarit a changé depuis la signature, on ne fabrique pas un document
 * > approchant : on le DIT.
 *
 * C'est exactement le parti déjà pris pour `instantane_absent` — « le dire vaut
 * mieux qu'un PDF reconstruit dont personne ne pourrait garantir la fidélité ».
 * On l'étend à la seconde moitié du problème.
 *
 * ## ⚠️ RÈGLE D'USAGE — à lire avant de toucher un gabarit signable
 *
 * **Toute modification du TEXTE RENDU d'une pièce de cette table impose
 * d'incrémenter sa version.** Ajouter une clause, reformuler une mention,
 * renuméroter une section : tout ce qu'un signataire verrait différemment.
 *
 * En revanche, **ne PAS incrémenter** pour : un changement de style, un
 * commentaire, un renommage de variable, une correction de mise en page qui ne
 * change aucun mot. Une version qui bouge sans raison refuse des exemplaires
 * parfaitement fidèles, et une garde qui refuse à tort finit désarmée.
 *
 * ## Pourquoi 1 comme valeur par défaut, et pas 0
 *
 * Les pièces générées avant l'introduction de ce mécanisme n'ont aucune version
 * dans leur instantané. On les lit comme **version 1** — la version en vigueur
 * jusqu'au 16/08 inclus. Ainsi une pièce signée avant une retouche est
 * correctement détectée comme non reproductible, au lieu de passer pour
 * fidèle. C'est le comportement prudent : en cas de doute, on refuse.
 */

/** Types de pièces dont l'exemplaire signé est rendu (miroir de `COMPOSANTS`). */
export type TypeGabaritSignable =
  | "devis"
  | "convention"
  | "convention_tripartite"
  | "contrat_formation"
  | "contrat_sous_traitance"
  | "releve_connexion"
  | "lettre_mission";

/**
 * Version courante du texte rendu, par type de pièce.
 *
 * 🔴 Historique des incréments — à tenir, c'est lui qui rend les refus
 * explicables à un auditeur :
 *
 * | Pièce | v | Ce qui a changé |
 * |---|---|---|
 * | `convention` | 2 | 16/08 — clause de défaillance du financeur ajoutée en section 5 (refus, réduction, caducité ou non-paiement du financeur : les sommes demeurent dues par le client) |
 * | `convention_tripartite` | 2 | 16/08 — trois mentions L.6353-1 + cinq sections de fond (obligations, RGPD, propriété intellectuelle, responsabilité, droit applicable) ; annexes 5 → 10, signatures 6 → 11 |
 * | `contrat_sous_traitance` | 2 | 09/09 — clause 4 enrichie (délai de paiement 30 j, pénalités BCE + 10 pts, indemnité de 40 €, absence d'escompte ; fait générateur de la facturation) et article **4 bis** ajouté (mandat de facturation / autofacturation) |
 * | les autres | 1 | texte inchangé depuis l'origine |
 *
 * 🔴 L'INCRÉMENT DU `contrat_sous_traitance` EST ARRIVÉ AVEC UN JOUR DE RETARD,
 * et le raconter vaut mieux que le masquer. Le 09/09, trois clauses de fond ont
 * été ajoutées au contrat de sous-traitance **sans toucher cette table**. La
 * règle d'usage était pourtant écrite vingt lignes plus bas, dans ce fichier,
 * depuis le 16/08.
 *
 * 🔑 Un commentaire ne protège pas un autre fichier. C'est le même motif que le
 * `server-only` qui tuait deux crons en silence : la consigne existait, à
 * l'endroit exact où elle se lit, et elle n'a rien empêché parce que rien ne
 * l'EXÉCUTAIT. D'où `gabarit-empreinte.spec.ts`, ajouté le 10/09 : le texte
 * d'un gabarit signable ne peut plus changer sans que quelqu'un tranche entre
 * « c'est de fond » et « c'est cosmétique ».
 *
 * ⚠️ Conséquence de cet oubli, et elle est nulle en pratique : aucun contrat de
 * sous-traitance n'avait été signé sous la v1 (vérifié auprès de Will le
 * 10/09). Si l'un l'avait été, sa copie signée aurait été re-rendue avec des
 * clauses que son signataire n'a jamais lues — exactement ce que ce module
 * existe pour empêcher.
 *
 * ⚠️ Le `devis` reste en 1 : la garde de certification du 16/08 change ce qui
 * est CALCULÉ (les montants entrent ou non dans l'instantané), pas le texte du
 * gabarit. Un exemplaire signé rejoue son instantané et reste donc fidèle.
 */
export const GABARIT_VERSIONS: Record<TypeGabaritSignable, number> = {
  devis: 1,
  convention: 2,
  convention_tripartite: 2,
  contrat_formation: 1,
  contrat_sous_traitance: 2,
  releve_connexion: 1,
  lettre_mission: 1,
};

/**
 * Version en vigueur pour un type de pièce, ou `null` si la pièce n'est pas
 * signable — auquel cas la question ne se pose pas.
 */
export function versionGabaritCourante(type: string): number | null {
  return GABARIT_VERSIONS[type as TypeGabaritSignable] ?? null;
}

/**
 * Version portée par un instantané de rendu.
 *
 * Absente → **1**, la version en vigueur avant l'introduction du mécanisme.
 * Voir l'en-tête : en cas de doute, on refuse plutôt que de laisser passer.
 */
export function versionGabaritInstantane(snapshot: unknown): number {
  if (typeof snapshot !== "object" || snapshot === null) return 1;
  const v = (snapshot as { gabaritVersion?: unknown }).gabaritVersion;
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 1;
}
