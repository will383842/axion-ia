/**
 * contrat.ts — le contrat d'événements axionia → Axion Partners, côté PRODUCTEUR.
 *
 * ⚠️ CE DÉPÔT N'EST PAS LA SOURCE DU CONTRAT. La source unique est le descripteur
 * TypeScript d'Axion Partners (`packages/contracts/enveloppe.ts` + `events.ts`), dont
 * `pnpm contracts:export` dérive trois artefacts. Ce dossier détient une **copie octet
 * pour octet** de l'un d'eux — `contrat/contracts.v2.json` — accompagnée de son
 * empreinte `contrat/contracts.sha256`. C'est le mécanisme que `partners/ADR-0008`
 * décrit : « le JSON Schema publié, celui qu'axionia copie et dont l'empreinte
 * contracts.sha256 tient la transcription (REQ-QA-007) ».
 *
 * 🔑 RIEN N'EST RETAPÉ ICI. Les onze types, les neuf champs de l'enveloppe et le
 * numéro de version sont **lus dans la copie**, jamais réécrits en TypeScript. C'est
 * la différence entre une transcription et une copie : une liste retapée diverge en
 * silence le jour où l'autre dépôt en ajoute un, et rien ne le dit. Une liste dérivée
 * fait rougir `payloads.ts` (registre exhaustif) à la seconde où la copie bouge.
 *
 * Mettre à jour la copie = un seul geste, et il est vérifiable :
 *   1. `cp ../axion-apporteurs/packages/contracts/contracts.v2.json  src/server/partners/contrat/`
 *   2. idem pour `contracts.sha256`
 *   3. `pnpm test src/server/partners` — la transcription et le registre disent le reste.
 */
import contratPublie from "./contrat/contracts.v3.json";

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
 * Onze depuis `schema_version` 2 (INT-T01c côté Partners) : les quatre noms longtemps
 * recensés hors contrat v1 — `candidature.recue`, `facture.annulee`,
 * `financement.mis_a_jour`, `client.fusionne` — y sont entrés. Ce dépôt ne tranche pas
 * cette liste : il lit ce que Partners a publié (transcription v2, 2026-09-29).
 */
export const TYPES_EVENEMENT = PUBLIE.properties.event_type.enum as readonly TypeEvenement[];

/**
 * Les onze noms, en type. C'est la SEULE liste littérale de ce dépôt, et elle est
 * nécessaire : TypeScript ne sait pas fabriquer une union depuis un JSON importé sans
 * `as const`, que `resolveJsonModule` ne pose pas. Elle n'est pas une seconde source
 * pour autant — `transcription-du-contrat.spec.ts` compare cette union, membre par
 * membre, à l'énumération publiée, et le registre de `payloads.ts` est exhaustif sur
 * elle. Un douzième type publié par Partners fait rougir les deux.
 */
export type TypeEvenement =
  | "client.cree"
  | "client.mis_a_jour"
  | "devis.signe"
  | "facture.emise"
  | "avoir.emis"
  | "paiement.recu"
  | "paiement.rembourse"
  | "candidature.recue"
  | "financement.mis_a_jour"
  | "facture.annulee"
  | "client.fusionne"
  | "devis.emis";

/** Les neuf champs de l'enveloppe, LUS dans la liste `required` du schéma publié. */
export const CHAMPS_ENVELOPPE: readonly string[] = PUBLIE.required;

/** Vrai si le type est émissible dans la version publiée du contrat. */
export function estDansLeContrat(type: string): type is TypeEvenement {
  return (TYPES_EVENEMENT as readonly string[]).includes(type);
}
