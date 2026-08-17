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
// Icons (refonte visuelle console 2026-08 — chantier icônes) :
//   Le champ `icon` porte le NOM D'EXPORT lucide-react exact (ex. "Gauge"),
//   résolu en composant par `navIcon()` (src/lib/admin-nav-icons.ts). Il RESTE
//   un `string` — pas un composant — parce que le layout admin (Server
//   Component) passe `items` en prop au client `<AdminSidebarNav>` : une
//   référence de composant ne franchit pas la frontière de sérialisation RSC.
//   Le test structurel admin-nav-icons.test.ts garantit que chaque nom résout
//   dans le registre NAV_ICONS (aucun repli silencieux).

// Refonte « Boîte de réception » 2026-07-29 : le groupe `rendez-vous` est
// SUPPRIMÉ. Ses 3 items lisaient la même table `calendly_events` et le clic sur
// une ligne du premier renvoyait déjà au détail du troisième — ce n'était donc
// pas un pôle mais un écran unique éclaté. Il est fusionné dans l'unique entrée
// « Appels réservés » du groupe `contacts`, désormais organisé par CANAL
// D'ENTRÉE (appel / message / candidature / podcast) plutôt que par table.
export type AdminNavGroup =
  | "main"
  | "contacts"
  | "tunnels"
  | "content"
  | "content_gen"
  | "qualiopi"
  | "finances"
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
 * Pôle (sous-groupe niveau 1) du groupe `qualiopi` — refonte console PHASE 1,
 * 2026-08-01 (remplace la taxonomie 2026-07-08).
 *
 * 🔴 Pourquoi la refonte. Verdict de Will sur l'ancienne organisation :
 * « tout est très mal organisé, on s'y perd… le bazar complet ». Le diagnostic
 * partagé : les 5 pôles précédents rangeaient encore par NATURE de donnée
 * (Formations & séances / Commercial / Registres…), c'est-à-dire par table.
 * Un dossier client vivait dans 6 onglets sans lien, et rien ne disait par
 * quoi commencer.
 *
 * La taxonomie 2026-08-01 range par TRAVAIL, dans l'ordre de la journée :
 *   1. a_traiter      — « qu'est-ce que je dois faire maintenant ? » (page
 *                       dédiée + pastilles, cf. qualiopi-nav-counts.ts)
 *   2. dossiers       — les affaires en cours (clients, devis, sessions,
 *                       stagiaires, coaching, audits)
 *   3. catalogue      — ce qu'on vend (offres, formations, engine, barèmes)
 *   4. intervenants   — les humains qui animent (formateurs, sous-traitants)
 *   5. conformite     — TOUTES les preuves Qualiopi au même endroit
 *                       (indicateurs, registres, veille, revue, auditeur)
 *   6. reglages_suivi — setup, RGPD, alertes, corbeille e-mails
 *
 * NB : clés volontairement DISTINCTES des `ContentGenPole` (pas de collision
 * « reglages » → `reglages_suivi`) pour que l'état plié/déplié d'un pôle ne
 * fuite pas d'un groupe à l'autre (Set<string> partagé côté sidebar).
 */
export type QualiopiPole =
  "a_traiter" | "dossiers" | "catalogue" | "intervenants" | "conformite" | "reglages_suivi";

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
export type MainPole = "agenda";

/**
 * Pôle du groupe `image-bank` — refonte UX 2026-07-08. 3 blocs. Clés distinctes.
 */
export type ImageBankPole = "bibliotheque" | "organisation" | "admin";

export interface AdminNavItem {
  href: string;
  label: string;
  /**
   * Nom d'export `lucide-react` exact (ex. "Gauge"), résolu en composant par
   * `navIcon()` (src/lib/admin-nav-icons.ts). Format string (et pas
   * `LucideIcon`) : le layout serveur passe `items` en prop à un composant
   * client — un composant en prop casserait la sérialisation RSC.
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
  /**
   * Indentation forcée dans la sidebar, quand la profondeur d'URL ne reflète
   * pas la hiérarchie voulue. Par défaut `<AdminSidebarNav>` déduit le niveau
   * du nombre de segments (`itemLevel`) : `/contacts/messages` → 1,
   * `/contacts/messages/x` → 2. Les catégories de Messages vivent sur des
   * routes SŒURS (`/contacts/presse`, `/podcast`…) qui donneraient donc 1,
   * c'est-à-dire le même cran que « Messages » — visuellement des voisines,
   * pas des filles. Ce champ les repousse d'un cran sans déplacer les URLs
   * (⌘K, favoris et liens externes restent valides).
   */
  navLevel?: number;
}

export const ADMIN_NAV_GROUP_LABELS: Record<AdminNavGroup, string> = {
  main: "Activité quotidienne",
  contacts: "Boîte de réception",
  tunnels: "Tunnels",
  content: "Contenu",
  content_gen: "Génération de contenu",
  // Renommé le 2026-08-01 (question Will : « pourquoi l'activité audit IA est
  // dans Qualiopi ? ») : l'onglet contient TOUTE l'activité (formations,
  // coachings, audits, clients, devis) — « Qualiopi » n'est que la partie
  // conformité. Le nom de la certification prêtait un périmètre certifié à des
  // prestations de conseil qui n'en relèvent pas.
  qualiopi: "Formations & prestations",
  finances: "Finances",
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
 * Libellés FR des pôles `qualiopi` (refonte console phase 1, 2026-08-01).
 *
 * 🔴 Ces six libellés ont porté un emoji jusqu'au 2026-08-03 — une phase
 * antérieure du chantier les avait ajoutés sur un « n'hésite pas à mettre des
 * émojis », AVANT que Will ne tranche l'inverse le 2026-08-01 : la console
 * passe aux icônes `lucide-react`, jamais à l'emoji. Le commentaire justifiant
 * les emojis a survécu à la décision qui les annulait.
 *
 * Ils ont tenu deux jours de plus parce que le cliquet anti-emoji ne scanne
 * que `src/app/[locale]/(admin)` et `src/components/admin` : un libellé qui
 * vit dans `src/lib` s'affiche sur TOUTES les pages de la console sans qu'un
 * seul test le voie. Le cliquet couvre désormais ce fichier nommément.
 *
 * Un module de `lib` ne porte pas de pictogramme (même raison qu'il y a pour
 * `activity-labels.ts`) : l'icône du pôle est décidée dans le composant, par
 * `POLE_ICON_MAP` (`AdminSidebarNav.tsx`).
 */
export const QUALIOPI_POLE_LABELS: Record<QualiopiPole, string> = {
  a_traiter: "À traiter",
  dossiers: "Dossiers & clients",
  catalogue: "Catalogue & vente",
  intervenants: "Intervenants",
  conformite: "Conformité Qualiopi",
  reglages_suivi: "Réglages & suivi",
};

/**
 * Ordre d'affichage des pôles `qualiopi` : l'ordre de la JOURNÉE — ce que je
 * dois faire, puis mes affaires, puis le référentiel, puis le reste.
 */
export const QUALIOPI_POLE_ORDER: ReadonlyArray<QualiopiPole> = [
  "a_traiter",
  "dossiers",
  "catalogue",
  "intervenants",
  "conformite",
  "reglages_suivi",
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
  // Pôle « facturation » supprimé le 2026-08-01 (phase 2) : ses 4 items booking
  // morts ont été retirés de la nav (routes → redirect 308 vers Qualiopi).
  agenda: "Vue d'ensemble",
};

export const MAIN_POLE_ORDER: ReadonlyArray<MainPole> = ["agenda"];

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
  "tunnels",
  "content",
  "content_gen",
  "qualiopi",
  "finances",
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
    {
      href: `${base}`,
      label: "Tableau de bord",
      icon: "LayoutDashboard",
      group: "main",
      subGroup: "agenda",
    },
    // Planning unifié des prestations (formations collectives + coaching 1-to-1).
    // Distinct du « Calendrier » booking ci-dessous, qui est un vestige masqué.
    // Le hub d'abord : c'est la page qui dit ce qui ne va pas. Les autres vues
    // du cockpit répondent à une question qu'on est venu poser ; celle-ci répond
    // à une question qu'on n'a pas encore pensé à se poser.
    {
      href: `${base}/planning/hub`,
      label: "Hub de pilotage",
      icon: "Radar",
      group: "main",
      subGroup: "agenda",
    },
    {
      href: `${base}/planning`,
      label: "Planning",
      icon: "CalendarDays",
      group: "main",
      subGroup: "agenda",
    },
    {
      href: `${base}/planning/timeline`,
      label: "Timeline ressources",
      icon: "ChartGantt",
      group: "main",
      subGroup: "agenda",
    },
    {
      href: `${base}/planning/charge`,
      label: "Charge formateurs",
      icon: "ChartColumnBig",
      group: "main",
      subGroup: "agenda",
    },
    {
      href: `${base}/planning/pipeline`,
      label: "Pipeline commercial",
      icon: "Funnel",
      group: "main",
      subGroup: "agenda",
    },
    {
      href: `${base}/planning/previsionnel`,
      label: "Prévisionnel",
      icon: "TrendingUp",
      group: "main",
      subGroup: "agenda",
    },
    // Les 7 items Booking (Calendrier/Réservations/Options 48h + Devis/
    // Factures/Paiements/Échéanciers) ont été RETIRÉS le 2026-08-01 (audit UX,
    // phase 2) : même masqués par `parent`, ils restaient dans la palette ⌘K
    // sous les mêmes noms que les vrais modules Qualiopi/Finances. Les routes
    // redirigent désormais en 308 vers les équivalents réels (planning,
    // pipeline, devis Qualiopi, hub facturation, plans récurrents).
    // ── Boîte de réception — TOUT ce qui entre du monde extérieur ──────────
    //
    //    Refonte 2026-07-29. Avant : 11 entrées de sidebar (8 « Contacts » +
    //    3 « Rendez-vous ») pour 4 objets réels, parce que la nav épousait le
    //    schéma de base plutôt que le travail. Cinq de ces entrées étaient la
    //    MÊME table `Submission` avec un filtre figé ; trois autres étaient la
    //    MÊME table `calendly_events` affichée de trois façons.
    //
    //    Après : 5 entrées, une par CANAL D'ENTRÉE réel.
    //      Tout            → vue unifiée des 4 sources (rien ne se perd)
    //      Appels réservés → calendly_events (liste + calendrier en onglet)
    //      Messages        → Submission (le tri fin passe par le filtre « Catégorie »)
    //      Candidatures    → JobApplication (CV, workflow RH : vrai objet distinct)
    //      Podcast         → PodcastRequest (vrai objet distinct)
    //
    //    Les vues filtrées de Submission ne disparaissent pas : elles gardent
    //    leur route et restent joignables par la command palette (⌘K) et les
    //    favoris — elles portent `parent`, ce qui les retire de la sidebar sans
    //    rien casser. Réversible : retirer `parent`.
    {
      href: `${base}/contacts`,
      label: "Tout",
      icon: "Inbox",
      group: "contacts",
    },
    {
      href: `${base}/contacts/appels`,
      label: "Appels réservés",
      icon: "PhoneCall",
      group: "contacts",
    },
    // « Messages » = TOUTES les soumissions. Ses 8 catégories sont rendues
    // juste en dessous, indentées d'un cran (`navLevel: 2`) — demande Will
    // 2026-08-14 : « les sous-onglets dans la sidebar, pas dans la page ».
    // Elles remplacent la rangée d'onglets qui vivait dans l'écran.
    {
      href: `${base}/contacts/messages`,
      label: "Messages",
      icon: "Mail",
      group: "contacts",
    },
    // ▸ Catégories de « Messages » (niveau 3 visuel). Ces routes existaient
    //   déjà, masquées de la sidebar depuis le 2026-07-29 ; elles y reviennent
    //   sous leur parent au lieu d'être un filtre interne à la page. Libellés
    //   sans le préfixe « Messages · » : l'indentation le dit déjà.
    {
      href: `${base}/contacts/clients`,
      label: "Clients",
      icon: "Briefcase",
      group: "contacts",
      navLevel: 2,
    },
    {
      href: `${base}/contacts/presse`,
      label: "Presse",
      icon: "Newspaper",
      group: "contacts",
      navLevel: 2,
    },
    {
      href: `${base}/contacts/partenariats`,
      label: "Partenariats",
      icon: "Handshake",
      group: "contacts",
      navLevel: 2,
    },
    {
      href: `${base}/contacts/investisseurs`,
      label: "Investisseurs",
      icon: "TrendingUp",
      group: "contacts",
      navLevel: 2,
    },
    {
      href: `${base}/contacts/conferences`,
      label: "Conférences",
      icon: "Presentation",
      group: "contacts",
      navLevel: 2,
    },
    {
      href: `${base}/contacts/commercial`,
      label: "Recrutement",
      icon: "UserSearch",
      group: "contacts",
      navLevel: 2,
    },
    // Demandes de tournage podcast (2026-07-21) — lead entrant de la page
    // publique /podcast + du QR du flyer papier. Route hors `/contacts/*` (le
    // layout Contacts impose son propre AdminPageShell), d'où le `navLevel`
    // explicite : l'URL ne dit pas qu'elle est une catégorie de Messages.
    {
      href: `${base}/podcast`,
      label: "Podcast",
      icon: "Mic",
      group: "contacts",
      navLevel: 2,
    },
    {
      href: `${base}/contacts/autres`,
      label: "Autres",
      icon: "MessagesSquare",
      group: "contacts",
      navLevel: 2,
    },
    // Candidatures aux offres publiées (JobApplication : CV/photo, workflow RH).
    {
      href: `${base}/contacts/candidatures`,
      label: "Candidatures",
      icon: "UserPlus",
      group: "contacts",
    },
    // ── Tunnels d'acquisition (2026-08-12) ────────────────────────────
    // Groupe distinct de « Boîte de réception » à dessein : celle-ci montre
    // les gens qui ONT écrit, celui-ci montre ceux qu'on a PERDUS en route.
    // C'est la seule lecture qui dise quoi corriger sur les pages.
    {
      href: `${base}/tunnels`,
      label: "Vue d'ensemble",
      icon: "Funnel",
      group: "tunnels",
    },
    {
      href: `${base}/tunnels/prospects`,
      label: "Tunnel de prospects",
      icon: "UserSearch",
      group: "tunnels",
    },
    {
      href: `${base}/tunnels/vente`,
      label: "Tunnel de vente",
      icon: "Coins",
      group: "tunnels",
    },
    // ── contenu ──────────────────────────────────────────────────────────
    {
      href: `${base}/connaissances`,
      label: "Connaissances",
      icon: "BookOpenText",
      group: "content",
    },
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
      icon: "CirclePlus",
      group: "content_gen",
      subGroup: "lancer",
      tier: "simple",
    },
    {
      href: `${base}/content-gen/coverage/presets`,
      label: "Campagnes pré-réglées",
      icon: "WandSparkles",
      group: "content_gen",
      subGroup: "lancer",
      tier: "simple",
    },
    {
      href: `${base}/content-gen/orchestrator/adhoc`,
      label: "Générer une seule page",
      icon: "Zap",
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
      icon: "Rss",
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
      icon: "Rocket",
      group: "content_gen",
      subGroup: "lancer",
      tier: "simple",
      parent: `${base}/content-gen`,
    },
    // ▾ SUIVRE (quotidien)
    {
      href: `${base}/content-gen`,
      label: "Tableau de bord",
      icon: "LayoutDashboard",
      group: "content_gen",
      subGroup: "suivre",
      tier: "simple",
    },
    {
      href: `${base}/content-gen/coverage`,
      label: "Campagnes",
      icon: "FolderKanban",
      group: "content_gen",
      subGroup: "suivre",
      tier: "simple",
    },
    {
      href: `${base}/content-gen/jobs`,
      label: "Générations en cours",
      icon: "Workflow",
      group: "content_gen",
      subGroup: "suivre",
      tier: "simple",
    },
    {
      href: `${base}/content-gen/observatoire`,
      label: "Observatoire IA 2026",
      icon: "Telescope",
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
      icon: "CircleCheck",
      group: "content_gen",
      subGroup: "publier",
      tier: "simple",
    },
    {
      href: `${base}/content-gen/publications`,
      label: "Contenus publiés",
      icon: "Send",
      group: "content_gen",
      subGroup: "publier",
      tier: "simple",
    },
    {
      href: `${base}/content-gen/publications-status`,
      label: "Suivi des publications (kanban)",
      icon: "SquareKanban",
      group: "content_gen",
      subGroup: "publier",
      tier: "advanced",
    },
    {
      href: `${base}/content-gen/hero-images`,
      label: "Photos hero Unsplash",
      icon: "Image",
      group: "content_gen",
      subGroup: "publier",
      tier: "simple",
    },
    {
      href: `${base}/content-gen/citations-backfill`,
      label: "Backfill citations (Sources)",
      icon: "Quote",
      group: "content_gen",
      subGroup: "publier",
      tier: "advanced",
    },
    // ▸ VILLES (occasionnel)
    // Refonte phase 2 (2026-08-01, audit UX) : 7 entrées → 3 visibles. Quatre
    // pages répondaient à « où en est la production par ville ? » sur le même
    // groupBy de ContentGenJob (axes différents) ; elles restent accessibles
    // via le bandeau d'onglets de « Couverture des villes » (VillesTabsNav)
    // et par ⌘K (masquées par `parent`, motif boîte de réception).
    {
      href: `${base}/content-gen/coverage-map`,
      label: "Couverture des villes",
      icon: "Map",
      group: "content_gen",
      subGroup: "villes",
      tier: "simple",
    },
    {
      href: `${base}/content-gen/cities-order`,
      label: "File de génération (prochaine vague)",
      icon: "ListOrdered",
      group: "content_gen",
      subGroup: "villes",
      tier: "simple",
    },
    {
      // Quasi-homonyme de cities-coverage (pluriel) : mesure l'ENTRÉE (la
      // matière première vérifiable des 39 villes pilote), pas la production.
      href: `${base}/content-gen/city-coverage`,
      label: "Matière première villes (39 pilotes)",
      icon: "Ruler",
      group: "content_gen",
      subGroup: "villes",
      tier: "advanced",
    },
    {
      href: `${base}/content-gen/cities-coverage`,
      label: "Couverture — par palier de population",
      icon: "Building2",
      group: "content_gen",
      subGroup: "villes",
      tier: "simple",
      parent: `${base}/content-gen/coverage-map`,
    },
    {
      href: `${base}/content-gen/city-equity`,
      label: "Couverture — par type de contenu",
      icon: "Scale",
      group: "content_gen",
      subGroup: "villes",
      tier: "advanced",
      parent: `${base}/content-gen/coverage-map`,
    },
    {
      href: `${base}/content-gen/geo`,
      label: "Couverture — production par région",
      icon: "Globe",
      group: "content_gen",
      subGroup: "villes",
      tier: "advanced",
      parent: `${base}/content-gen/coverage-map`,
    },
    {
      href: `${base}/content-gen/geo/coverage-table`,
      label: "Couverture — croisé ville × secteur",
      icon: "Table",
      group: "content_gen",
      subGroup: "villes",
      tier: "advanced",
      parent: `${base}/content-gen/coverage-map`,
    },
    // ▾ QUALITÉ & COÛTS (occasionnel — pôle entièrement avancé)
    {
      href: `${base}/content-gen/quality`,
      label: "Qualité du contenu",
      icon: "ChartLine",
      group: "content_gen",
      subGroup: "qualite",
      tier: "advanced",
    },
    {
      href: `${base}/content-gen/costs`,
      label: "Coûts",
      icon: "Coins",
      group: "content_gen",
      subGroup: "qualite",
      tier: "advanced",
    },
    {
      href: `${base}/content-gen/similarity-monitor`,
      label: "Détection de doublons",
      icon: "Copy",
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
      icon: "AudioLines",
      group: "content_gen",
      subGroup: "qualite",
      tier: "advanced",
    },
    {
      href: `${base}/content-gen/embeddings`,
      label: "Suivi des vecteurs de similarité",
      icon: "Network",
      group: "content_gen",
      subGroup: "qualite",
      tier: "advanced",
    },
    {
      href: `${base}/content-gen/external-links`,
      label: "Liens externes",
      icon: "ExternalLink",
      group: "content_gen",
      subGroup: "qualite",
      tier: "advanced",
    },
    // « Base de connaissances (consultation) » retirée le 2026-08-01 (audit UX,
    // phase 2) : doublon de « Connaissances » (Contenu) — la route redirige en
    // 308 vers /connaissances?status=published.
    // ▾ RÉGLAGES (rare / setup — pôle entièrement avancé)
    {
      href: `${base}/content-gen/settings`,
      label: "Réglages génération",
      icon: "Settings2",
      group: "content_gen",
      subGroup: "reglages",
      tier: "advanced",
    },
    {
      href: `${base}/content-gen/rss`,
      label: "Sources RSS (actualités)",
      icon: "Antenna",
      group: "content_gen",
      subGroup: "reglages",
      tier: "advanced",
    },
    {
      href: `${base}/content-gen/templates`,
      label: "Instructions IA (prompts)",
      icon: "ClipboardList",
      group: "content_gen",
      subGroup: "reglages",
      tier: "advanced",
    },
    {
      href: `${base}/content-gen/keyword-tracking`,
      label: "Suivi des positions",
      icon: "Target",
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
      icon: "FlaskConical",
      group: "content_gen",
      subGroup: "reglages",
      tier: "advanced",
    },
    {
      href: `${base}/content-gen/author/manon`,
      label: "Profil de l'auteur (Manon)",
      icon: "UserPen",
      group: "content_gen",
      subGroup: "reglages",
      tier: "advanced",
    },
    { href: `${base}/blog`, label: "Blog", icon: "PenLine", group: "content" },
    { href: `${base}/categories`, label: "Catégories", icon: "Tag", group: "content" },
    { href: `${base}/case-studies`, label: "Cas concrets", icon: "Trophy", group: "content" },
    { href: `${base}/avis`, label: "Avis clients", icon: "Star", group: "content" },
    {
      href: `${base}/offres-emploi`,
      label: "Offres d'emploi",
      icon: "Briefcase",
      group: "content",
    },
    { href: `${base}/faq`, label: "FAQ", icon: "HelpCircle", group: "content" },
    { href: `${base}/help`, label: "Centre d'aide", icon: "LifeBuoy", group: "content" },
    // ── Formation / Qualiopi (back-office OF) ──────────────────────────────
    //   Réorganisé en 5 pôles (refonte UX 2026-07-08) : les ~24 onglets étaient
    //   en liste plate = écrasant. `subGroup` pilote l'accordéon par pôle
    //   (cf. QUALIOPI_POLE_ORDER + `<AdminSidebarNav>`). L'ordre des items suit
    //   l'ordre d'affichage voulu DANS chaque pôle (rendu = ordre source).
    //
    // ▸ 🔴 À TRAITER — la porte d'entrée de la console (refonte phase 1).
    // Une seule page qui répond à « par quoi je commence ? » : signatures
    // reçues, e-mails à valider, relances dues, alertes du matin. La pastille
    // vient de `compterQualiopiNav()` (SSOT partagé avec la page elle-même).
    {
      href: `${base}/qualiopi/a-traiter`,
      label: "À traiter",
      icon: "CircleAlert",
      group: "qualiopi",
      subGroup: "a_traiter",
    },
    // ▸ 📁 DOSSIERS & CLIENTS (les affaires en cours)
    // Vue pipeline (refonte phase 2) : une ligne par affaire, statut DÉRIVÉ
    // (cf. src/server/admin/dossiers-pipeline.ts) — répond à « où en est
    // chaque affaire ? » sans ouvrir six onglets.
    {
      href: `${base}/qualiopi/dossiers`,
      label: "Dossiers (pipeline)",
      icon: "Folders",
      group: "qualiopi",
      subGroup: "dossiers",
    },
    // « Vue d'ensemble » (/qualiopi) retirée le 2026-08-01 (audit UX, P0 n°3,
    // phase 2) : doublon direct du pipeline — la route redirige en 308.
    //
    // ▸ Wizard « Nouvelle vente » (phase 0, plan 2026-08-05) — parcours guidé
    // client → formation → devis → session → checklist. EN TÊTE du pôle
    // Catalogue & vente (l'ordre source = l'ordre de rendu) : c'est la porte
    // d'entrée commerciale, le reste du pôle est du référentiel.
    {
      href: `${base}/qualiopi/vente/new`,
      label: "Nouvelle vente",
      icon: "ShoppingCart",
      group: "qualiopi",
      subGroup: "catalogue",
    },
    {
      href: `${base}/qualiopi/formations`,
      label: "Formations",
      icon: "BookOpen",
      group: "qualiopi",
      subGroup: "catalogue",
    },
    {
      href: `${base}/qualiopi/formation-engine`,
      label: "Formation Engine",
      icon: "Cpu",
      group: "qualiopi",
      subGroup: "catalogue",
    },
    {
      href: `${base}/qualiopi/formation-engine/validations`,
      label: "Validations IA",
      icon: "BadgeCheck",
      group: "qualiopi",
      subGroup: "catalogue",
    },
    {
      href: `${base}/qualiopi/sessions`,
      label: "Sessions",
      icon: "CalendarRange",
      group: "qualiopi",
      subGroup: "dossiers",
    },
    {
      href: `${base}/qualiopi/formateurs`,
      label: "Formateurs",
      icon: "Presentation",
      group: "qualiopi",
      subGroup: "intervenants",
    },
    // 🔴 Déplacé depuis « Coaching 1-to-1 » le 2026-07-28.
    //
    // Cet écran gère l'accès de TOUS les formateurs, sans distinction : il
    // liste `listFormateurs()` en entier. Il était pourtant rangé sous
    // « Coaching 1-to-1 », héritage de l'époque où l'espace formateur ne
    // servait qu'aux séances individuelles. Conséquence : pour envoyer un lien
    // de connexion à quelqu'un qui n'anime que des formations collectives, il
    // fallait aller le chercher dans le menu du 1-to-1 — personne ne l'y
    // trouvait. Sa place est ici, à côté de la fiche formateur.
    {
      href: `${base}/coaching/formateurs`,
      label: "Accès & connexions formateurs",
      icon: "LogIn",
      group: "qualiopi",
      subGroup: "intervenants",
    },
    {
      href: `${base}/qualiopi/remuneration`,
      label: "Rémunération formateurs",
      icon: "Banknote",
      group: "qualiopi",
      subGroup: "intervenants",
    },
    // Cockpit financier (Lot 6.3) — marge par session/formation, heures & coût par
    // formateur, consolidation mensuelle (lecture au-dessus des lignes de rémunération).
    {
      href: `${base}/qualiopi/cockpit-financier`,
      label: "Cockpit financier",
      icon: "ChartNoAxesCombined",
      group: "finances",
    },
    {
      href: `${base}/qualiopi/audits`,
      label: "Audits IA",
      icon: "FileSearch",
      group: "qualiopi",
      subGroup: "dossiers",
    },
    {
      href: `${base}/qualiopi/stagiaires`,
      label: "Stagiaires",
      icon: "BookUser",
      group: "qualiopi",
      subGroup: "dossiers",
    },
    // (Refonte 2026-08-01 : le rangement par pôle vit dans subGroup — l'ordre
    {
      href: `${base}/qualiopi/offres`,
      label: "Offres",
      icon: "BadgePercent",
      group: "qualiopi",
      subGroup: "catalogue",
    },
    // Lot 3 (pont appel/contact → CRM) : appels Calendly + messages contact
    // fusionnés, conversion 1 clic en client CRM puis devis pré-rempli.
    {
      href: `${base}/qualiopi/entrees`,
      label: "Entrées récentes",
      icon: "Inbox",
      group: "qualiopi",
      subGroup: "dossiers",
    },
    {
      href: `${base}/qualiopi/clients`,
      label: "Clients (CRM)",
      icon: "Building2",
      group: "qualiopi",
      subGroup: "dossiers",
    },
    {
      href: `${base}/qualiopi/devis`,
      label: "Devis",
      icon: "FileText",
      group: "qualiopi",
      subGroup: "dossiers",
    },
    // Hub facturation unifié 5 activités (page gatée par FACTURATION_HUB_ENABLED).
    {
      href: `${base}/qualiopi/facturation`,
      label: "Facturation (Hub)",
      icon: "Receipt",
      group: "finances",
    },
    {
      href: `${base}/qualiopi/facturation/new`,
      label: "Facture directe",
      icon: "FilePlus",
      group: "finances",
    },
    {
      href: `${base}/qualiopi/facturation/plans`,
      label: "Plans récurrents",
      icon: "Repeat",
      group: "finances",
    },
    // Rapprochement bancaire v1 (import de l'export CSV Finom, suggestions
    // contre les factures ouvertes, sans persistance du relevé). Même gate
    // FACTURATION_HUB_ENABLED que le Hub — c'est la PAGE qui gate.
    {
      href: `${base}/qualiopi/facturation/rapprochement`,
      label: "Rapprochement bancaire",
      icon: "Landmark",
      group: "finances",
    },
    {
      // Renommé (2026-07-14) : la facturation est pilotée par « Facturation (Hub) ».
      // Cet écran conserve sa valeur propre = alertes de financement au niveau
      // session (OPCO sans accord, CPF sans vérif EDOF) + export compta CSV legacy.
      href: `${base}/qualiopi/financements`,
      label: "Alertes financement (sessions)",
      icon: "Siren",
      group: "finances",
    },
    // Référentiel OPCO centralisé et versionné (Lot 5) — plafonds de prise en charge.
    {
      href: `${base}/qualiopi/baremes-opco`,
      label: "Barèmes OPCO",
      icon: "Calculator",
      group: "qualiopi",
      subGroup: "catalogue",
    },
    // du fichier ne préjuge plus du pôle. Repères historiques supprimés.)
    // « Conformité » (/qualiopi/conformite) fusionnée le 2026-08-01 (phase 2)
    // dans « Conformité & mode auditeur » ci-dessous — même matrice de 32
    // indicateurs sous deux entrées. La route redirige en 308.
    {
      href: `${base}/qualiopi/indicateurs`,
      label: "Indicateurs / BPF",
      icon: "BarChart3",
      group: "qualiopi",
      subGroup: "conformite",
    },
    {
      href: `${base}/qualiopi/pilotage`,
      label: "Pilotage",
      icon: "Compass",
      group: "qualiopi",
      subGroup: "conformite",
    },
    {
      href: `${base}/qualiopi/appreciations`,
      label: "Appréciations",
      icon: "Star",
      group: "qualiopi",
      subGroup: "conformite",
    },
    {
      href: `${base}/qualiopi/reclamations`,
      label: "Réclamations",
      icon: "MailWarning",
      group: "qualiopi",
      subGroup: "conformite",
    },
    {
      // Fusion phase 2 (2026-08-01) : porte aussi l'ancienne « Conformité »
      // (vue tableau par défaut) — d'où le label composite.
      href: `${base}/qualiopi/mode-auditeur`,
      label: "Conformité & mode auditeur",
      icon: "ShieldCheck",
      group: "qualiopi",
      subGroup: "conformite",
    },
    // ▸ REGISTRES & VEILLE (obligations périodiques)
    {
      href: `${base}/qualiopi/veille`,
      label: "Veille",
      icon: "Eye",
      group: "qualiopi",
      subGroup: "conformite",
    },
    {
      href: `${base}/qualiopi/partenariats`,
      label: "Partenariats",
      icon: "Handshake",
      group: "qualiopi",
      subGroup: "conformite",
    },
    {
      href: `${base}/qualiopi/sous-traitants`,
      label: "Sous-traitants",
      icon: "Factory",
      group: "qualiopi",
      subGroup: "intervenants",
    },
    {
      href: `${base}/qualiopi/moyens`,
      label: "Moyens pédagogiques",
      icon: "Projector",
      group: "qualiopi",
      subGroup: "conformite",
    },
    {
      href: `${base}/qualiopi/incidents`,
      label: "Incidents",
      icon: "AlertTriangle",
      group: "qualiopi",
      subGroup: "conformite",
    },
    {
      href: `${base}/qualiopi/revue-direction`,
      label: "Revue de direction",
      icon: "ClipboardCheck",
      group: "qualiopi",
      subGroup: "conformite",
    },
    // ▸ ADMINISTRATION (setup / RGPD — rare)
    {
      href: `${base}/qualiopi/config`,
      label: "Configuration",
      icon: "Settings",
      group: "qualiopi",
      subGroup: "reglages_suivi",
    },
    {
      href: `${base}/qualiopi/rgpd`,
      label: "Demandes RGPD",
      icon: "Lock",
      group: "qualiopi",
      subGroup: "reglages_suivi",
    },
    {
      href: `${base}/qualiopi/alertes`,
      label: "Alertes",
      icon: "Bell",
      group: "qualiopi",
      subGroup: "reglages_suivi",
    },
    // F60 — corbeille de validation : les emails commerciaux attendent une
    // relecture avant de partir. Placée près des Alertes : ce sont les deux
    // écrans qu'on ouvre en début de journée.
    {
      href: `${base}/qualiopi/emails`,
      label: "E-mails à valider",
      icon: "MailCheck",
      group: "qualiopi",
      subGroup: "reglages_suivi",
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
      icon: "BookOpen",
      group: "documents-interventions",
      subGroup: "activite",
    },
    {
      href: `${base}/documents-interventions/un-a-un`,
      label: "1-to-1",
      icon: "User",
      group: "documents-interventions",
      subGroup: "activite",
    },
    {
      href: `${base}/documents-interventions/audit`,
      label: "Audit",
      icon: "FileSearch",
      group: "documents-interventions",
      subGroup: "activite",
    },
    {
      href: `${base}/documents-interventions/implementations`,
      label: "Implémentations",
      icon: "Hammer",
      group: "documents-interventions",
      subGroup: "activite",
    },
    {
      href: `${base}/documents-interventions/sites-web`,
      label: "Sites web",
      icon: "Globe",
      group: "documents-interventions",
      subGroup: "activite",
    },
    {
      href: `${base}/documents-interventions/autres`,
      label: "Autres",
      icon: "Paperclip",
      group: "documents-interventions",
      subGroup: "activite",
    },
    // ▸ OUTILS (utilitaires transverses)
    {
      href: `${base}/documents-interventions/destinataires`,
      label: "Annuaire équipe",
      icon: "Contact",
      group: "documents-interventions",
      subGroup: "outils",
    },
    {
      href: `${base}/documents-interventions/import`,
      label: "Importer un kit",
      icon: "Package",
      group: "documents-interventions",
      subGroup: "outils",
    },
    // ── Coaching 1-to-1 (séances de conseil remplies par les formateurs) ──
    {
      href: `${base}/coaching`,
      label: "Tableau de bord",
      icon: "LayoutDashboard",
      group: "coaching-1to1",
    },
    {
      href: `${base}/coaching/seances`,
      label: "Séances 1-to-1",
      icon: "CalendarCheck",
      group: "coaching-1to1",
    },
    // ── banque d'images — 3 pôles (refonte UX 2026-07-08) ─────────────────
    // ▸ BIBLIOTHÈQUE
    {
      href: `${base}/image-bank`,
      label: "Vue d'ensemble",
      icon: "Images",
      group: "image-bank",
      subGroup: "bibliotheque",
    },
    {
      href: `${base}/image-bank/library`,
      label: "Bibliothèque",
      icon: "FolderOpen",
      group: "image-bank",
      subGroup: "bibliotheque",
    },
    {
      href: `${base}/image-bank/upload`,
      label: "Téléverser",
      icon: "Upload",
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
      icon: "PackagePlus",
      group: "image-bank",
      subGroup: "bibliotheque",
      parent: `${base}/image-bank`,
    },
    // ▸ ORGANISATION & QUALITÉ
    {
      href: `${base}/image-bank/categories`,
      label: "Catégories",
      icon: "Tag",
      group: "image-bank",
      subGroup: "organisation",
      parent: `${base}/image-bank`,
    },
    {
      href: `${base}/image-bank/tags`,
      label: "Étiquettes",
      icon: "Tags",
      group: "image-bank",
      subGroup: "organisation",
      parent: `${base}/image-bank`,
    },
    {
      href: `${base}/image-bank/quality`,
      label: "File de qualité",
      icon: "ScanSearch",
      group: "image-bank",
      subGroup: "organisation",
    },
    {
      href: `${base}/image-bank/analytics`,
      label: "Statistiques",
      icon: "BarChart3",
      group: "image-bank",
      subGroup: "organisation",
      parent: `${base}/image-bank`,
    },
    // ▸ ADMINISTRATION
    {
      href: `${base}/image-bank/usage-logs`,
      label: "Journaux d'utilisation (RGPD)",
      icon: "Shield",
      group: "image-bank",
      subGroup: "admin",
    },
    {
      href: `${base}/image-bank/settings`,
      label: "Réglages",
      icon: "Settings",
      group: "image-bank",
      subGroup: "admin",
      parent: `${base}/image-bank`,
    },
    // ── salle de presse (communiqués + kit média de marque) ──────────────
    { href: `${base}/presse`, label: "Vue d'ensemble", icon: "Newspaper", group: "presse" },
    { href: `${base}/presse/communiques`, label: "Communiqués", icon: "FileText", group: "presse" },
    { href: `${base}/presse/kit-media`, label: "Kit média", icon: "Palette", group: "presse" },
    {
      href: `${base}/presse/couverture`,
      label: "Couverture médias",
      icon: "RadioTower",
      group: "presse",
    },
    // ── chatbot (console conversationnelle) ──────────────────────────────
    {
      href: `${base}/chatbot`,
      label: "Tableau de bord",
      icon: "LayoutDashboard",
      group: "chatbot",
    },
    {
      href: `${base}/chatbot/escalades`,
      label: "Escalades",
      icon: "OctagonAlert",
      group: "chatbot",
    },
    {
      href: `${base}/chatbot/conversations`,
      label: "Conversations",
      icon: "MessagesSquare",
      group: "chatbot",
    },
    {
      href: `${base}/chatbot/prompt`,
      label: "Prompt versionné",
      icon: "FileCode",
      group: "chatbot",
    },
    { href: `${base}/chatbot/reglages`, label: "Réglages", icon: "Settings", group: "chatbot" },
    // ── engagement ───────────────────────────────────────────────────────
    { href: `${base}/newsletter`, label: "Newsletter", icon: "Mail", group: "engagement" },
    // ── ops & monitoring ─────────────────────────────────────────────────
    { href: `${base}/analytics`, label: "Statistiques & SEO", icon: "BarChart3", group: "ops" },
    { href: `${base}/web-vitals`, label: "Web Vitals", icon: "Activity", group: "ops" },
    // Journal des e-mails reellement partis (2026-08-13). La table existait
    // depuis le debut, indexee pour etre lue — et n'etait affichee nulle part.
    // A ne pas confondre avec « E-mails a valider » (Qualiopi), qui est une
    // corbeille d'approbation et ne montre que 5 gabarits sur 66.
    {
      href: `${base}/emails-envoyes`,
      label: "E-mails envoyés",
      icon: "MailCheck",
      group: "ops",
    },
    // ⚠️ Le lien vers le tableau de bord ZeptoMail (demande Will, 2026-08-16)
    // n'est VOLONTAIREMENT pas ici : `admin-nav.test.ts` verrouille l'invariant
    // « tout href de la navigation est une route interne préfixée
    // /<locale>/<adminPrefix> ». Un lien sortant le casse — et cet invariant
    // n'est pas décoratif : le rendu de la nav construit des `<Link>` Next et
    // la mise en surbrillance de l'entrée active compare des chemins.
    // Le lien vit donc SUR la page « E-mails envoyés », à côté du journal
    // qu'il complète. C'est aussi sa place logique : notre journal dit ce que
    // l'application a TENTÉ, ZeptoMail ce que le relais a réellement REMIS —
    // l'écart entre les deux est l'information, et elle se lit côte à côte.
    { href: `${base}/site-explorer`, label: "Toutes les URLs", icon: "Map", group: "ops" },
    { href: `${base}/infra`, label: "Infra & outils", icon: "Wrench", group: "ops" },
    {
      href: `${base}/infra/backups`,
      label: "Sauvegardes & DR",
      icon: "DatabaseBackup",
      group: "ops",
    },
    { href: `${base}/alerts`, label: "Alertes ops", icon: "AlertTriangle", group: "ops" },
    // Santé de la synchronisation vers Axion CRM Pro (lot L5, 2026-08-14) :
    // dernier succès, file d'attente, abandons définitifs, écart de
    // réconciliation, lignes en erreur avec rejeu. Rangée en « ops » et non en
    // « contacts » : c'est un tableau d'exploitation, pas un écran métier.
    {
      href: `${base}/synchro-crm`,
      label: "Synchro CRM",
      icon: "RefreshCw",
      group: "ops",
    },
    { href: `${base}/qr-codes`, label: "QR codes & liens", icon: "QrCode", group: "ops" },
    // ▸ Sous-onglets du catalogue imprimé (niveau 2). Demande Will 2026-08-15 :
    //   « il faut que ce soit dans le sidebar et pas dans le header de la page ».
    //   Chacun pointe une VRAIE route enfant plutôt qu'un `?category=` : le
    //   surlignage compare `usePathname()`, qui ne porte jamais la query string
    //   — trois entrées en query n'auraient jamais été surlignées.
    {
      href: `${base}/qr-codes/catalogue`,
      label: "QR du catalogue",
      icon: "BookOpen",
      group: "ops",
      navLevel: 2,
    },
    {
      href: `${base}/qr-codes/avis`,
      label: "QR avis du catalogue",
      icon: "Quote",
      group: "ops",
      navLevel: 2,
    },
    {
      href: `${base}/qr-codes/pages`,
      label: "QR dans le catalogue",
      // pas "QrCode" : le parent « QR codes & liens » la porte déjà, et deux
      // entrées du même groupe avec la même icône sont indistinguables dans la
      // sidebar (garde-fou admin-nav-icons.test.ts).
      icon: "Tags",
      group: "ops",
      navLevel: 2,
    },
    // Relecture du catalogue papier avant tirage KDP (2026-08-16). Niveau 1 :
    // ce n'est pas un sous-onglet des QR, c'est le livre lui-même — les QR n'en
    // sont qu'un composant imprimé. Icône "BookOpenText" et non "BookOpen", que
    // « QR du catalogue » porte déjà dans ce même groupe.
    {
      href: `${base}/catalogue-imprime`,
      label: "Catalogue imprimé",
      icon: "BookOpenText",
      group: "ops",
    },
    // ── système ──────────────────────────────────────────────────────────
    { href: `${base}/users`, label: "Utilisateurs", icon: "Users", group: "system" },
    {
      href: `${base}/activity-logs`,
      label: "Journaux d'activité",
      icon: "ScrollText",
      group: "system",
    },
    { href: `${base}/settings`, label: "Paramètres", icon: "Settings", group: "system" },
    { href: `${base}/2fa/setup`, label: "2FA — sécurité", icon: "KeyRound", group: "system" },
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
