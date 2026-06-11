// Résolveur « offre → URL FR canonique » (T-34, ADR-CB-11, doc 16 §7 G-2).
//
// Garantit ZÉRO LIEN MORT et FR-ONLY pour les liens d'offre du chatbot :
//   resolveOfferUrl("audit-cible") → "/fr/audit/cible"
//
// Pourquoi une table explicite plutôt qu'une dérivation `pricing.id → taxonomy.slug`
// (ADR-CB-11 évoquait routing.pathnames + taxonomy.pathFr) :
//   - le join pricing.id ↔ taxonomy.slug n'est PAS 1:1 (ex. `intervention-essentielle`
//     vs slug `essentielle`, `intervention-4h` vs `collectives/4h`) → dérivation fragile ;
//   - plusieurs offres n'ont AUCUNE page propre (membre-equipe, sur-demande, conférence,
//     impl « sur devis », maintenance) → table d'override OBLIGATOIRE de toute façon ;
//   - une table explicite VALIDÉE à la charge contre `routing.pathnames` transforme
//     « zéro lien mort » en invariant structurel : si une route est renommée, le module
//     throw au boot (et le test casse) au lieu de produire un 404 silencieux.
//
// FR-only : on préfixe toujours `/fr` (localePrefix "always") → jamais de `/en/`
// (recoupé `mapEnToFr`). Toutes les valeurs ci-dessous sont des clés réelles de
// `routing.pathnames` (vérifié src/i18n/routing.ts) → URL canonique post-redirect.

import type { Locale } from "../../prisma/generated/client";
import { routing } from "@/i18n/routing";

type PathnameEntry = string | Record<Locale, string>;

/** Chemin public FR (sans préfixe locale) d'une entrée pathnames. */
function frPathOf(entry: PathnameEntry): string {
  return typeof entry === "string" ? entry : entry.fr;
}

/**
 * Ensemble de TOUS les chemins FR publics connus (dérivé de routing.pathnames).
 * Source de vérité pour « URL ∈ routes connues » (output-guard T-39).
 */
export const KNOWN_FR_PATHS: ReadonlySet<string> = new Set(
  Object.values(routing.pathnames as Record<string, PathnameEntry>).map(frPathOf),
);

/**
 * Mapping offre (`pricing.ts` id) → chemin FR canonique (clé routing.pathnames).
 * Chaque valeur est l'URL APRÈS redirection 301 éventuelle (jamais un 404/301).
 * Couvre toutes les verticales (audit, formation/interventions, implémentation,
 * sites-web/SaaS, un-à-un, maintenance).
 */
const OFFER_FR_PATH: Readonly<Record<string, string>> = {
  // — Audit —
  "audit-flash": "/audit/tpe-1-jour",
  "audit-cible": "/audit/cible",
  "audit-strategique-pme": "/audit/strategique-pme",
  "audit-strategique-eti": "/audit/strategique-eti",

  // — Interventions / formations collectives & 1-to-1 —
  "intervention-4h": "/interventions/collectives/4h",
  "intervention-essentielle": "/interventions/essentielle",
  "intervention-temps": "/interventions/gagner-du-temps",
  "intervention-approfondie": "/interventions/approfondie",
  // Conférence : pas de page propre → /interventions/collectives (cible 301 vérifiée).
  "intervention-conference": "/interventions/collectives",
  "intervention-dirigeants": "/interventions/dirigeants",
  // Membre d'équipe (890 €) : pas de page /interventions/membre-equipe → hub 1-to-1 (D-MEMBRE-EQUIPE 🔒).
  "intervention-membre-equipe": "/un-a-un",
  "intervention-claude": "/interventions/intervention-claude",
  "intervention-dirigeant-vision": "/interventions/dirigeant-vision-strategique",
  "intervention-claude-dirigeant": "/interventions/claude-dirigeant",
  // Sur demande : pas de page propre → demande de devis.
  "intervention-sur-demande": "/demande-devis",

  // — Implémentation (4/5 sur devis → hub ; ia-custom a sa page) —
  "impl-poc": "/implementation",
  "impl-mission-pme": "/implementation",
  "impl-mission-eti": "/implementation",
  "impl-grand-programme": "/implementation",
  "impl-ia-custom": "/implementation/ia-custom",

  // — Maintenance (contrat post-livraison, pas de landing publique) → devis —
  "maintenance-standard": "/demande-devis",

  // — Sites web augmentés / SaaS (codage) — 301 /codage-developpement → hub —
  "codage-web": "/sites-web-augmentes",

  // — Un-à-un récurrent (standalone) —
  "un-a-un-recurrent": "/un-a-un",
};

// Invariant structurel : toute cible DOIT être une route FR connue. Sinon throw
// au boot → impossible de livrer un lien mort (zéro 404, G-2 / DoD §10.a #3).
for (const [offerId, path] of Object.entries(OFFER_FR_PATH)) {
  if (!KNOWN_FR_PATHS.has(path)) {
    throw new Error(
      `[offer-url] INVARIANT VIOLÉ : l'offre "${offerId}" pointe vers "${path}" ` +
        `qui n'est PAS une route FR connue (routing.pathnames). Lien mort potentiel.`,
    );
  }
}

/** Les ids d'offre dont l'URL est résoluble (toutes celles de la table). */
export const RESOLVABLE_OFFER_IDS: ReadonlyArray<string> = Object.keys(OFFER_FR_PATH);

export interface ResolveOfferUrlOptions {
  /** true → URL absolue avec origin (pour emails/JSON-LD). Défaut : chemin relatif `/fr/...`. */
  readonly absolute?: boolean;
  /** Origin pour `absolute` (défaut : NEXT_PUBLIC_SITE_URL ou https://axion-ia.com). */
  readonly origin?: string;
}

/**
 * Résout l'URL FR canonique d'une offre. Throw si l'id est inconnu (fail-fast :
 * un id manquant = erreur de mapping, jamais un lien deviné).
 */
export function resolveOfferUrl(offerId: string, opts: ResolveOfferUrlOptions = {}): string {
  const path = OFFER_FR_PATH[offerId];
  if (path === undefined) {
    throw new Error(`[offer-url] offre inconnue : "${offerId}" (aucune URL FR mappée).`);
  }
  const frUrl = `/fr${path}`; // localePrefix "always" → toujours préfixé /fr (FR-only).
  if (!opts.absolute) return frUrl;
  const origin = (
    opts.origin ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://axion-ia.com"
  ).replace(/\/$/, "");
  return `${origin}${frUrl}`;
}

/** true si `offerId` a une URL FR résoluble. */
export function hasResolvableUrl(offerId: string): boolean {
  return offerId in OFFER_FR_PATH;
}

/**
 * Vérifie qu'une URL/chemin (telle que citée par le LLM) pointe vers une route FR
 * connue — utilisé par l'output-guard (T-39). Accepte « /fr/x », « /x », URL absolue.
 * Rejette tout `/en/...` (FR-only).
 */
export function isKnownFrUrl(url: string): boolean {
  let pathname: string;
  try {
    pathname = url.startsWith("http") ? new URL(url).pathname : url;
  } catch {
    return false;
  }
  // Retire le query/hash.
  pathname = pathname.split(/[?#]/)[0] ?? pathname;
  // Retire le préfixe locale.
  if (pathname.startsWith("/en/") || pathname === "/en") return false; // FR-only
  const withoutLocale = pathname.replace(/^\/fr(?=\/|$)/, "") || "/";
  return KNOWN_FR_PATHS.has(withoutLocale);
}
