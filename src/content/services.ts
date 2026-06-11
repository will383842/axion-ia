// SSOT — nom officiel UNIQUE de chacun des 5 services Axion-IA.
// Arbitré par Will le 2026-06-10. TOUT affichage du nom d'un service DOIT
// dériver d'ici (footer, pages, H1, JSON-LD, KB, sitemap, llms.txt, home…).
//
// Pourquoi ce fichier : avant lui, chaque service traînait 4 à 5 libellés
// divergents éparpillés — header (`.replace()` sur les clés i18n), footer
// hardcodé, clés `nav.*` de `messages/*.json`, blocs `home.valueXAction`,
// `src/content/knowledge/services.ts`, llms.txt… Une source unique = fin de la
// dérive. NE PAS réintroduire de libellé de service en dur ailleurs : importer
// `SERVICES` (ou les helpers) depuis ce fichier.
//
//   • `officialFr` / `officialEn` = LE nom officiel. À utiliser PARTOUT.
//   • `navShortFr` / `navShortEn` = troncature d'affichage RÉSERVÉE à la barre
//     de nav du header (6 onglets sur une seule ligne ; les noms officiels longs
//     — « Implémentation & automatisation IA » fait ~33 car. — n'y tiennent pas).
//     Ce n'est PAS un autre nom : c'est le même service abrégé pour l'écran.
//     ❌ Ne jamais réutiliser `navShort` hors de `Header.tsx` / `MobileNav.tsx`.
//   • `footerFr` / `footerEn` = libellé d'affichage de la colonne Services du
//     footer (Will 2026-06-10 : préfère « Formations IA » / « Sites web & SaaS
//     IA » plutôt que les noms officiels longs, plus aérés dans la colonne).
//     RÉSERVÉ au `Footer.tsx`. Toujours un seul SSOT : 3 variantes d'un MÊME
//     service vivent ici, pas éparpillées.
//
// L'ordre du tableau `SERVICES` = l'ordre d'affichage canonique (header + footer).
// Tarifs N'EST PAS un service : il reste géré à part par les consommateurs.

export type ServiceId = "formations" | "unAUn" | "audit" | "implementation" | "sitesWeb";

export interface ServiceDef {
  id: ServiceId;
  /** Route hub du service (pathname next-intl). */
  href: string;
  /** Nom officiel unique — JSON-LD, llms.txt, breadcrumbs, KB. */
  officialFr: string;
  officialEn: string;
  /** Troncature d'affichage header uniquement (single-line). */
  navShortFr: string;
  navShortEn: string;
  /** Libellé colonne Services du footer uniquement. */
  footerFr: string;
  footerEn: string;
}

export const SERVICES: readonly ServiceDef[] = [
  {
    id: "formations",
    href: "/formations",
    officialFr: "Formations & interventions IA",
    officialEn: "AI training & sessions",
    navShortFr: "Formations IA",
    navShortEn: "AI training",
    footerFr: "Formations IA",
    footerEn: "AI training",
  },
  {
    id: "unAUn",
    href: "/un-a-un",
    officialFr: "Accompagnement 1 to 1",
    officialEn: "1-to-1 coaching",
    navShortFr: "1 to 1",
    navShortEn: "1 to 1",
    footerFr: "Accompagnement 1 to 1",
    footerEn: "1-to-1 coaching",
  },
  {
    id: "audit",
    href: "/audit",
    officialFr: "Audit IA",
    officialEn: "AI audit",
    navShortFr: "Audit IA",
    navShortEn: "AI audit",
    footerFr: "Audit IA",
    footerEn: "AI audit",
  },
  {
    id: "implementation",
    href: "/implementation",
    officialFr: "Implémentation & automatisation IA",
    officialEn: "AI implementation & automation",
    navShortFr: "Implémentation IA",
    navShortEn: "AI implementation",
    footerFr: "Implémentation & automatisation IA",
    footerEn: "AI implementation & automation",
  },
  {
    id: "sitesWeb",
    href: "/sites-web-augmentes",
    officialFr: "Sites web & SaaS Native IA",
    officialEn: "AI-native websites & SaaS",
    navShortFr: "Sites web Native IA",
    navShortEn: "AI-native websites",
    footerFr: "Sites web & SaaS IA",
    footerEn: "AI websites & SaaS",
  },
] as const;

/** Accès O(1) par id. */
export const SERVICE_BY_ID = Object.fromEntries(SERVICES.map((s) => [s.id, s])) as Record<
  ServiceId,
  ServiceDef
>;

/** Nom officiel selon la locale. */
export function serviceOfficial(s: ServiceDef, isFr: boolean): string {
  return isFr ? s.officialFr : s.officialEn;
}

/** Troncature header selon la locale (header/MobileNav uniquement). */
export function serviceNavShort(s: ServiceDef, isFr: boolean): string {
  return isFr ? s.navShortFr : s.navShortEn;
}

/** Libellé colonne Services du footer selon la locale (Footer.tsx uniquement). */
export function serviceFooter(s: ServiceDef, isFr: boolean): string {
  return isFr ? s.footerFr : s.footerEn;
}
