/**
 * KB V4.1 — SSOT du mapping « service Axion-IA » pour le Service Binding.
 *
 * Source unique de vérité reliant :
 *   - la `verticale` des KbFact (`src/server/content-gen/kb/*.ts`, ex. "audits"),
 *   - le slug de tag KB canonique (`service:audit`),
 *   - la page service publique (`/audit`),
 *   - le libellé FR affiché.
 *
 * Utilisé par :
 *   - le seed (`prisma/seeds/content-gen/seed-kb-facts.ts`) → crée les tags `service:*`,
 *   - le reader (`src/lib/knowledge/readers.ts` → `listEntriesByService`),
 *   - le bloc « connaissances liées » des pages services.
 *
 * ⚠️ Doctrine : aucun tarif ici (les tarifs restent dans `src/content/pricing.ts`).
 */

/** Slugs de service canoniques (= suffixe du tag `service:<slug>`). */
export const SERVICE_SLUGS = [
  "audit",
  "implementation",
  "interventions-formations",
  "un-a-un",
  "sites-web-augmentes",
] as const;

export type ServiceSlug = (typeof SERVICE_SLUGS)[number];

export interface ServiceDef {
  /** Slug canonique = suffixe du tag KB `service:<slug>`. */
  readonly slug: ServiceSlug;
  /** Valeurs `verticale` des KbFact qui rattachent un fait à ce service. */
  readonly verticales: readonly string[];
  /** Route de la page service publique. */
  readonly pageHref: string;
  /** Libellé FR court (titres, breadcrumbs). */
  readonly labelFr: string;
  /** Libellé du tag KB (nameFr/nameEn de `KnowledgeTag`). */
  readonly tagNameFr: string;
  readonly tagNameEn: string;
}

/**
 * Catalogue des 5 services. `verticales` reprend EXACTEMENT les valeurs présentes
 * dans les fichiers `kb/*.ts` (avec underscores) — ne pas renommer sans migrer le seed.
 */
export const SERVICE_DEFS: readonly ServiceDef[] = [
  {
    slug: "audit",
    verticales: ["audits"],
    pageHref: "/audit",
    labelFr: "Audit IA",
    tagNameFr: "Service : Audit IA",
    tagNameEn: "Service: AI Audit",
  },
  {
    slug: "implementation",
    verticales: ["implementations"],
    pageHref: "/implementation",
    // labelFr (affichage) aligné sur le nom officiel SSOT `src/content/services.ts`
    // (Will 2026-06-10). slug/verticales/tagName INCHANGÉS (clé grounding KB).
    labelFr: "Implémentation & automatisation IA",
    tagNameFr: "Service : Implémentation IA",
    tagNameEn: "Service: AI Implementation",
  },
  {
    slug: "interventions-formations",
    verticales: ["interventions_formations"],
    pageHref: "/interventions",
    labelFr: "Formations & interventions IA",
    tagNameFr: "Service : Interventions & accompagnement",
    tagNameEn: "Service: Interventions & enablement",
  },
  {
    slug: "un-a-un",
    verticales: ["un_a_un"],
    pageHref: "/un-a-un",
    labelFr: "Accompagnement 1 to 1",
    tagNameFr: "Service : Accompagnement un-à-un",
    tagNameEn: "Service: One-to-one support",
  },
  {
    slug: "sites-web-augmentes",
    verticales: ["sites_web_augmentes"],
    pageHref: "/sites-web-augmentes",
    labelFr: "Sites web & SaaS Native IA",
    tagNameFr: "Service : Sites web augmentés",
    tagNameEn: "Service: AI-augmented websites",
  },
] as const;

/** Préfixe des tags de service. */
export const SERVICE_TAG_PREFIX = "service:" as const;

/** Construit le slug de tag KB canonique pour un service. */
export function serviceTagSlug(slug: ServiceSlug): string {
  return `${SERVICE_TAG_PREFIX}${slug}`;
}

/** Index verticale (KbFact) → ServiceDef. Une verticale = au plus un service. */
const VERTICALE_TO_SERVICE: ReadonlyMap<string, ServiceDef> = new Map(
  SERVICE_DEFS.flatMap((def) => def.verticales.map((v) => [v, def] as const)),
);

/** Résout la/les défs de service depuis les `verticales` d'un KbFact (dédupliqué). */
export function servicesForVerticales(verticales: readonly string[]): readonly ServiceDef[] {
  const seen = new Set<ServiceSlug>();
  const out: ServiceDef[] = [];
  for (const v of verticales) {
    const def = VERTICALE_TO_SERVICE.get(v);
    if (def && !seen.has(def.slug)) {
      seen.add(def.slug);
      out.push(def);
    }
  }
  return out;
}

/** Garde de type : la chaîne est-elle un ServiceSlug connu ? */
export function isServiceSlug(value: string): value is ServiceSlug {
  return (SERVICE_SLUGS as readonly string[]).includes(value);
}

/** Récupère une ServiceDef par slug (ou undefined). */
export function getServiceDef(slug: string): ServiceDef | undefined {
  return SERVICE_DEFS.find((d) => d.slug === slug);
}
