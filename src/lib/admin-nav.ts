// Refonte admin mai 2026 — SSOT navigation admin (PR 1).
//
// Pourquoi ce fichier :
//   Avant la refonte, `buildNav()` était inline dans
//   `src/app/[locale]/(admin)/[adminPrefix]/layout.tsx` (36 items, 6 groupes).
//   `AdminCommandPalette.tsx` réimplémentait une liste équivalente → drift
//   risk garanti à chaque ajout/renommage de section (Audit A1 finding #4).
//
//   Cette extraction met en place la SOURCE UNIQUE de vérité que :
//   - le layout admin consomme pour rendre la sidebar (`<AdminSidebarNav items={…}>`),
//   - `AdminCommandPalette` consommera après refonte PR 5 pour ses items,
//   - `<AdminBreadcrumbs>` (PR 4) utilisera pour résoudre pathname → label.
//
//   La signature `buildNav(adminPrefix)` est conservée à l'identique pour
//   minimiser la friction de migration côté layout (PR 1 = pas de bascule
//   visuelle, simple extraction).
//
// Icons :
//   Les icônes sont actuellement des emojis (anti-pattern audit A1 #2).
//   La PR 5 (sidebar v2) remplacera ces emojis par des composants
//   `lucide-react` typés (`icon: LucideIcon`). En PR 1, on garde les
//   emojis pour ne pas casser le rendu V1 et permettre une migration
//   incrémentale.

export type AdminNavGroup =
  | "main"
  | "contacts"
  | "rendez-vous"
  | "recrutement"
  | "content"
  | "content_gen"
  | "qualiopi"
  | "documents-interventions"
  | "coaching-1to1"
  | "image-bank"
  | "presse"
  | "chatbot"
  | "engagement"
  | "ops"
  | "system";

/**
 * Pôle (sous-groupe niveau 1) du groupe `content_gen` — refonte UX 2026-06-16
 * (cf. `_AUDIT/CONTENT-GEN-UX-2026/DECISION-IA.md` §1-§2).
 *
 * Taxonomie orientée tâche, ordonnée par fréquence (du plus chaud au plus froid) :
 * Lancer > Suivre > Publier (quotidien) > Villes (occasionnel) >
 * Qualité & Coûts (occasionnel) > Réglages (rare / setup).
 */
export type ContentGenPole = "lancer" | "suivre" | "publier" | "villes" | "qualite" | "reglages";

/**
 * Pôle (sous-groupe niveau 1) du groupe `qualiopi` — refonte UX 2026-07-08.
 *
 * Le back-office Qualiopi comptait ~24 onglets en liste plate → écrasant et
 * illisible. On les regroupe en 5 pôles orientés usage, ordonnés selon le flux
 * métier réel : Formations & séances (production quotidienne) > Commercial
 * (vente) > Conformité & audit (preuves Qualiopi) > Registres & veille (obligs
 * périodiques) > Administration (setup/RGPD, rare). Même mécanisme d'accordéon
 * que les pôles content_gen (cf. `<AdminSidebarNav>`).
 *
 * NB : clés volontairement DISTINCTES des `ContentGenPole` (pas de collision
 * « reglages ») pour que l'état plié/déplié d'un pôle ne fuite pas d'un groupe
 * à l'autre (Set<string> partagé côté sidebar).
 */
export type QualiopiPole =
  | "formations"
  | "commercial"
  | "conformite"
  | "registres"
  | "administration";

/**
 * Pôle (sous-groupe niveau 1) du groupe `documents-interventions` — refonte UX
 * 2026-07-08. Découpage léger : les buckets documentaires « par activité » vs
 * les utilitaires (annuaire, import). Clés distinctes des autres pôles.
 */
export type DocumentsPole = "activite" | "outils";

/**
 * Pôle du groupe `main` (« Activité quotidienne ») — refonte UX 2026-07-08.
 * Découpe les 10 onglets quotidiens en 3 blocs métier. Clés distinctes.
 */
export type MainPole = "agenda" | "facturation";

/**
 * Pôle du groupe `image-bank` — refonte UX 2026-07-08. 3 blocs. Clés distinctes.
 */
export type ImageBankPole = "bibliotheque" | "organisation" | "admin";

export interface AdminNavItem {
  href: string;
  label: string;
  /**
   * Icon string (emoji V1) ou identifiant d'icône `lucide-react` (V2 PR 5).
   * Format string pour rester compatible avec `<AdminSidebarNav>` actuel.
   */
  icon: string;
  group: AdminNavGroup;
  /**
   * Pôle (sous-groupe N1) — renseigné pour `group: "content_gen"` (6 pôles) et
   * `group: "qualiopi"` (5 pôles, refonte UX 2026-07-08). Permet à
   * `<AdminSidebarNav>` de regrouper les items en accordéon par pôle.
   * (cf. DECISION-IA.md §1 — refonte UX content-gen 2026-06-16.)
   */
  subGroup?: ContentGenPole | QualiopiPole | DocumentsPole | MainPole | ImageBankPole;
  /**
   * Niveau d'exposition. Défaut implicite `"simple"`.
   * En mode Simple, la sidebar masque les items `tier: "advanced"` et les
   * pôles entièrement avancés (Qualité & Coûts, Réglages). Le toggle
   * « Avancé » les révèle. La command palette voit TOUS les items quel que
   * soit le tier (aucune route « cmdk-only » ne disparaît).
   */
  tier?: "simple" | "advanced";
  /**
   * Href du parent (page N2) pour les éléments de niveau 3 atteignables par
   * breadcrumbs mais **non rendus dans la sidebar**. Renseigner `parent`
   * suffit à exclure l'item du rendu sidebar tout en gardant la résolution
   * pathname → libellé pour `<AdminBreadcrumbs>`. (Non utilisé en PR Étape B,
   * réservé aux N3 à venir.)
   */
  parent?: string;
}

export const ADMIN_NAV_GROUP_LABELS: Record<AdminNavGroup, string> = {
  main: "Activité quotidienne",
  contacts: "Contacts",
  "rendez-vous": "Rendez-vous",
  recrutement: "Recrutement",
  content: "Contenu",
  content_gen: "Génération de contenu",
  qualiopi: "Formation / Qualiopi",
  "documents-interventions": "Documents",
  "coaching-1to1": "Coaching 1-to-1",
  "image-bank": "Banque d'images",
  presse: "Salle de presse",
  chatbot: "Chatbot",
  engagement: "Engagement",
  ops: "Ops & monitoring",
  system: "Système",
};

/**
 * Libellés FR clairs des 6 pôles du groupe `content_gen`.
 * (cf. DECISION-IA.md §1 — refonte UX content-gen 2026-06-16.)
 */
export const CONTENT_GEN_POLE_LABELS: Record<ContentGenPole, string> = {
  lancer: "Lancer",
  suivre: "Suivre",
  publier: "Publier",
  villes: "Villes",
  qualite: "Qualité & Coûts",
  reglages: "Réglages",
};

/**
 * Ordre d'affichage des pôles `content_gen` dans la sidebar :
 * du plus chaud (quotidien) au plus froid (rare / setup).
 * (cf. DECISION-IA.md §0 — ordre par fréquence.)
 */
export const CONTENT_GEN_POLE_ORDER: ReadonlyArray<ContentGenPole> = [
  "lancer",
  "suivre",
  "publier",
  "villes",
  "qualite",
  "reglages",
];

/**
 * Libellés FR clairs des 5 pôles du groupe `qualiopi` (refonte UX 2026-07-08).
 */
export const QUALIOPI_POLE_LABELS: Record<QualiopiPole, string> = {
  formations: "Formations & séances",
  commercial: "Commercial",
  conformite: "Conformité & audit",
  registres: "Registres & veille",
  administration: "Administration",
};

/**
 * Ordre d'affichage des pôles `qualiopi` : du plus chaud (production
 * quotidienne) au plus froid (setup/RGPD, rare).
 */
export const QUALIOPI_POLE_ORDER: ReadonlyArray<QualiopiPole> = [
  "formations",
  "commercial",
  "conformite",
  "registres",
  "administration",
];

/**
 * Libellés + ordre des 2 pôles du groupe `documents-interventions`
 * (refonte UX 2026-07-08). Découpage léger : buckets documentaires vs outils.
 */
export const DOCUMENTS_POLE_LABELS: Record<DocumentsPole, string> = {
  activite: "Par activité",
  outils: "Outils",
};

export const DOCUMENTS_POLE_ORDER: ReadonlyArray<DocumentsPole> = ["activite", "outils"];

/** Pôles du groupe `main` (« Activité quotidienne ») — refonte UX 2026-07-08. */
export const MAIN_POLE_LABELS: Record<MainPole, string> = {
  // « agenda » ne contient plus que le Tableau de bord (Calendrier/Réservations/
  // Options 48h masqués — vestiges booking, cf. buildAdminNav). Relabellisé.
  // « facturation » est entièrement masqué (pôle vide → header auto-caché).
  agenda: "Vue d'ensemble",
  facturation: "Facturation",
};

export const MAIN_POLE_ORDER: ReadonlyArray<MainPole> = ["agenda", "facturation"];

/** Pôles du groupe `image-bank` — refonte UX 2026-07-08. */
export const IMAGE_BANK_POLE_LABELS: Record<ImageBankPole, string> = {
  bibliotheque: "Bibliothèque",
  organisation: "Organisation & qualité",
  admin: "Administration",
};

export const IMAGE_BANK_POLE_ORDER: ReadonlyArray<ImageBankPole> = [
  "bibliotheque",
  "organisation",
  "admin",
];

/**
 * Maps génériques « groupe → pôles » consommées par `<AdminSidebarNav>` pour
 * rendre N'IMPORTE quel groupe sous-divisé en accordéon de pôles, sans coder en
 * dur `content_gen`. Un groupe absent de ces maps est rendu en liste plate.
 * Les valeurs sont des `string` (les clés de pôles), volontairement disjointes
 * entre groupes pour un état plié/déplié `Set<string>` sans collision.
 */
export const GROUP_POLE_ORDER: Partial<Record<AdminNavGroup, ReadonlyArray<string>>> = {
  main: MAIN_POLE_ORDER,
  content_gen: CONTENT_GEN_POLE_ORDER,
  qualiopi: QUALIOPI_POLE_ORDER,
  "documents-interventions": DOCUMENTS_POLE_ORDER,
  "image-bank": IMAGE_BANK_POLE_ORDER,
};

export const GROUP_POLE_LABELS: Partial<Record<AdminNavGroup, Readonly<Record<string, string>>>> = {
  main: MAIN_POLE_LABELS,
  content_gen: CONTENT_GEN_POLE_LABELS,
  qualiopi: QUALIOPI_POLE_LABELS,
  "documents-interventions": DOCUMENTS_POLE_LABELS,
  "image-bank": IMAGE_BANK_POLE_LABELS,
};

export const ADMIN_NAV_GROUP_ORDER: ReadonlyArray<AdminNavGroup> = [
  "main",
  "contacts",
  "rendez-vous",
  "recrutement",
  "content",
  "content_gen",
  "qualiopi",
  "documents-interventions",
  "coaching-1to1",
  "image-bank",
  "presse",
  "chatbot",
  "engagement",
  "ops",
  "system",
];

/**
 * Construit la liste des items de navigation admin pour un adminPrefix donné.
 *
 * @param adminPrefix - segment URL admin résolu par adminSegment() (cf. src/lib/admin-path.ts).
 * @returns liste typée des items pour la sidebar / cmdk / breadcrumbs.
 */
export function buildAdminNav(adminPrefix: string): ReadonlyArray<AdminNavItem> {
  const base = `/fr/${adminPrefix}`;
  return [
    // ── main (« Activité quotidienne ») — 3 pôles (refonte UX 2026-07-08) ───
    // ▸ VUE D'ENSEMBLE (ex-« Agenda & réservations »)
    //   Les pôles « agenda » (Calendrier/Réservations/Options 48h) et
    //   « facturation » (Devis/Factures/Paiements/Échéanciers) pilotaient
    //   l'ancien flux de réservation payante, DOUBLEMENT éteint (audit 2026-07-09) :
    //     1. Le créneau public a été remplacé par Calendly (`/appel`, iframe qui
    //        écrit dans `CalendlyEvent`, consommé par « Contacts › Calendly ») ;
    //        `createBookingAction`/`postOption48hAction` n'existent plus → plus
    //        aucun Booking/BookingOption/Quote/Invoice/Payment ne se crée.
    //     2. Stripe est neutralisé (`isStripeConfigured()` = false tant que
    //        `STRIPE_ENABLED` ≠ "true").
    //   La facturation VIVANTE est sous Qualiopi (« Qualiopi › Devis » = modèle
    //   `Devis`, « Qualiopi › Financements » = `FactureFormation`). Les 7 items
    //   ci-dessous sont donc morts (+ Devis/Factures redondants avec Qualiopi).
    //   On les MASQUE via `parent` (filtre `it.parent == null` dans
    //   AdminSidebarNav) : routes conservées (URL directe + command palette +
    //   breadcrumb) mais retirées de la sidebar. Le pôle « facturation » se
    //   vide → header masqué auto (poleItems.length === 0). Le pôle « agenda »
    //   ne garde que le Tableau de bord → relabellisé « Vue d'ensemble ».
    //   Réversible : retirer `parent`. (Suppression dure code/schéma = séparé.)
    { href: `${base}`, label: "Tableau de bord", icon: "📊", group: "main", subGroup: "agenda" },
    {
      href: `${base}/calendrier`,
      label: "Calendrier",
      icon: "📅",
      group: "main",
      subGroup: "agenda",
      parent: `${base}`,
    },
    {
      href: `${base}/reservations`,
      label: "Réservations",
      icon: "📋",
      group: "main",
      subGroup: "agenda",
      parent: `${base}`,
    },
    {
      href: `${base}/options`,
      label: "Options 48h",
      icon: "⏳",
      group: "main",
      subGroup: "agenda",
      parent: `${base}`,
    },
    // ▸ FACTURATION (vestige — masqué, cf. bloc ci-dessus)
    {
      href: `${base}/devis`,
      label: "Devis",
      icon: "📄",
      group: "main",
      subGroup: "facturation",
      parent: `${base}`,
    },
    {
      href: `${base}/factures`,
      label: "Factures",
      icon: "🧾",
      group: "main",
      subGroup: "facturation",
      parent: `${base}`,
    },
    {
      href: `${base}/paiements`,
      label: "Paiements",
      icon: "💶",
      group: "main",
      subGroup: "facturation",
      parent: `${base}`,
    },
    {
      href: `${base}/echeanciers`,
      label: "Échéanciers",
      icon: "📅",
      group: "main",
      subGroup: "facturation",
      parent: `${base}`,
    },
    // ── Contacts — MESSAGES ÉCRITS (groupe indépendant, refonte UX 2026-07-09).
    //    Catégories métier. Les appels (Calendly) et le recrutement (candidatures)
    //    ont leurs PROPRES groupes ci-dessous — distinction message/appel/candidature.
    {
      href: `${base}/contacts/messages`,
      label: "Tous les messages",
      icon: "📥",
      group: "contacts",
    },
    {
      href: `${base}/contacts/clients`,
      label: "Clients",
      icon: "💼",
      group: "contacts",
    },
    {
      href: `${base}/contacts/presse`,
      label: "Presse",
      icon: "📰",
      group: "contacts",
    },
    {
      href: `${base}/contacts/partenariats`,
      label: "Partenariats",
      icon: "🤝",
      group: "contacts",
    },
    {
      href: `${base}/contacts/investisseurs`,
      label: "Investisseurs",
      icon: "📈",
      group: "contacts",
    },
    // ── Rendez-vous — APPELS (Calendly ≠ messages écrits) ───────────────────
    {
      href: `${base}/contacts/rendez-vous`,
      label: "RV téléphonique",
      icon: "📞",
      group: "rendez-vous",
    },
    {
      href: `${base}/contacts/rendez-vous/calendrier`,
      label: "Calendrier RDV",
      icon: "🗓️",
      group: "rendez-vous",
    },
    {
      href: `${base}/contacts/calendly`,
      label: "Appels Calendly",
      icon: "📅",
      group: "rendez-vous",
    },
    // ── Recrutement — candidatures regroupées (offres publiées + spontanées) ──
    {
      href: `${base}/candidatures`,
      label: "Candidatures aux offres",
      icon: "📨",
      group: "recrutement",
    },
    {
      href: `${base}/contacts/commercial`,
      label: "Messages recrutement",
      icon: "🧑‍💼",
      group: "recrutement",
    },
    // ── contenu ──────────────────────────────────────────────────────────
    { href: `${base}/connaissances`, label: "Connaissances", icon: "📚", group: "content" },
    // ── Génération de contenu (refonte UX 2026-06-16 — DECISION-IA.md §1-§3) ──
    //   Taxonomie « tâche » en 6 pôles (subGroup) ordonnés par fréquence,
    //   toggle Simple/Avancé (tier). Libellés FR clairs (§3 renommage).
    //   Zéro capacité perdue : routes mortes/fusionnées retirées de la nav
    //   mais conservées via redirections (Étape E) ; items avancés restent
    //   accessibles via toggle + command palette.
    //
    // ▸ LANCER (quotidien) — point d'entrée unique = wizard /campaigns/new
    {
      href: `${base}/content-gen/campaigns/new`,
      label: "Nouvelle campagne",
      icon: "➕",
      group: "content_gen",
      subGroup: "lancer",
      tier: "simple",
    },
    {
      href: `${base}/content-gen/coverage/presets`,
      label: "Campagnes pré-réglées",
      icon: "✨",
      group: "content_gen",
      subGroup: "lancer",
      tier: "simple",
    },
    {
      href: `${base}/content-gen/orchestrator/adhoc`,
      label: "Générer une seule page",
      icon: "⚡",
      group: "content_gen",
      subGroup: "lancer",
      tier: "advanced",
    },
    {
      // Séparation Actualités (2026-07-01) — centre de contrôle des news RSS
      // (volume/jour + fraîcheur) dans le pôle Lancer. Les news sont publiées
      // séparément du blog, sur /actualites.
      href: `${base}/content-gen/news`,
      label: "Actualités (news RSS)",
      icon: "📰",
      group: "content_gen",
      subGroup: "lancer",
      tier: "simple",
    },
    {
      // Masqué de la sidebar (page de setup one-shot) mais conservée : accessible
      // par URL directe + command palette, et le breadcrumb résout toujours le
      // libellé. `parent` défini ⇒ exclu du rendu sidebar (cf. AdminSidebarNav
      // filtre `it.parent == null`).
      href: `${base}/content-gen/onboarding`,
      label: "Premiers pas",
      icon: "🚀",
      group: "content_gen",
      subGroup: "lancer",
      tier: "simple",
      parent: `${base}/content-gen`,
    },
    // ▾ SUIVRE (quotidien)
    {
      href: `${base}/content-gen`,
      label: "Tableau de bord",
      icon: "📊",
      group: "content_gen",
      subGroup: "suivre",
      tier: "simple",
    },
    {
      href: `${base}/content-gen/coverage`,
      label: "Campagnes",
      icon: "🗂️",
      group: "content_gen",
      subGroup: "suivre",
      tier: "simple",
    },
    {
      href: `${base}/content-gen/jobs`,
      label: "Générations en cours",
      icon: "⚙️",
      group: "content_gen",
      subGroup: "suivre",
      tier: "simple",
    },
    {
      href: `${base}/content-gen/observatoire`,
      label: "Observatoire IA 2026",
      icon: "📊",
      group: "content_gen",
      subGroup: "suivre",
      tier: "advanced",
    },
    // NB — « Pilotage » (/orchestrator) et « File d'attente » (/queue) NE sont
    // PAS des entrées de nav : ce sont des doublons fusionnés (DECISION-IA §2).
    //   • /orchestrator → 308 → /content-gen : ses KPIs vivent déjà dans le
    //     Tableau de bord (getOrchestratorStats) ; un 2e item « Pilotage »
    //     mènerait à la même page → on l'a retiré pour ne pas recréer de doublon.
    //   • /queue → 308 → /jobs?view=queue : la file temps réel est affichée sur
    //     le Tableau de bord (carte « Queue temps réel ») et le détail dans /jobs.
    // Les redirections (Étape E) préservent les bookmarks → zéro capacité perdue.
    // ▸ PUBLIER (quotidien)
    {
      href: `${base}/content-gen/review-queue`,
      label: "À valider",
      icon: "✅",
      group: "content_gen",
      subGroup: "publier",
      tier: "simple",
    },
    {
      href: `${base}/content-gen/publications`,
      label: "Contenus publiés",
      icon: "📰",
      group: "content_gen",
      subGroup: "publier",
      tier: "simple",
    },
    {
      href: `${base}/content-gen/publications-status`,
      label: "Suivi des publications (kanban)",
      icon: "📋",
      group: "content_gen",
      subGroup: "publier",
      tier: "advanced",
    },
    {
      href: `${base}/content-gen/hero-images`,
      label: "Photos hero Unsplash",
      icon: "🖼️",
      group: "content_gen",
      subGroup: "publier",
      tier: "simple",
    },
    {
      href: `${base}/content-gen/citations-backfill`,
      label: "Backfill citations (Sources)",
      icon: "🔗",
      group: "content_gen",
      subGroup: "publier",
      tier: "advanced",
    },
    // ▸ VILLES (occasionnel)
    {
      href: `${base}/content-gen/cities-coverage`,
      label: "Couverture des villes",
      icon: "🏙️",
      group: "content_gen",
      subGroup: "villes",
      tier: "simple",
    },
    {
      href: `${base}/content-gen/coverage-map`,
      label: "Carte de couverture",
      icon: "🗺️",
      group: "content_gen",
      subGroup: "villes",
      tier: "simple",
    },
    {
      href: `${base}/content-gen/cities-order`,
      label: "Ordre de génération des villes",
      icon: "🔢",
      group: "content_gen",
      subGroup: "villes",
      tier: "simple",
    },
    {
      href: `${base}/content-gen/city-equity`,
      label: "Équité entre villes",
      icon: "⚖️",
      group: "content_gen",
      subGroup: "villes",
      tier: "advanced",
    },
    {
      href: `${base}/content-gen/city-coverage`,
      label: "Qualité des données (pilote)",
      icon: "📐",
      group: "content_gen",
      subGroup: "villes",
      tier: "advanced",
    },
    {
      href: `${base}/content-gen/geo`,
      label: "Cockpit géo",
      icon: "🌍",
      group: "content_gen",
      subGroup: "villes",
      tier: "advanced",
    },
    {
      href: `${base}/content-gen/geo/coverage-table`,
      label: "Tableau croisé ville × secteur",
      icon: "📊",
      group: "content_gen",
      subGroup: "villes",
      tier: "advanced",
    },
    // ▾ QUALITÉ & COÛTS (occasionnel — pôle entièrement avancé)
    {
      href: `${base}/content-gen/quality`,
      label: "Qualité du contenu",
      icon: "📈",
      group: "content_gen",
      subGroup: "qualite",
      tier: "advanced",
    },
    {
      href: `${base}/content-gen/costs`,
      label: "Coûts",
      icon: "💰",
      group: "content_gen",
      subGroup: "qualite",
      tier: "advanced",
    },
    {
      href: `${base}/content-gen/similarity-monitor`,
      label: "Détection de doublons",
      icon: "🔁",
      group: "content_gen",
      subGroup: "qualite",
      tier: "advanced",
      // Masqué de la sidebar tant que la page est un placeholder (Sprint 4 non
      // livré). `parent` exclut du rendu sidebar mais conserve la route + la
      // résolution breadcrumbs + l'accès via la palette (Ctrl+K). Retirer
      // `parent` quand la page affiche des données réelles.
      parent: `${base}/content-gen`,
    },
    {
      href: `${base}/content-gen/brand-voice-drift`,
      label: "Dérive du ton éditorial",
      icon: "🎙️",
      group: "content_gen",
      subGroup: "qualite",
      tier: "advanced",
    },
    {
      href: `${base}/content-gen/embeddings`,
      label: "Suivi des vecteurs de similarité",
      icon: "🧮",
      group: "content_gen",
      subGroup: "qualite",
      tier: "advanced",
    },
    {
      href: `${base}/content-gen/external-links`,
      label: "Liens externes",
      icon: "🔗",
      group: "content_gen",
      subGroup: "qualite",
      tier: "advanced",
    },
    {
      href: `${base}/content-gen/kb-readonly`,
      label: "Base de connaissances (consultation)",
      icon: "📚",
      group: "content_gen",
      subGroup: "qualite",
      tier: "advanced",
    },
    // ▾ RÉGLAGES (rare / setup — pôle entièrement avancé)
    {
      href: `${base}/content-gen/settings`,
      label: "Réglages génération",
      icon: "⚙️",
      group: "content_gen",
      subGroup: "reglages",
      tier: "advanced",
    },
    {
      href: `${base}/content-gen/rss`,
      label: "Sources RSS (actualités)",
      icon: "📡",
      group: "content_gen",
      subGroup: "reglages",
      tier: "advanced",
    },
    {
      href: `${base}/content-gen/templates`,
      label: "Instructions IA (prompts)",
      icon: "📋",
      group: "content_gen",
      subGroup: "reglages",
      tier: "advanced",
    },
    {
      href: `${base}/content-gen/keyword-tracking`,
      label: "Suivi des positions",
      icon: "🎯",
      group: "content_gen",
      subGroup: "reglages",
      tier: "advanced",
      // Masqué de la sidebar tant que la page est un placeholder (sync GSC/SerpAPI
      // non câblé, Sprint 12.5). Voir note `parent` sur « Détection de doublons ».
      parent: `${base}/content-gen`,
    },
    {
      href: `${base}/content-gen/landing-variants`,
      label: "Variantes de landing",
      icon: "🧪",
      group: "content_gen",
      subGroup: "reglages",
      tier: "advanced",
    },
    {
      href: `${base}/content-gen/author/manon`,
      label: "Profil de l'auteur (Manon)",
      icon: "✍️",
      group: "content_gen",
      subGroup: "reglages",
      tier: "advanced",
    },
    { href: `${base}/blog`, label: "Blog", icon: "📝", group: "content" },
    { href: `${base}/categories`, label: "Catégories", icon: "🏷️", group: "content" },
    { href: `${base}/case-studies`, label: "Cas concrets", icon: "🏆", group: "content" },
    { href: `${base}/avis`, label: "Avis clients", icon: "⭐", group: "content" },
    { href: `${base}/offres-emploi`, label: "Offres d'emploi", icon: "💼", group: "content" },
    { href: `${base}/faq`, label: "FAQ", icon: "❓", group: "content" },
    { href: `${base}/help`, label: "Centre d'aide", icon: "❔", group: "content" },
    // ── Formation / Qualiopi (back-office OF) ──────────────────────────────
    //   Réorganisé en 5 pôles (refonte UX 2026-07-08) : les ~24 onglets étaient
    //   en liste plate = écrasant. `subGroup` pilote l'accordéon par pôle
    //   (cf. QUALIOPI_POLE_ORDER + `<AdminSidebarNav>`). L'ordre des items suit
    //   l'ordre d'affichage voulu DANS chaque pôle (rendu = ordre source).
    //
    // ▸ FORMATIONS & SÉANCES (production quotidienne)
    {
      href: `${base}/qualiopi`,
      label: "Vue d'ensemble",
      icon: "🎓",
      group: "qualiopi",
      subGroup: "formations",
    },
    {
      href: `${base}/qualiopi/formations`,
      label: "Formations",
      icon: "📘",
      group: "qualiopi",
      subGroup: "formations",
    },
    {
      href: `${base}/qualiopi/formation-engine`,
      label: "Formation Engine",
      icon: "⚙️",
      group: "qualiopi",
      subGroup: "formations",
    },
    {
      href: `${base}/qualiopi/formation-engine/validations`,
      label: "Validations IA",
      icon: "✅",
      group: "qualiopi",
      subGroup: "formations",
    },
    {
      href: `${base}/qualiopi/sessions`,
      label: "Sessions",
      icon: "📅",
      group: "qualiopi",
      subGroup: "formations",
    },
    {
      href: `${base}/qualiopi/formateurs`,
      label: "Formateurs",
      icon: "👨‍🏫",
      group: "qualiopi",
      subGroup: "formations",
    },
    {
      href: `${base}/qualiopi/stagiaires`,
      label: "Stagiaires",
      icon: "🧑‍🎓",
      group: "qualiopi",
      subGroup: "formations",
    },
    // ▸ COMMERCIAL (vente)
    {
      href: `${base}/qualiopi/offres`,
      label: "Offres",
      icon: "🏷️",
      group: "qualiopi",
      subGroup: "commercial",
    },
    {
      href: `${base}/qualiopi/clients`,
      label: "Clients (CRM)",
      icon: "🏢",
      group: "qualiopi",
      subGroup: "commercial",
    },
    {
      href: `${base}/qualiopi/devis`,
      label: "Devis",
      icon: "📄",
      group: "qualiopi",
      subGroup: "commercial",
    },
    {
      href: `${base}/qualiopi/financements`,
      label: "Financements / Facturation",
      icon: "💳",
      group: "qualiopi",
      subGroup: "commercial",
    },
    // ▸ CONFORMITÉ & AUDIT (preuves Qualiopi)
    {
      href: `${base}/qualiopi/conformite`,
      label: "Conformité",
      icon: "✅",
      group: "qualiopi",
      subGroup: "conformite",
    },
    {
      href: `${base}/qualiopi/indicateurs`,
      label: "Indicateurs / BPF",
      icon: "📊",
      group: "qualiopi",
      subGroup: "conformite",
    },
    {
      href: `${base}/qualiopi/pilotage`,
      label: "Pilotage",
      icon: "📈",
      group: "qualiopi",
      subGroup: "conformite",
    },
    {
      href: `${base}/qualiopi/appreciations`,
      label: "Appréciations",
      icon: "⭐",
      group: "qualiopi",
      subGroup: "conformite",
    },
    {
      href: `${base}/qualiopi/reclamations`,
      label: "Réclamations",
      icon: "📬",
      group: "qualiopi",
      subGroup: "conformite",
    },
    {
      href: `${base}/qualiopi/mode-auditeur`,
      label: "Mode auditeur",
      icon: "🔍",
      group: "qualiopi",
      subGroup: "conformite",
    },
    // ▸ REGISTRES & VEILLE (obligations périodiques)
    {
      href: `${base}/qualiopi/veille`,
      label: "Veille",
      icon: "🔎",
      group: "qualiopi",
      subGroup: "registres",
    },
    {
      href: `${base}/qualiopi/partenariats`,
      label: "Partenariats",
      icon: "🤝",
      group: "qualiopi",
      subGroup: "registres",
    },
    {
      href: `${base}/qualiopi/sous-traitants`,
      label: "Sous-traitants",
      icon: "🏭",
      group: "qualiopi",
      subGroup: "registres",
    },
    {
      href: `${base}/qualiopi/revue-direction`,
      label: "Revue de direction",
      icon: "📋",
      group: "qualiopi",
      subGroup: "registres",
    },
    // ▸ ADMINISTRATION (setup / RGPD — rare)
    {
      href: `${base}/qualiopi/config`,
      label: "Configuration",
      icon: "⚙️",
      group: "qualiopi",
      subGroup: "administration",
    },
    {
      href: `${base}/qualiopi/rgpd`,
      label: "Demandes RGPD",
      icon: "🔐",
      group: "qualiopi",
      subGroup: "administration",
    },
    {
      href: `${base}/qualiopi/alertes`,
      label: "Alertes",
      icon: "🔔",
      group: "qualiopi",
      subGroup: "administration",
    },
    // ── Documents (hub à 2 niveaux : Activités + Autres) ─────────────────
    //   Activités : Formations / 1-to-1 / Audit (kits pédagogiques Qualiopi,
    //   InterventionDocument) + Implémentations / Sites web (buckets de fichiers
    //   génériques, ConsoleDocument). Autres : documents transverses (plaquette,
    //   pièces admin). « Annuaire équipe » + « Importer un kit » = utilitaires.
    // ▸ PAR ACTIVITÉ (buckets documentaires rattachés à une prestation + Autres)
    {
      href: `${base}/documents-interventions/formations`,
      label: "Formations",
      icon: "📘",
      group: "documents-interventions",
      subGroup: "activite",
    },
    {
      href: `${base}/documents-interventions/un-a-un`,
      label: "1-to-1",
      icon: "👤",
      group: "documents-interventions",
      subGroup: "activite",
    },
    {
      href: `${base}/documents-interventions/audit`,
      label: "Audit",
      icon: "🔍",
      group: "documents-interventions",
      subGroup: "activite",
    },
    {
      href: `${base}/documents-interventions/implementations`,
      label: "Implémentations",
      icon: "⚙️",
      group: "documents-interventions",
      subGroup: "activite",
    },
    {
      href: `${base}/documents-interventions/sites-web`,
      label: "Sites web",
      icon: "🌐",
      group: "documents-interventions",
      subGroup: "activite",
    },
    {
      href: `${base}/documents-interventions/autres`,
      label: "Autres",
      icon: "📎",
      group: "documents-interventions",
      subGroup: "activite",
    },
    // ▸ OUTILS (utilitaires transverses)
    {
      href: `${base}/documents-interventions/destinataires`,
      label: "Annuaire équipe",
      icon: "✉️",
      group: "documents-interventions",
      subGroup: "outils",
    },
    {
      href: `${base}/documents-interventions/import`,
      label: "Importer un kit",
      icon: "📦",
      group: "documents-interventions",
      subGroup: "outils",
    },
    // ── Coaching 1-to-1 (séances AFEST remplies par les formateurs) ───────
    {
      href: `${base}/coaching`,
      label: "Tableau de bord",
      icon: "📈",
      group: "coaching-1to1",
    },
    {
      href: `${base}/coaching/seances`,
      label: "Séances 1-to-1",
      icon: "🗂️",
      group: "coaching-1to1",
    },
    {
      href: `${base}/coaching/formateurs`,
      label: "Accès & connexions formateurs",
      icon: "🧑‍🏫",
      group: "coaching-1to1",
    },
    // ── banque d'images — 3 pôles (refonte UX 2026-07-08) ─────────────────
    // ▸ BIBLIOTHÈQUE
    {
      href: `${base}/image-bank`,
      label: "Vue d'ensemble",
      icon: "🖼️",
      group: "image-bank",
      subGroup: "bibliotheque",
    },
    {
      href: `${base}/image-bank/library`,
      label: "Bibliothèque",
      icon: "📚",
      group: "image-bank",
      subGroup: "bibliotheque",
    },
    {
      href: `${base}/image-bank/upload`,
      label: "Téléverser",
      icon: "⬆️",
      group: "image-bank",
      subGroup: "bibliotheque",
    },
    // ⚠️ Les 5 items `parent`-masqués ci-dessous (bulk-import, categories, tags,
    //   analytics, settings) sont des PLACEHOLDERS jamais livrés : leurs pages
    //   rendent `AdminStubPageV2` (« Cette section est prévue Sprint 2.x »),
    //   aucune donnée, aucune fonctionnalité. Ils promettaient 10 outils dans la
    //   sidebar alors que 5 seulement existent (Vue d'ensemble, Bibliothèque,
    //   Téléverser, File de qualité, Journaux d'utilisation).
    //   Masqués via `parent` (filtre `it.parent == null` dans AdminSidebarNav) :
    //   routes + command palette + breadcrumb conservés. Réversible — retirer
    //   `parent` le jour où le Sprint 2.x est réellement livré.
    //   NB : 4 autres stubs (licensing, seo-audit, sitemap-status, taxonomy)
    //   n'ont jamais eu d'entrée de nav — routes accessibles par URL seulement.
    {
      href: `${base}/image-bank/bulk-import`,
      label: "Import CSV en masse",
      icon: "📦",
      group: "image-bank",
      subGroup: "bibliotheque",
      parent: `${base}/image-bank`,
    },
    // ▸ ORGANISATION & QUALITÉ
    {
      href: `${base}/image-bank/categories`,
      label: "Catégories",
      icon: "🏷️",
      group: "image-bank",
      subGroup: "organisation",
      parent: `${base}/image-bank`,
    },
    {
      href: `${base}/image-bank/tags`,
      label: "Étiquettes",
      icon: "🔖",
      group: "image-bank",
      subGroup: "organisation",
      parent: `${base}/image-bank`,
    },
    {
      href: `${base}/image-bank/quality`,
      label: "File de qualité",
      icon: "🔍",
      group: "image-bank",
      subGroup: "organisation",
    },
    {
      href: `${base}/image-bank/analytics`,
      label: "Statistiques",
      icon: "📊",
      group: "image-bank",
      subGroup: "organisation",
      parent: `${base}/image-bank`,
    },
    // ▸ ADMINISTRATION
    {
      href: `${base}/image-bank/usage-logs`,
      label: "Journaux d'utilisation (RGPD)",
      icon: "🛡️",
      group: "image-bank",
      subGroup: "admin",
    },
    {
      href: `${base}/image-bank/settings`,
      label: "Réglages",
      icon: "⚙️",
      group: "image-bank",
      subGroup: "admin",
      parent: `${base}/image-bank`,
    },
    // ── salle de presse (communiqués + kit média de marque) ──────────────
    { href: `${base}/presse`, label: "Vue d'ensemble", icon: "📰", group: "presse" },
    { href: `${base}/presse/communiques`, label: "Communiqués", icon: "🗞️", group: "presse" },
    { href: `${base}/presse/kit-media`, label: "Kit média", icon: "🎨", group: "presse" },
    { href: `${base}/presse/couverture`, label: "Couverture médias", icon: "📡", group: "presse" },
    // ── chatbot (console conversationnelle) ──────────────────────────────
    { href: `${base}/chatbot`, label: "Tableau de bord", icon: "🤖", group: "chatbot" },
    { href: `${base}/chatbot/escalades`, label: "Escalades", icon: "🆘", group: "chatbot" },
    {
      href: `${base}/chatbot/conversations`,
      label: "Conversations",
      icon: "💬",
      group: "chatbot",
    },
    { href: `${base}/chatbot/prompt`, label: "Prompt versionné", icon: "📝", group: "chatbot" },
    { href: `${base}/chatbot/reglages`, label: "Réglages", icon: "⚙️", group: "chatbot" },
    // ── engagement ───────────────────────────────────────────────────────
    { href: `${base}/newsletter`, label: "Newsletter", icon: "📧", group: "engagement" },
    // ── ops & monitoring ─────────────────────────────────────────────────
    { href: `${base}/analytics`, label: "Statistiques & SEO", icon: "📊", group: "ops" },
    { href: `${base}/web-vitals`, label: "Web Vitals", icon: "📈", group: "ops" },
    { href: `${base}/site-explorer`, label: "Toutes les URLs", icon: "🗺️", group: "ops" },
    { href: `${base}/infra`, label: "Infra & outils", icon: "🔧", group: "ops" },
    { href: `${base}/infra/backups`, label: "Sauvegardes & DR", icon: "💾", group: "ops" },
    { href: `${base}/alerts`, label: "Alertes ops", icon: "🚨", group: "ops" },
    // ── système ──────────────────────────────────────────────────────────
    { href: `${base}/users`, label: "Utilisateurs", icon: "👥", group: "system" },
    { href: `${base}/activity-logs`, label: "Journaux d'activité", icon: "📜", group: "system" },
    { href: `${base}/settings`, label: "Paramètres", icon: "⚙️", group: "system" },
    { href: `${base}/2fa/setup`, label: "2FA — sécurité", icon: "🔐", group: "system" },
  ];
}

/**
 * Résout le href de nav « actif » pour un pathname donné, par matching de
 * PRÉFIXE (le plus spécifique gagne).
 *
 * Pourquoi pas un simple `it.href === pathname` : beaucoup de pages admin sont
 * des sous-routes SANS entrée de nav propre (éditeurs : `/presse/communiques/
 * nouveau`, `/presse/kit-media/upload`, `/presse/couverture/[id]`…). Avec un
 * match exact, ces routes ne résolvaient AUCUN item → la sidebar perdait le
 * groupe actif (« Salle de presse » se refermait / repassait sur « Activité
 * quotidienne »). En rattachant au parent le plus long (`/presse/communiques`),
 * le bon item est surligné et le bon groupe reste ouvert.
 *
 * Le « Tableau de bord » (href = racine admin `${base}`) matcherait TOUT en
 * préfixe ; la règle « le plus long gagne » garantit qu'il ne l'emporte que sur
 * la racine exacte, jamais sur une sous-page.
 *
 * Fonction pure (items + pathname → href|null) → testable sans rendu. SSOT
 * consommée par `<AdminSidebarNav>` (surlignage item + ouverture groupe).
 */
export function findActiveNavHref(
  items: ReadonlyArray<AdminNavItem>,
  pathname: string | null,
): string | null {
  if (!pathname) return null;
  let best: string | null = null;
  for (const it of items) {
    if (pathname === it.href || pathname.startsWith(`${it.href}/`)) {
      if (best === null || it.href.length > best.length) best = it.href;
    }
  }
  return best;
}
