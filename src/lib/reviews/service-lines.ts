// SSOT — mapping des 5 services Axion-IA (enum Prisma `ServiceSector`) vers leur
// libellé FR, leur route publique canonique et le type schema.org à utiliser pour
// l'AggregateRating par service.
//
// ⚠️ Le type JSON-LD conditionne la VALIDITÉ du balisage d'avis Google. La liste
// des types acceptés pour `itemReviewed` / `aggregateRating` est FERMÉE (Product,
// Course, Organization, LocalBusiness, Event, Book, SoftwareApplication…). `Service`
// N'EN FAIT PAS PARTIE → GSC rejette « Type d'objet non valide pour le champ
// itemReviewed » (2026-07-07, 50 fiches + 3 facettes). On mappe donc chaque gamme
// vers un type éligible : `Course` pour la formation, `Product` pour les prestations
// productisées (audit, implémentation, 1-à-1, sites web). Le type `ReviewItemType`
// exclut volontairement `Service` pour interdire toute réintroduction.
//
// Fichier PUR (pas de "use server", pas d'I/O) → importable client ET serveur.

import type { ServiceSector } from "../../../prisma/generated/client";

/** Type schema.org porteur de la note pour un service donné. */
export type ReviewItemType = "Course" | "Product";

export interface ServiceLineMeta {
  readonly value: ServiceSector;
  readonly labelFr: string;
  /** Nom lisible pour `itemReviewed.name` dans le JSON-LD. */
  readonly schemaName: string;
  /** Route publique canonique (sans préfixe locale). */
  readonly path: string;
  /** Type schema.org de l'entité notée (pilote l'éligibilité étoiles Google). */
  readonly itemType: ReviewItemType;
}

/** Les 5 services Axion-IA, ordre d'affichage. */
export const SERVICE_LINES: readonly ServiceLineMeta[] = [
  {
    value: "audits",
    labelFr: "Audit IA",
    schemaName: "Audit IA Axion-IA",
    path: "/audit",
    itemType: "Product",
  },
  {
    value: "interventions_formations",
    labelFr: "Formation IA",
    schemaName: "Formation IA Axion-IA",
    path: "/formations",
    itemType: "Course",
  },
  {
    value: "implementations",
    labelFr: "Implémentation IA",
    schemaName: "Implémentation IA Axion-IA",
    path: "/implementation",
    itemType: "Product",
  },
  {
    value: "un_a_un",
    labelFr: "Accompagnement 1-à-1",
    schemaName: "Accompagnement IA 1-à-1 Axion-IA",
    path: "/un-a-un",
    itemType: "Product",
  },
  {
    value: "sites_web_augmentes",
    labelFr: "Site web augmenté par l'IA",
    schemaName: "Site web augmenté par l'IA Axion-IA",
    path: "/sites-web-augmentes",
    itemType: "Product",
  },
] as const;

/** Toutes les valeurs d'enum (ordre d'affichage). */
export const SERVICE_LINE_VALUES: readonly ServiceSector[] = SERVICE_LINES.map((s) => s.value);

const BY_VALUE: ReadonlyMap<string, ServiceLineMeta> = new Map(
  SERVICE_LINES.map((s) => [s.value, s]),
);

/** Métadonnées d'un service par valeur d'enum (undefined si inconnu). */
export function getServiceLine(value: string | null | undefined): ServiceLineMeta | undefined {
  if (!value) return undefined;
  return BY_VALUE.get(value);
}

/** True si `value` est une valeur d'enum `ServiceSector` valide. */
export function isServiceLine(value: string): value is ServiceSector {
  return BY_VALUE.has(value);
}

/** Libellé FR d'un service (valeur brute en repli). */
export function serviceLineLabel(value: string): string {
  return BY_VALUE.get(value)?.labelFr ?? value;
}
