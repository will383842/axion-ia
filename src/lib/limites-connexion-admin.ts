/**
 * LES PLAFONDS DE LA CONNEXION A LA CONSOLE — un seul endroit.
 *
 * ═══ 🔴 CE QUI A ETE MESURE LE 2026-09-06, ET CE QUI ETAIT MAL COMPTE ═══
 *
 * Les plafonds valaient **100 essais / IP** et **50 essais / compte** par
 * quart d'heure, soit environ dix fois la doctrine ANSSI pour un formulaire
 * d'authentification (5 a 10). Ils avaient ete releves le 2026-05-10 « pendant
 * la phase de stabilisation », le commentaire disant deja « a redurcir » : une
 * ouverture temporaire qui a tenu quatre mois.
 *
 * ⚠️ ET LE CHIFFRE QUI CIRCULAIT SUR CE DEFAUT ETAIT FAUX, DANS LE SENS
 *    RASSURANT. Le depot documente (fixture `session-admin-partagee.ts`) qu'une
 *    connexion consomme DEUX hits, d'ou un « budget reel de 25 ». C'est exact
 *    pour une connexion REUSSIE, et c'est de la que vient le « ~25 essais par
 *    compte » repete ailleurs. Mais l'attaquant, lui, ne reussit pas : sur un
 *    mot de passe faux, `signInAction` rend la main AVANT d'appeler
 *    `signIn("credentials")`, donc `authorize()` ne recompte jamais. Le double
 *    comptage ne penalisait que l'utilisateur legitime.
 *
 * 🔑 **Le budget de force brute etait donc de 50 essais par compte et par quart
 *    d'heure, pas 25** — soit deux fois pire que ce qu'on croyait corriger. Le
 *    defaut dominant n'etait pas le double comptage : c'etait le plafond.
 *
 * ═══ CE QUI EST RETENU ═══
 *
 * · compte : **10** / 15 min — le haut de la fourchette ANSSI. Le bas (5) rend
 *   une faute de frappe repetee indiscernable d'une attaque pour un admin seul.
 * · IP : **20** / 15 min — deux comptes pleins depuis une meme sortie reseau.
 *
 * ⚠️ NE PAS DESCENDRE L'IP AU NIVEAU DU COMPTE. En CI (`pnpm start` sans proxy),
 *    ni `x-real-ip` ni `x-forwarded-for` n'existent : `getClientIp()` rend
 *    `"unknown"` et TOUS les workers Playwright partagent une seule cle. Un
 *    plafond IP trop bas ferait rougir des suites qui n'ont rien casse — c'est
 *    deja arrive deux fois (cf. `tests/e2e/fixtures/session-admin-partagee.ts`).
 *
 * ═══ POURQUOI CE FICHIER EXISTE PLUTOT QUE DEUX LITTERAUX ═══
 *
 * Ces plafonds etaient ecrits en dur DEUX fois — dans `signInAction` et dans
 * `authorize()` — avec le meme commentaire recopie. Deux copies ne divergent
 * pas le jour ou on les ecrit : elles divergent le jour ou l'une est durcie, et
 * la divergence ne se voit sur aucun ecran. Meme raisonnement que le SSOT des
 * roles (`server/auth/habilitations.ts`), garde par
 * `tests/unit/ci/aucune-liste-de-roles-recopiee.spec.ts`.
 */
import type { RateLimitConfig } from "./rate-limit";

/** Fenetre commune aux deux compteurs. */
const FENETRE_SEC = 900;

/**
 * `surPanne: "refuser"` sur les deux : laisser passer pendant une panne de
 * Redis transformerait l'incident d'infrastructure en ouverture de la console a
 * la force brute. Exige par `rate-limit.spec.ts` pour tout prefixe sensible.
 */
export const LIMITE_CONNEXION_IP: RateLimitConfig = {
  limit: 20,
  windowSec: FENETRE_SEC,
  surPanne: "refuser",
};

export const LIMITE_CONNEXION_COMPTE: RateLimitConfig = {
  limit: 10,
  windowSec: FENETRE_SEC,
  surPanne: "refuser",
};

/** `auth:login:ip:<ip>` — le prefixe est lu par la garde des prefixes sensibles. */
export const cleConnexionIp = (ip: string): string => `auth:login:ip:${ip}`;

/** `auth:login:email:<email>` */
export const cleConnexionCompte = (email: string): string => `auth:login:email:${email}`;
