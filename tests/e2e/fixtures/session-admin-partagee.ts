// ── LA SESSION ADMIN EST ACQUISE UNE FOIS, PAS VINGT-HUIT ────────────────────
//
// 🔴 CE QUE CE CACHE EMPÊCHE, ET POURQUOI IL NE POUVAIT PAS RESTER DANS LES SPECS.
//
// La connexion admin est limitée en débit, sur deux compteurs Redis partagés par
// tous les workers : `auth:login:ip:<ip>` (100 / 15 min) et
// `auth:login:email:<email>` (50 / 15 min). Deux détails rendent ce plafond
// beaucoup plus bas qu'il n'en a l'air :
//
//   1. **Une connexion réussie consomme DEUX hits sur chaque compteur.**
//      `signInAction` compte (features/admin-auth/actions.ts), puis appelle
//      `signIn("credentials")`, dont `authorize()` recompte les mêmes clés
//      (auth.ts). Le budget réel est donc de 25 connexions, pas 50.
//   2. **En CI, l'IP est la même pour tout le monde.** Sous `pnpm start` sans
//      proxy, ni `x-real-ip` ni `x-forwarded-for` n'existent : `getClientIp()`
//      rend `"unknown"`, et les quatre workers partagent une seule clé.
//
// La suite comptait 28 appels à `loginAsAdmin`, soit 56 hits — au-dessus des 50.
// Gate B tombait alors sur « Trop de tentatives. Réessayez dans 15 minutes. »,
// un message qui accuse la connexion alors que rien n'est cassé dans le produit.
//
// 🔑 CE PLAFOND A DÉJÀ ÉTÉ FRANCHI DEUX FOIS, ET RUSTINÉ DEUX FOIS DANS LA SPEC
// QUI SE TROUVAIT LÀ (`a11y-admin.spec.ts`, puis `console-editoriale.spec.ts`,
// chacune avec son propre cache local). Une rustine par fichier ne tient pas :
// le coût croît avec la couverture, et c'est la spec VOISINE qui rougit, jamais
// celle qui dépense. On hisse donc le cache dans le fixture lui-même — le seul
// endroit que tous les appelants traversent.
//
// ## Pourquoi un fichier sur disque, et pas une variable de module
//
// Playwright lance quatre PROCESSUS. Une variable de module donnerait quatre
// connexions au lieu d'une — mieux que 28, mais le partage entre workers ne
// coûte qu'un fichier JSON, et il rend le nombre de connexions indépendant du
// nombre de workers.
//
// ## Pourquoi ce n'est PAS un `storageState` de projet
//
// Parce que des specs EXIGENT d'être déconnectées, et qu'elles vivent dans les
// mêmes fichiers que des specs connectées :
// `console-editoriale.spec.ts` — « le tableau de bord renvoie vers le login » ;
// `flows/admin-routes.spec.ts` — « non-auth /admin/reservations → redirect ».
// Un `storageState` posé sur le projet les authentifierait en silence : elles
// resteraient VERTES en n'assertant plus rien. Le cache n'agit donc que dans
// `loginAsAdmin`, c'est-à-dire là où l'appelant a explicitement demandé une
// session — aucune spec ne change de sens.
//
// ## Le cache se VÉRIFIE, il ne se croit pas
//
// Des cookies rejoués peuvent être périmés (fichier resté d'une exécution
// précédente, session expirée, base re-semée entre-temps). On rejoue donc, puis
// on CONSTATE l'arrivée sur le tableau de bord. Si la vérification échoue, le
// cache est jeté et la connexion complète a lieu — le pire cas est le
// comportement d'avant ce fichier, jamais un test faussement vert.

import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { BrowserContext, Page } from "@playwright/test";

type CookieSession = Awaited<ReturnType<BrowserContext["cookies"]>>;

/**
 * Où vit l'état partagé.
 *
 * Hors du dépôt : il ne doit jamais être commité, et `test-results/` est effacé
 * par Playwright entre deux exécutions — ce qui ferait perdre le partage entre
 * workers démarrés à des instants différents. Le dossier temporaire du système
 * est le seul emplacement stable ET ignoré par git.
 *
 * 🔑 La clé porte l'ADRESSE et le PRÉFIXE admin : deux exécutions visant deux
 * comptes ou deux préfixes ne doivent pas se rejouer les cookies l'une de
 * l'autre. Un cache trop généreux est un test faussement vert.
 */
function cheminDuCache(email: string, prefixe: string): string {
  const cle = `${email}|${prefixe}`.replace(/[^a-zA-Z0-9._-]/g, "_");
  return join(tmpdir(), "axion-e2e-session", `${cle}.json`);
}

/** Le verrou est un DOSSIER : `mkdir` est atomique sur tous les systèmes. */
function cheminDuVerrou(email: string, prefixe: string): string {
  return `${cheminDuCache(email, prefixe)}.lock`;
}

/**
 * Âge maximal d'un état rejouable.
 *
 * Une suite complète dure moins de trente minutes ; au-delà, on préfère une
 * connexion neuve à des cookies dont on ne sait plus s'ils valent encore. Ce
 * n'est PAS la garde qui protège des cookies périmés — celle-là est la
 * vérification d'arrivée. C'est une borne de bon sens contre un fichier oublié.
 */
const AGE_MAX_MS = 20 * 60 * 1000;

export function lireSessionPartagee(email: string, prefixe: string): CookieSession | null {
  const chemin = cheminDuCache(email, prefixe);
  try {
    const brut = readFileSync(chemin, "utf8");
    const { ecritLe, cookies } = JSON.parse(brut) as { ecritLe: number; cookies: CookieSession };
    if (!Array.isArray(cookies) || cookies.length === 0) return null;
    if (Date.now() - ecritLe > AGE_MAX_MS) return null;
    return cookies;
  } catch {
    // Absent, illisible, ou JSON cassé : tous se traitent pareil — on se
    // connecte. Un cache est une optimisation, jamais une dépendance.
    return null;
  }
}

export function ecrireSessionPartagee(
  email: string,
  prefixe: string,
  cookies: CookieSession,
): void {
  const chemin = cheminDuCache(email, prefixe);
  try {
    mkdirSync(join(tmpdir(), "axion-e2e-session"), { recursive: true });
    writeFileSync(chemin, JSON.stringify({ ecritLe: Date.now(), cookies }), "utf8");
  } catch {
    // Disque plein, permission refusée : la suite continue sans partage. Elle
    // sera plus lente, elle ne sera pas fausse.
  }
}

export function oublierSessionPartagee(email: string, prefixe: string): void {
  try {
    rmSync(cheminDuCache(email, prefixe), { force: true });
  } catch {
    /* rien à faire : le prochain appelant se connectera. */
  }
}

/**
 * Prend le verrou, ou attend que le gagnant publie son état.
 *
 * ⚠️ **Le verrou ne bloque JAMAIS la suite.** Au bout de `attenteMaxMs`, celui
 * qui attendait se connecte pour son propre compte. Un verrou dont l'expiration
 * fait échouer les tests transforme une optimisation en point de panne unique —
 * ce serait pire que les 28 connexions qu'on cherche à éviter.
 */
export function prendreLeVerrou(email: string, prefixe: string): boolean {
  try {
    mkdirSync(join(tmpdir(), "axion-e2e-session"), { recursive: true });
    mkdirSync(cheminDuVerrou(email, prefixe));
    return true;
  } catch {
    return false;
  }
}

export function rendreLeVerrou(email: string, prefixe: string): void {
  try {
    rmSync(cheminDuVerrou(email, prefixe), { recursive: true, force: true });
  } catch {
    /* le prochain `mkdir` échouera, et l'attente dégradera vers une connexion. */
  }
}

export function verrouPris(email: string, prefixe: string): boolean {
  return existsSync(cheminDuVerrou(email, prefixe));
}

/** Rejoue des cookies dans le contexte de `page`. */
export async function rejouer(page: Page, cookies: CookieSession): Promise<void> {
  await page.context().addCookies(cookies);
}
