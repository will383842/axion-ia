// Refonte admin mai 2026 — SSOT navigation admin (PR 1).
//
// Pourquoi ce fichier :
//   Avant la refonte, `buildNav()` était inline dans
//   `src/app/[locale]/(admin)/[adminPrefix]/layout.tsx` (36 items, 6 groupes).
//   `AdminCommandPalette.tsx` réimplémentait une liste équivalente → drift
//   risk garanti à chaque ajout/renommage de section (Audit A1 finding #4).
//
//   Cette extraction met en place la SOURCE UNIQUE de vérité que :
//   - le layout admin consomme pour rendre la sidebar (`<AdminSidebar nav={…}>`),
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
  | "content"
  | "qualiopi"
  | "image-bank"
  | "chatbot"
  | "engagement"
  | "ops"
  | "system";

export interface AdminNavItem {
  href: string;
  label: string;
  /**
   * Icon string (emoji V1) ou identifiant d'icône `lucide-react` (V2 PR 5).
   * Format string pour rester compatible avec `<AdminSidebar>` actuel.
   */
  icon: string;
  group: AdminNavGroup;
}

export const ADMIN_NAV_GROUP_LABELS: Record<AdminNavGroup, string> = {
  main: "Activité quotidienne",
  content: "Contenu",
  qualiopi: "Formation / Qualiopi",
  "image-bank": "Banque d'images",
  chatbot: "Chatbot",
  engagement: "Engagement",
  ops: "Ops & monitoring",
  system: "Système",
};

export const ADMIN_NAV_GROUP_ORDER: ReadonlyArray<AdminNavGroup> = [
  "main",
  "content",
  "qualiopi",
  "image-bank",
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
    // ── main ─────────────────────────────────────────────────────────────
    { href: `${base}`, label: "Tableau de bord", icon: "📊", group: "main" },
    { href: `${base}/calendrier`, label: "Calendrier", icon: "📅", group: "main" },
    { href: `${base}/reservations`, label: "Réservations", icon: "📋", group: "main" },
    { href: `${base}/devis`, label: "Devis", icon: "📄", group: "main" },
    { href: `${base}/factures`, label: "Factures", icon: "🧾", group: "main" },
    { href: `${base}/paiements`, label: "Paiements", icon: "💶", group: "main" },
    { href: `${base}/echeanciers`, label: "Échéanciers", icon: "📅", group: "main" },
    { href: `${base}/options`, label: "Options 48h", icon: "⏳", group: "main" },
    {
      href: `${base}/contacts/messages`,
      label: "Contacts & messages",
      icon: "📥",
      group: "main",
    },
    {
      href: `${base}/candidatures`,
      label: "Candidatures emploi",
      icon: "📨",
      group: "main",
    },
    // ── contenu ──────────────────────────────────────────────────────────
    { href: `${base}/connaissances`, label: "Connaissances", icon: "📚", group: "content" },
    { href: `${base}/content-gen`, label: "Générateur contenus", icon: "🧠", group: "content" },
    {
      href: `${base}/content-gen/city-coverage`,
      label: "Couverture villes",
      icon: "🏙️",
      group: "content",
    },
    {
      href: `${base}/content-gen/city-equity`,
      label: "Équité villes",
      icon: "⚖️",
      group: "content",
    },
    {
      href: `${base}/content-gen/cities-order`,
      label: "Ordre villes",
      icon: "📋",
      group: "content",
    },
    {
      href: `${base}/content-gen/coverage-map`,
      label: "Carte couverture",
      icon: "🗺️",
      group: "content",
    },
    {
      href: `${base}/content-gen/campaigns/new`,
      label: "Nouvelle campagne",
      icon: "➕",
      group: "content",
    },
    {
      href: `${base}/content-gen/orchestrator/adhoc`,
      label: "Lancement ad-hoc",
      icon: "⚡",
      group: "content",
    },
    { href: `${base}/blog`, label: "Blog", icon: "📝", group: "content" },
    { href: `${base}/categories`, label: "Catégories", icon: "🏷️", group: "content" },
    { href: `${base}/case-studies`, label: "Cas concrets", icon: "🏆", group: "content" },
    { href: `${base}/testimonials`, label: "Témoignages", icon: "💬", group: "content" },
    { href: `${base}/offres-emploi`, label: "Offres d'emploi", icon: "💼", group: "content" },
    { href: `${base}/faq`, label: "FAQ", icon: "❓", group: "content" },
    { href: `${base}/help`, label: "Centre d'aide", icon: "❔", group: "content" },
    // ── Formation / Qualiopi (back-office OF — items ajoutés par tranche) ──
    { href: `${base}/qualiopi`, label: "Vue d'ensemble", icon: "🎓", group: "qualiopi" },
    { href: `${base}/qualiopi/config`, label: "Configuration", icon: "⚙️", group: "qualiopi" },
    { href: `${base}/qualiopi/formations`, label: "Formations", icon: "📘", group: "qualiopi" },
    {
      href: `${base}/qualiopi/formation-engine`,
      label: "Formation Engine",
      icon: "⚙️",
      group: "qualiopi",
    },
    {
      href: `${base}/qualiopi/formation-engine/validations`,
      label: "Validations IA",
      icon: "✅",
      group: "qualiopi",
    },
    { href: `${base}/qualiopi/sessions`, label: "Sessions", icon: "📅", group: "qualiopi" },
    { href: `${base}/qualiopi/formateurs`, label: "Formateurs", icon: "👨‍🏫", group: "qualiopi" },
    { href: `${base}/qualiopi/stagiaires`, label: "Stagiaires", icon: "🧑‍🎓", group: "qualiopi" },
    { href: `${base}/qualiopi/offres`, label: "Offres", icon: "🏷️", group: "qualiopi" },
    { href: `${base}/qualiopi/clients`, label: "Clients (CRM)", icon: "🏢", group: "qualiopi" },
    { href: `${base}/qualiopi/devis`, label: "Devis", icon: "📄", group: "qualiopi" },
    {
      href: `${base}/qualiopi/indicateurs`,
      label: "Indicateurs / BPF",
      icon: "📊",
      group: "qualiopi",
    },
    {
      href: `${base}/qualiopi/financements`,
      label: "Financements / Facturation",
      icon: "💳",
      group: "qualiopi",
    },
    // ── Qualiopi · Conformité & registres T12 ──────────────────────────────
    {
      href: `${base}/qualiopi/conformite`,
      label: "Conformité",
      icon: "✅",
      group: "qualiopi",
    },
    {
      href: `${base}/qualiopi/pilotage`,
      label: "Pilotage",
      icon: "📊",
      group: "qualiopi",
    },
    {
      href: `${base}/qualiopi/reclamations`,
      label: "Réclamations",
      icon: "📬",
      group: "qualiopi",
    },
    {
      href: `${base}/qualiopi/veille`,
      label: "Veille",
      icon: "🔎",
      group: "qualiopi",
    },
    {
      href: `${base}/qualiopi/partenariats`,
      label: "Partenariats",
      icon: "🤝",
      group: "qualiopi",
    },
    {
      href: `${base}/qualiopi/sous-traitants`,
      label: "Sous-traitants",
      icon: "🏭",
      group: "qualiopi",
    },
    {
      href: `${base}/qualiopi/revue-direction`,
      label: "Revue de direction",
      icon: "📋",
      group: "qualiopi",
    },
    {
      href: `${base}/qualiopi/mode-auditeur`,
      label: "Mode auditeur",
      icon: "🔍",
      group: "qualiopi",
    },
    {
      href: `${base}/qualiopi/appreciations`,
      label: "Appréciations",
      icon: "⭐",
      group: "qualiopi",
    },
    {
      href: `${base}/qualiopi/rgpd`,
      label: "Demandes RGPD",
      icon: "🔐",
      group: "qualiopi",
    },
    // ── Qualiopi · Alertes système T15 ────────────────────────────────────
    {
      href: `${base}/qualiopi/alertes`,
      label: "Alertes",
      icon: "🔔",
      group: "qualiopi",
    },
    // ── banque d'images (image-bank V1) ──────────────────────────────────
    { href: `${base}/image-bank`, label: "Overview", icon: "🖼️", group: "image-bank" },
    { href: `${base}/image-bank/library`, label: "Library", icon: "📚", group: "image-bank" },
    { href: `${base}/image-bank/upload`, label: "Upload", icon: "⬆️", group: "image-bank" },
    {
      href: `${base}/image-bank/bulk-import`,
      label: "Bulk import CSV",
      icon: "📦",
      group: "image-bank",
    },
    { href: `${base}/image-bank/quality`, label: "Quality queue", icon: "🔍", group: "image-bank" },
    { href: `${base}/image-bank/analytics`, label: "Analytics", icon: "📊", group: "image-bank" },
    { href: `${base}/image-bank/categories`, label: "Categories", icon: "🏷️", group: "image-bank" },
    { href: `${base}/image-bank/tags`, label: "Tags", icon: "🔖", group: "image-bank" },
    {
      href: `${base}/image-bank/usage-logs`,
      label: "Usage logs (RGPD)",
      icon: "🛡️",
      group: "image-bank",
    },
    { href: `${base}/image-bank/settings`, label: "Settings", icon: "⚙️", group: "image-bank" },
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
    { href: `${base}/analytics`, label: "Analytics & SEO", icon: "📊", group: "ops" },
    { href: `${base}/web-vitals`, label: "Web Vitals", icon: "📈", group: "ops" },
    { href: `${base}/site-explorer`, label: "Toutes les URLs", icon: "🗺️", group: "ops" },
    { href: `${base}/infra`, label: "Infra & outils", icon: "🔧", group: "ops" },
    { href: `${base}/infra/backups`, label: "Sauvegardes & DR", icon: "💾", group: "ops" },
    { href: `${base}/alerts`, label: "Alertes ops", icon: "🚨", group: "ops" },
    // ── système ──────────────────────────────────────────────────────────
    { href: `${base}/users`, label: "Utilisateurs", icon: "👥", group: "system" },
    { href: `${base}/activity-logs`, label: "Activity logs", icon: "📜", group: "system" },
    { href: `${base}/settings`, label: "Paramètres", icon: "⚙️", group: "system" },
    { href: `${base}/2fa/setup`, label: "2FA — sécurité", icon: "🔐", group: "system" },
  ];
}
