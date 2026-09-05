/**
 * contrat.ts — le contrat d'événements axionia → Axion Partners, côté PRODUCTEUR.
 *
 * ⚠️ CE DÉPÔT N'EST PAS LA SOURCE DU CONTRAT. La source unique est le descripteur
 * TypeScript d'Axion Partners (`packages/contracts/enveloppe.ts` + `events.ts`), dont
 * `pnpm contracts:export` dérive trois artefacts. Ce dossier détient une **copie octet
 * pour octet** de l'un d'eux — `contrat/contracts.v1.json` — accompagnée de son
 * empreinte `contrat/contracts.sha256`. C'est le mécanisme que `partners/ADR-0008`
 * décrit : « le JSON Schema publié, celui qu'axionia copie et dont l'empreinte
 * contracts.sha256 tient la transcription (REQ-QA-007) ».
 *
 * 🔑 RIEN N'EST RETAPÉ ICI. Les sept types, les neuf champs de l'enveloppe et le
 * numéro de version sont **lus dans la copie**, jamais réécrits en TypeScript. C'est
 * la différence entre une transcription et une copie : une liste retapée diverge en
 * silence le jour où l'autre dépôt en ajoute un, et rien ne le dit. Une liste dérivée
 * fait rougir `payloads.ts` (registre exhaustif) à la seconde où la copie bouge.
 *
 * Mettre à jour la copie = un seul geste, et il est vérifiable :
 *   1. `cp ../axion-apporteurs/packages/contracts/contracts.v1.json  src/server/partners/contrat/`
 *   2. idem pour `contracts.sha256`
 *   3. `pnpm test src/server/partners` — la transcription et le registre disent le reste.
 */
import contratPublie from "./contrat/contracts.v1.json";

/**
 * Le JSON Schema publié, tel qu'il est sur le fil. Le type est resserré à la main sur
 * les trois emplacements dont ce dépôt DÉPEND — pas sur la totalité du document :
 * décrire ici la forme entière d'un fichier qu'on ne contrôle pas reviendrait à en
 * faire une seconde source, ce que ce module existe pour empêcher.
 */
type ContratPublie = {
  readonly required: readonly string[];
  readonly properties: {
    readonly event_type: { readonly enum: readonly string[] };
    readonly schema_version: { readonly const: number };
  };
};

const PUBLIE = contratPublie as unknown as ContratPublie;

/** La version du contrat, LUE dans le `const` du champ `schema_version` du schéma publié. */
export const SCHEMA_VERSION: number = PUBLIE.properties.schema_version.const;

/**
 * Les types d'événements, DANS L'ORDRE de l'énumération publiée.
 *
 * `partners/ADR-0008` a tranché « sept, pas onze » : REQ-INT-004 écrit une liste
 * FERMÉE de sept noms, et les quatre autres noms qui circulent au registre des
 * exigences (`candidature.recue`, `facture.annulee`, `financement.mis_a_jour`,
 * `client.fusionne`) sont recensés hors contrat v1. Ce dépôt ne tranche pas cette
 * question : il lit ce que Partners a publié. Voir `HORS_CONTRAT_V1` pour ce que ce
 * dépôt sait produire malgré tout, et pourquoi il ne l'émet pas.
 */
export const TYPES_EVENEMENT = PUBLIE.properties.event_type.enum as readonly TypeEvenement[];

/**
 * Les sept noms, en type. C'est la SEULE liste littérale de ce dépôt, et elle est
 * nécessaire : TypeScript ne sait pas fabriquer une union depuis un JSON importé sans
 * `as const`, que `resolveJsonModule` ne pose pas. Elle n'est pas une seconde source
 * pour autant — `transcription-du-contrat.spec.ts` compare cette union, membre par
 * membre, à l'énumération publiée, et le registre de `payloads.ts` est exhaustif sur
 * elle. Un huitième type publié par Partners fait rougir les deux.
 */
export type TypeEvenement =
  | "client.cree"
  | "client.mis_a_jour"
  | "devis.signe"
  | "facture.emise"
  | "avoir.emis"
  | "paiement.recu"
  | "paiement.rembourse";

/** Les neuf champs de l'enveloppe, LUS dans la liste `required` du schéma publié. */
export const CHAMPS_ENVELOPPE: readonly string[] = PUBLIE.required;

/**
 * Ce que ce dépôt SAIT produire mais n'émet PAS en `schema_version` 1.
 *
 * Ce n'est pas une liste d'intentions : chacun de ces quatre noms est porté par une
 * exigence du registre de Partners, et trois d'entre eux ont un producteur RÉEL dans
 * ce dépôt (voir `payloads-hors-contrat.ts`). Ils sont construits, testés et couverts
 * par les fixtures — mais `emettre()` les refuse, parce que le consommateur v1 rend
 * 422 sur un `event_type` hors énumération (`additionalProperties: false` + enum
 * fermé), et qu'un 422 met la ligne en `gave_up`.
 *
 * 🔑 Les produire sans les émettre n'est pas une contradiction, c'est le SEUL ordre
 * possible : la bascule vers `schema_version` 2 est en lockstep entre les deux dépôts
 * (ADR-0008, § Conséquences). Le jour où Partners republie à onze types, la copie
 * change, `TYPES_EVENEMENT` s'allonge tout seul, et le seul geste restant est de
 * déplacer les constructeurs d'un registre à l'autre.
 */
export const HORS_CONTRAT_V1 = [
  "candidature.recue",
  "facture.annulee",
  "financement.mis_a_jour",
  "client.fusionne",
] as const;

export type TypeHorsContrat = (typeof HORS_CONTRAT_V1)[number];

/** Vrai si le type est émissible en `schema_version` 1. */
export function estDansLeContratV1(type: string): type is TypeEvenement {
  return (TYPES_EVENEMENT as readonly string[]).includes(type);
}
