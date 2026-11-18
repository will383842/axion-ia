// Garde commune des gestionnaires de route (`route.ts`) de la console.
//
// POURQUOI : un gestionnaire de route ne passe pas par le layout de la console, et
// le proxy ne voit pas certains chemins (`/videos/…`, `/sitemap…`, `/api/…`, etc.).
// Hors proxy, le segment `[locale]` peut valoir n'importe quoi et `[adminPrefix]`
// n'est plus contrôlé. Cette garde refuse, par un 404 neutre, tout chemin qui n'est
// pas `/<locale>/<préfixe attendu>/…`. Elle ne remplace PAS l'authentification, que
// chaque gestionnaire continue de faire lui-même.
//
// Aucun `auth()`, aucune base : elle doit pouvoir tourner en tout premier.

import { NextResponse } from "next/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";

/** Même repli de développement que le layout de la console (valeur publique, hors production). */
const PREFIXE_DEV_PAR_DEFAUT = "admin-dev-x7k2n9";

type ParamsConsole = Promise<{ locale: string; adminPrefix: string }>;

/**
 * Préfixe d'administration attendu, ou `null` si on doit tout refuser
 * (production sans variable d'environnement : refus par défaut).
 */
export function prefixeAdminAttendu(): string | null {
  const brut = process.env["ADMIN_URL_PREFIX"];
  if (brut !== undefined && brut !== "") return brut;
  if (process.env["NODE_ENV"] === "production") return null;
  return PREFIXE_DEV_PAR_DEFAUT;
}

function reponse404(): NextResponse {
  return new NextResponse("not found", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

/** Pour les routes publiques à jeton : 404 `no-store` si la locale est inconnue, avant tout jeton consommé. */
export function refuserSiLocaleInconnue(locale: string): NextResponse | null {
  return hasLocale(routing.locales, locale) ? null : reponse404();
}

/** Rend un 404 si le chemin n'est pas `/<locale>/<préfixe attendu>/…`, sinon `null`. */
export async function refuserSiHorsConsole(params: ParamsConsole): Promise<NextResponse | null> {
  const { locale, adminPrefix } = await params;
  if (refuserSiLocaleInconnue(locale) !== null) return reponse404();
  const attendu = prefixeAdminAttendu();
  if (attendu === null || adminPrefix !== attendu) return reponse404();
  return null;
}
