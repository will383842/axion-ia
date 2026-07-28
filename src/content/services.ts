// SSOT — nom officiel UNIQUE de chacun des 5 services Axion-IA.
// Arbitré par Will le 2026-06-10, resserré le 2026-07-28 (audit positionnement).
// TOUT affichage du nom d'un service DOIT dériver d'ici (footer, pages, H1,
// JSON-LD, KB, sitemap, llms.txt, home…).
//
// Pourquoi ce fichier : avant lui, chaque service traînait 4 à 5 libellés
// divergents éparpillés — header (`.replace()` sur les clés i18n), footer
// hardcodé, clés `nav.*` de `messages/*.json`, blocs `home.valueXAction`,
// `src/content/knowledge/services.ts`, llms.txt… Une source unique = fin de la
// dérive. NE PAS réintroduire de libellé de service en dur ailleurs : importer
// `SERVICES` (ou les helpers) depuis ce fichier.
//
// ── Resserrage 2026-07-28 ────────────────────────────────────────────────────
// L'audit de positionnement a montré que les 3 variantes autorisées (official /
// navShort / footer) avaient dérivé en 5 noms réellement DIFFÉRENTS pour un même
// service (« Sites web & SaaS Native IA » / « Sites web Native IA » / « Sites
// web & SaaS IA » / « Sites web augmentés IA » / « Sites web & SaaS augmentés
// par l'IA »). Conséquence : les moteurs IA (ChatGPT Search, Perplexity, AI
// Overviews) n'arrivaient pas à consolider une entité « service Axion-IA ».
//
// Trois décisions :
//   1. `footerFr/footerEn` SUPPRIMÉS — aucune contrainte de layout ne les
//      justifiait. Le footer affiche désormais le nom officiel.
//   2. `navShortFr/navShortEn` CONSERVÉS (la barre de nav impose 6 onglets sur
//      une seule ligne, arbitrage Will 2026-06-08) mais contraints : la
//      troncature DOIT être un PRÉFIXE STRICT du nom officiel. Ce n'est plus un
//      autre nom, c'est littéralement le même nom coupé. Garde-fou :
//      `services.test.ts` échoue si un `navShort` n'est pas un préfixe.
//   3. Noms officiels raccourcis pour que 4 services sur 5 aient
//      navShort === official (plus aucune troncature à maintenir) :
//        • « Formations & interventions IA » → « Formations IA »
//          (« interventions » désignait l'ancienne offre fusionnée dans
//          /formations ; `/interventions` n'est plus qu'une 301 — cf.
//          `legacy-redirects.ts`. Garder le mot entretenait un nom mort.)
//        • « Accompagnement 1 to 1 » → « Coaching IA 1-to-1 »
//          (« accompagnement » est vague et non recherché ; « coaching » est le
//          terme requêté. Typo unifiée `1-to-1`, plus jamais `1 to 1`.)
//        • « Implémentation & automatisation IA » → « Implémentation IA »
//          (le mot-clé « automatisation » reste porté par le title/H1 et le
//          JSON-LD de `/implementation`, pas par le nom du service.)
//        • « Sites web & SaaS Native IA » → « Sites web & SaaS IA »
//          (« Native IA » se lisait comme un anglicisme bancal ; la nature
//          IA-native reste expliquée dans le corps de la page.)
//
//   • `officialFr` / `officialEn` = LE nom officiel. À utiliser PARTOUT.
//   • `navShortFr` / `navShortEn` = troncature d'affichage RÉSERVÉE à la barre
//     de nav du header. Préfixe strict de l'officiel, jamais un autre nom.
//     ❌ Ne jamais réutiliser `navShort` hors de `Header.tsx` / `MobileNav.tsx`.
//
// L'ordre du tableau `SERVICES` = l'ordre d'affichage canonique (header + footer)
// ET l'ordre narratif du positionnement : engagement croissant, de la première
// formation à la plateforme sur mesure.
// Tarifs N'EST PAS un service : il reste géré à part par les consommateurs.

export type ServiceId = "formations" | "unAUn" | "audit" | "implementation" | "sitesWeb";

export interface ServiceDef {
  id: ServiceId;
  /** Route hub du service (pathname next-intl). */
  href: string;
  /** Nom officiel unique — JSON-LD, llms.txt, breadcrumbs, footer, KB, H1. */
  officialFr: string;
  officialEn: string;
  /**
   * Troncature d'affichage header uniquement (single-line).
   * INVARIANT : doit être un préfixe strict de `officialFr`/`officialEn`.
   * Vérifié par `services.test.ts`.
   */
  navShortFr: string;
  navShortEn: string;
}

export const SERVICES: readonly ServiceDef[] = [
  {
    id: "formations",
    href: "/formations",
    officialFr: "Formations IA",
    officialEn: "AI training",
    navShortFr: "Formations IA",
    navShortEn: "AI training",
  },
  {
    id: "unAUn",
    href: "/un-a-un",
    officialFr: "Coaching IA 1-to-1",
    officialEn: "1-to-1 AI coaching",
    // Seul service dont la nav tronque : « Coaching IA 1-to-1 » (18 car.)
    // ferait déborder la barre 6-onglets. Préfixe strict conservé.
    navShortFr: "Coaching IA",
    navShortEn: "1-to-1 AI coaching",
  },
  {
    id: "audit",
    href: "/audit",
    officialFr: "Audit IA",
    officialEn: "AI audit",
    navShortFr: "Audit IA",
    navShortEn: "AI audit",
  },
  {
    id: "implementation",
    href: "/implementation",
    officialFr: "Implémentation IA",
    officialEn: "AI implementation",
    navShortFr: "Implémentation IA",
    navShortEn: "AI implementation",
  },
  {
    id: "sitesWeb",
    href: "/sites-web-augmentes",
    officialFr: "Sites web & SaaS IA",
    officialEn: "AI websites & SaaS",
    navShortFr: "Sites web & SaaS IA",
    navShortEn: "AI websites & SaaS",
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
