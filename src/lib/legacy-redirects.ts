/**
 * Carte des redirections legacy — slugs SANS préfixe locale → cible SANS préfixe.
 *
 * MIROIR des redirections de `next.config.ts > redirects()` (qui gèrent, elles, les
 * formes PRÉFIXÉES `/:locale/...`). Utilisée UNIQUEMENT par `src/proxy.ts` pour
 * APLATIR les chaînes de redirection (audit indexation 2026-06-17).
 *
 * Problème : une URL legacy NON-préfixée créait une chaîne à 2 sauts —
 *   `/interventions` → (proxy ajoute /fr) `/fr/interventions` → (next.config) `/fr/formations`.
 * Solution : le proxy consulte cette carte AVANT de préfixer, et redirige DIRECTEMENT
 * vers la cible finale en UN seul 301 :
 *   `/interventions` → `/fr/formations`.
 *
 * ⚠️ À garder cohérent avec `next.config.ts > redirects()` (redirections historiques
 * figées — fusion /interventions→/formations, /codage-developpement→/sites-web-augmentes,
 * slugs FAQ, /audit/flash|process). Le test `legacy-redirects.test.ts` verrouille les cas.
 * Les formes PRÉFIXÉES (`/fr/interventions`) restent gérées en 1 saut par next.config.
 */

/** Redirections legacy à chemin exact (sans préfixe locale). source → destination. */
const STATIC_LEGACY_REDIRECTS: ReadonlyMap<string, string> = new Map([
  // FAQ — anciens slugs faibles → slugs keyword-rich.
  ["/faq/definition", "/faq/definition-axion-ia"],
  ["/faq/modules", "/faq/les-3-modules-axion-ia"],
  ["/faq/tools", "/faq/outils-ia"],
  ["/faq/billing", "/faq/facturation"],
  ["/faq/secteurs", "/faq/secteurs-ia"],
  ["/faq/data-security", "/faq/securite-donnees-ia"],
  // Audit — anciens slugs.
  ["/audit/flash", "/audit/tpe-1-jour"],
  ["/audit/process", "/audit/cible"],
  // Fusion codage-developpement → sites-web-augmentes.
  ["/codage-developpement/web-digital", "/sites-web-augmentes"],
  ["/codage-developpement", "/sites-web-augmentes"],
  // Refonte /interventions (collectives) → /formations. Refonte 2026-07-19 :
  // les listings durée /formations/duree/* sont supprimés → cible = hub.
  ["/interventions", "/formations"],
  ["/interventions/collectives", "/formations"],
  ["/interventions/collectives/4h", "/formations"],
  ["/interventions/collectives/1-jour", "/formations"],
  ["/interventions/collectives/2-jours", "/formations"],
  ["/interventions/collectives/3-jours-plus", "/formations"],
  ["/interventions/essentielle", "/formations"],
  ["/interventions/approfondie", "/formations"],
  ["/interventions/gagner-du-temps", "/formations"],
  ["/interventions/intervention-claude", "/formations"],
  ["/interventions/demarrage-ia-express", "/formations"],
  ["/interventions/conference", "/formations"],
  ["/interventions/conference-pleniere", "/formations"],
  ["/interventions/conference-keynote", "/formations"],
  ["/interventions/atelier-ia-cible", "/formations"],
  // Formats Claude 1-to-1 retirés → prestation équivalente.
  ["/interventions/claude-dirigeant", "/interventions/dirigeant-vision-strategique"],
  ["/interventions/claude-implementation-individuel", "/interventions/coaching-decouverte"],
  // Formats 1-to-1 supprimés → hubs famille survivants.
  ["/interventions/dirigeant-productivite", "/interventions/dirigeants"],
  ["/interventions/coaching-avance", "/interventions/individuel"],
]);

/** Mapping verticale ville → page service canonique (anciennes pages ville×verticale). */
const VILLE_VERTICALE_TARGET: Readonly<Record<string, string>> = {
  audits: "/audit",
  interventions: "/formations",
  implementations: "/implementation",
  "un-a-un": "/un-a-un",
  "sites-web-ia": "/sites-web-augmentes",
};

/**
 * Résout une redirection legacy pour un chemin SANS préfixe locale.
 * Retourne la cible finale (sans préfixe locale) ou `null` si aucune redirection legacy.
 *
 * Couvre : chemins exacts (carte ci-dessus), `/interventions/par-ville/<ville>` →
 * `/formations/par-ville/<ville>`, et les anciennes pages ville×verticale
 * `/(implantations|locations)/<region>/<ville>/<verticale>` → page service.
 */
export function resolveLegacyRedirect(pathNoLocale: string): string | null {
  const direct = STATIC_LEGACY_REDIRECTS.get(pathNoLocale);
  if (direct) return direct;

  const parVille = pathNoLocale.match(/^\/interventions\/par-ville\/([^/]+)\/?$/);
  if (parVille) return `/formations/par-ville/${parVille[1]}`;

  const villeVerticale = pathNoLocale.match(
    /^\/(?:implantations|locations)\/[^/]+\/[^/]+\/(audits|interventions|implementations|un-a-un|sites-web-ia)\/?$/,
  );
  const verticale = villeVerticale?.[1];
  if (verticale) return VILLE_VERTICALE_TARGET[verticale] ?? null;

  return null;
}
