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
 *
 * ⚠️ Doctrine nommage (2026-07-28, audit positionnement) : `labelFr`/`labelEn`
 * ne sont PLUS recopiés ici — ils DÉRIVENT de `src/content/services.ts` (SSOT
 * unique du nom de service) via `SERVICE_ID_BY_KB_SLUG`. Les recopier avait
 * produit une dérive de 5 noms pour un même service. En revanche `slug`,
 * `verticales` et `tagNameFr/En` sont des CLÉS DE GROUNDING persistées en base
 * (tags `service:*`, `KbFact.verticale`) : ne jamais les renommer sans migrer
 * le seed ET les lignes existantes.
 */
import { SERVICE_BY_ID, type ServiceId } from "@/content/services";

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
  /**
   * Libellé FR court (titres, breadcrumbs) — DÉRIVÉ du SSOT
   * `src/content/services.ts`, jamais saisi à la main ici.
   */
  readonly labelFr: string;
  /** Idem en EN, dérivé du SSOT. */
  readonly labelEn: string;
  /** Libellé du tag KB (nameFr/nameEn de `KnowledgeTag`). */
  readonly tagNameFr: string;
  readonly tagNameEn: string;
}

/**
 * Pont slug KB → id du SSOT nommage. Le slug KB `interventions-formations` est
 * une clé persistée (tags en base) : il porte encore l'ancien vocabulaire
 * « interventions », alors que le service s'appelle désormais « Formations IA ».
 * C'est volontaire — on ne renomme pas une clé de grounding pour un changement
 * d'affichage.
 */
const SERVICE_ID_BY_KB_SLUG: Record<ServiceSlug, ServiceId> = {
  audit: "audit",
  implementation: "implementation",
  "interventions-formations": "formations",
  "un-a-un": "unAUn",
  "sites-web-augmentes": "sitesWeb",
};

/**
 * Partie NON dérivable du catalogue : les clés de grounding persistées.
 * `verticales` reprend EXACTEMENT les valeurs présentes dans les fichiers
 * `kb/*.ts` (avec underscores) — ne pas renommer sans migrer le seed.
 * `tagNameFr/En` sont les libellés des `KnowledgeTag` déjà créés en base :
 * les renommer désynchroniserait le seed des lignes existantes.
 */
const SERVICE_KEYS: ReadonlyArray<Omit<ServiceDef, "labelFr" | "labelEn">> = [
  {
    slug: "audit",
    verticales: ["audits"],
    pageHref: "/audit",
    tagNameFr: "Service : Audit IA",
    tagNameEn: "Service: AI Audit",
  },
  {
    slug: "implementation",
    verticales: ["implementations"],
    pageHref: "/implementation",
    tagNameFr: "Service : Implémentation IA",
    tagNameEn: "Service: AI Implementation",
  },
  {
    slug: "interventions-formations",
    verticales: ["interventions_formations"],
    // `/interventions` (nu) redirige 301 → `/formations` (next.config.ts) ; on
    // pointe directement sur la cible canonique pour éviter le hop sur le bloc
    // « Connaissances liées » des fiches formations.
    pageHref: "/formations",
    tagNameFr: "Service : Interventions & accompagnement",
    tagNameEn: "Service: Interventions & enablement",
  },
  {
    slug: "un-a-un",
    verticales: ["un_a_un"],
    pageHref: "/un-a-un",
    tagNameFr: "Service : Accompagnement un-à-un",
    tagNameEn: "Service: One-to-one support",
  },
  {
    slug: "sites-web-augmentes",
    verticales: ["sites_web_augmentes"],
    pageHref: "/sites-web-augmentes",
    tagNameFr: "Service : Sites web augmentés",
    tagNameEn: "Service: AI-augmented websites",
  },
];

/**
 * Catalogue des 5 services — libellés d'AFFICHAGE dérivés du SSOT nommage
 * `src/content/services.ts`. Renommer un service là-bas se propage ici sans
 * intervention (et le garde-fou `services-ssot.spec.ts` interdit de recoller
 * un libellé en dur).
 */
export const SERVICE_DEFS: readonly ServiceDef[] = SERVICE_KEYS.map((k) => {
  const ssot = SERVICE_BY_ID[SERVICE_ID_BY_KB_SLUG[k.slug]];
  return { ...k, labelFr: ssot.officialFr, labelEn: ssot.officialEn };
});

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
