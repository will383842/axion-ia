/**
 * `SITE_URL` — origine canonique du site, isolée dans un module TIER-0.
 *
 * 🔴 POURQUOI CE MODULE EXISTE.
 *
 * La constante vivait dans `@/lib/seo`, qui fait 2 249 lignes et tire tout le
 * graphe SEO (`service-coverage` et ses communes, `page-images`, `wikidata`,
 * `speakable`, `brand`, `routing`…). Importer `SITE_URL` revenait donc à
 * charger l'ensemble.
 *
 * Mesuré le 2026-08-04 en instrumentant la chaîne d'import d'un worker :
 *
 *   worker → `@/lib/telegram` (44 s) → `@/server/notifications`
 *          → `./format` → `@/lib/seo` (**30 s à lui seul**)
 *
 * `format.ts` — un formateur de messages Telegram — payait 30 s de chargement
 * pour une seule chaîne de caractères. Et ce chemin d'alerte est commun à
 * TOUS les workers. Deux cas de test en mouraient (délai dépassé en local,
 * vert en CI : le pire des signaux, celui qui apprend à ignorer un test).
 *
 * Bénéfice secondaire : `service-coverage.ts` réimportait `SITE_URL` depuis
 * `seo.ts`, qui l'importe en retour — un cycle que `seo.ts` documentait comme
 * « autorisé, ESM-safe ». Il disparaît : les deux pointent désormais ici.
 *
 * ⚠️ Ce module doit rester SANS DÉPENDANCE hors `@/env`. Tout import ajouté
 * ici serait repayé par chaque worker.
 */

import { env } from "@/env";

// Filet de sécurité en production : si `NEXT_PUBLIC_SITE_URL` n'est pas défini
// au build (variable Coolify manquante), `env.NEXT_PUBLIC_SITE_URL` retombe sur
// `http://localhost:3000`, ce qui casse `metadataBase` — les pages pré-rendues
// porteraient une `og:image` sur l'hôte localhost. On force donc le domaine
// réel quand la valeur est manifestement le défaut local ET qu'on construit en
// production.
//
// La source de vérité reste la variable d'environnement : ceci n'est qu'un
// filet.
//
// Sous `SKIP_ENV_VALIDATION=true` (scripts de la chaîne Qualiopi de nuit), t3-env
// n'applique pas le `.default(...)` du schéma : la valeur lue est `undefined`.
// Hors production on retombe alors sur le défaut local ; en production une
// adresse absente fait toujours échouer, explicitement.
const RAW_SITE_URL: string | undefined = env.NEXT_PUBLIC_SITE_URL;

function resoudreSiteUrl(): string {
  if (process.env.NODE_ENV === "production") {
    if (!RAW_SITE_URL) {
      throw new Error("NEXT_PUBLIC_SITE_URL est absent : refus de construire en production.");
    }
    return RAW_SITE_URL.startsWith("http://localhost") ? "https://axion-ia.com" : RAW_SITE_URL;
  }
  return RAW_SITE_URL ?? "http://localhost:3000";
}

export const SITE_URL = resoudreSiteUrl();
