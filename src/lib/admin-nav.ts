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

export type AdminNavGroup = "main" | "content" | "image-bank" | "engagement" | "ops" | "system";

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
  "image-bank": "Banque d'images",
  engagement: "Engagement",
  ops: "Ops & monitoring",
  system: "Système",
};

export const ADMIN_NAV_GROUP_ORDER: ReadonlyArray<AdminNavGroup> = [
  "main",
  "content",
  "image-bank",
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
    { href: `${base}/submissions`, label: "Soumissions", icon: "📥", group: "main" },
    // ── contenu ──────────────────────────────────────────────────────────
    { href: `${base}/connaissances`, label: "Connaissances", icon: "📚", group: "content" },
    { href: `${base}/content-gen`, label: "Générateur contenus", icon: "🧠", group: "content" },
    { href: `${base}/blog`, label: "Blog", icon: "📝", group: "content" },
    { href: `${base}/categories`, label: "Catégories", icon: "🏷️", group: "content" },
    { href: `${base}/case-studies`, label: "Cas concrets", icon: "🏆", group: "content" },
    { href: `${base}/testimonials`, label: "Témoignages", icon: "💬", group: "content" },
    { href: `${base}/faq`, label: "FAQ", icon: "❓", group: "content" },
    { href: `${base}/help`, label: "Centre d'aide", icon: "❔", group: "content" },
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
    // ── engagement ───────────────────────────────────────────────────────
    { href: `${base}/newsletter`, label: "Newsletter", icon: "📧", group: "engagement" },
    // ── ops & monitoring ─────────────────────────────────────────────────
    { href: `${base}/analytics`, label: "Analytics & SEO", icon: "📊", group: "ops" },
    { href: `${base}/web-vitals`, label: "Web Vitals", icon: "📈", group: "ops" },
    { href: `${base}/infra`, label: "Infra & outils", icon: "🔧", group: "ops" },
    { href: `${base}/alerts`, label: "Alertes ops", icon: "🚨", group: "ops" },
    // ── système ──────────────────────────────────────────────────────────
    { href: `${base}/users`, label: "Utilisateurs", icon: "👥", group: "system" },
    { href: `${base}/activity-logs`, label: "Activity logs", icon: "📜", group: "system" },
    { href: `${base}/settings`, label: "Paramètres", icon: "⚙️", group: "system" },
    { href: `${base}/2fa/setup`, label: "2FA — sécurité", icon: "🔐", group: "system" },
  ];
}
