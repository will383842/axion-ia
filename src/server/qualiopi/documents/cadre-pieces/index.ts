/**
 * Cadre des pièces NON signables : point d'entrée unique.
 * Les polices sont enregistrées au chargement de `page.tsx` (idempotent).
 * Volontairement ABSENTS : la zone de signature et les couleurs de marque gelées (signables = base-layout).
 */
export * from "./page";
export * from "./blocs";
export * from "./tableau";
export * from "./encadre";
export { formatEur, formatEurosFromCents, assainirEspacesPdf } from "../base-layout";
export type { OrganismeIdentite } from "../base-layout";
