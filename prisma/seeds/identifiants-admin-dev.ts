/**
 * SOURCE UNIQUE des identifiants de l'administrateur de développement.
 *
 * 🔴 Ils étaient écrits DEUX FOIS, et les deux écritures divergeaient :
 *
 *   - `prisma/seed.ts` créait `admin@axion-ia.com` / `AdminAxion2026!` ;
 *   - `tests/e2e/fixtures/admin-auth.ts` retombait sur `admin@axion-ia.local` /
 *     `ChangeMe!2026Axion` quand `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD`
 *     n'étaient pas définis — ce qui était le cas PARTOUT, ces deux variables
 *     n'existant dans aucun fichier du dépôt.
 *
 * Conséquence : les quatre specs Playwright qui commencent par `loginAsAdmin`
 * (`a11y-admin`, `admin-nav-clic`, `admin-booking-flow`, `qualiopi/vente-parcours`)
 * se `test.skip`aient silencieusement, en CI comme en local. Elles n'avaient
 * jamais exécuté une seule assertion. Et recopier les valeurs par défaut du
 * fixture n'aurait pas aidé : elles ne correspondaient à aucun compte semé.
 *
 * ⚠️ Ce fichier ne doit RIEN importer. Il est lu à la fois par le seed Prisma
 * (Node) et par un fixture Playwright, qui n'ont pas le même graphe de modules.
 *
 * ⚠️ Ce n'est PAS un secret de production : ce compte n'existe que dans une base
 * de développement ou dans le Postgres éphémère de la CI. La production crée ses
 * administrateurs par la console. Ne jamais semer cette base-là.
 */

/** Adresse de l'administrateur créé par `pnpm db:seed`. */
export const ADMIN_DEV_EMAIL = "admin@axion-ia.com";

/** Mot de passe en clair de ce même compte, avant hachage Argon2id. */
export const ADMIN_DEV_PASSWORD = "AdminAxion2026!";
