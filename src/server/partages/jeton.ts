/**
 * LE LIEN PRIVÉ d'un envoi de fichiers à une personne (Candidatures unifiées L5, ADR 0065 D6).
 *
 *     https://axion-ia.com/api/partage/<lienId>/<jeton>
 *
 *     jeton = base64url(HMAC-SHA256(PARTAGES_SECRET, "lien-partage:v1:" + lienId))   // 43 caractères
 *
 * Le jeton n'est stocké nulle part : le serveur le recalcule et le compare à
 * temps constant.
 *
 * 🔒 LE JETON N'EST JAMAIS ÉCRIT EN BASE (relecture sécurité, 2026-10-08). La
 * réponse (`job_application_replies.body_html` / `body_text`) et son journal
 * (`job_application_events.body`) ne portent que l'adresse MASQUÉE :
 *
 *     https://axion-ia.com/api/partage/<lienId>/lien-prive-de-telechargement
 *
 * Le vrai jeton n'est remis qu'au moment de l'envoi de l'e-mail, par le worker
 * qui envoie (`devoilerLienPrive`), et seulement pour le lien de CETTE
 * réponse. S'il ne le peut pas (clé absente, lien d'une autre réponse), la
 * réponse est marquée en échec et rien ne part avec le marqueur. Le worker a
 * donc besoin de `PARTAGES_SECRET` — la même valeur que l'application.
 * L'adresse masquée, ouverte telle quelle, est refusée (le marqueur n'a pas la
 * forme d'un jeton).
 *
 * Clé DÉDIÉE `PARTAGES_SECRET` [C2] — jamais dérivée d'`AUTH_SECRET`, dont une
 * rotation couperait tous les liens envoyés. Domaine séparé
 * (`lien-partage:v1:`) : un jeton de document (ADR 0063) ou de questionnaire
 * (ADR 0062) ne vaut jamais ici, même pour un identifiant identique.
 *
 * ⛔ Sans `PARTAGES_SECRET` (ou trop court), AUCUN lien n'est fabriqué ni
 * valide, en développement comme en production : il n'y a pas de clé de repli
 * connue qui rendrait les liens forgeables.
 *
 * Module léger (`node:crypto` seulement), sans `server-only` : il est atteint
 * par `envoyer-reponse.ts` et par le worker d'e-mails, qui dévoile le lien.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const DOMAINE = "lien-partage:v1:";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Un HMAC-SHA256 en base64url sans remplissage : 43 caractères. */
const JETON = /^[A-Za-z0-9_-]{43}$/;

/** Le préfixe public des liens (hors `[locale]`, hors `matcher` du proxy). */
export const PREFIXE_LIEN = "/api/partage";

type Env = Readonly<Record<string, string | undefined>>;

function cle(env: Env): string | null {
  const s = env["PARTAGES_SECRET"]?.trim();
  return s && s.length >= 32 ? s : null;
}

function signer(k: string, lienId: string): string {
  return createHmac("sha256", k).update(`${DOMAINE}${lienId}`).digest("base64url");
}

/** Le jeton d'un lien, ou `null` (identifiant invalide, secret absent). */
export function jetonLien(lienId: string, env: Env = process.env): string | null {
  const id = lienId.toLowerCase();
  if (!UUID.test(id)) return null;
  const k = cle(env);
  return k === null ? null : signer(k, id);
}

/** Le jeton est-il celui de CE lien ? Faux pour toute forme inattendue. */
export function jetonLienValide(lienId: string, jeton: string, env: Env = process.env): boolean {
  const id = lienId.toLowerCase();
  if (!UUID.test(id) || !JETON.test(jeton)) return false;
  const k = cle(env);
  if (k === null) return false;
  const attendu = Buffer.from(signer(k, id), "utf8");
  const recu = Buffer.from(jeton, "utf8");
  return attendu.length === recu.length && timingSafeEqual(attendu, recu);
}

/** Le chemin public, sans origine, ou `null` si aucun jeton ne peut être fabriqué. */
export function cheminLien(lienId: string, env: Env = process.env): string | null {
  const jeton = jetonLien(lienId, env);
  return jeton === null ? null : `${PREFIXE_LIEN}/${lienId.toLowerCase()}/${jeton}`;
}

/** L'adresse complète envoyée par e-mail, ou `null`. */
export function adresseLien(lienId: string, env: Env = process.env): string | null {
  const chemin = cheminLien(lienId, env);
  if (chemin === null) return null;
  const site = (env["NEXT_PUBLIC_SITE_URL"] ?? "https://axion-ia.com").replace(/\/+$/, "");
  return `${site}${chemin}`;
}

// ── L'adresse masquée (stockée) et son dévoilement (à l'envoi) ──────────────

/** Ce qui tient la place du jeton dans tout ce qui est écrit en base. */
export const MARQUEUR_JETON = "lien-prive-de-telechargement";

const MASQUEE = new RegExp(
  `${PREFIXE_LIEN}/([0-9a-fA-F-]{36})/${MARQUEUR_JETON}(?![A-Za-z0-9_-])`,
  "g",
);

/** L'adresse à écrire dans le message stocké : SANS le jeton. `null` si l'identifiant est invalide. */
export function adresseMasqueeLien(lienId: string, env: Env = process.env): string | null {
  const id = lienId.toLowerCase();
  if (!UUID.test(id)) return null;
  const site = (env["NEXT_PUBLIC_SITE_URL"] ?? "https://axion-ia.com").replace(/\/+$/, "");
  return `${site}${PREFIXE_LIEN}/${id}/${MARQUEUR_JETON}`;
}

export type CorpsDevoile =
  | { readonly ok: true; readonly html: string; readonly text: string }
  | { readonly ok: false; readonly raison: string };

/**
 * Au moment de l'envoi : remplace le marqueur du lien de CETTE réponse
 * (`lienId`) par le vrai jeton, dans le HTML et le texte. Refuse — et rien ne
 * doit partir — si un marqueur vise un autre lien, si la réponse n'a pas de
 * lien, ou si le jeton ne peut pas être fabriqué (`PARTAGES_SECRET`).
 */
export function devoilerLienPrive(
  corps: { readonly html: string; readonly text: string },
  lienId: string | null,
  env: Env = process.env,
): CorpsDevoile {
  const vises = new Set(
    [...`${corps.html}\n${corps.text}`.matchAll(MASQUEE)].map((m) => m[1]!.toLowerCase()),
  );
  if (vises.size === 0) return { ok: true, html: corps.html, text: corps.text };
  const id = lienId?.toLowerCase() ?? null;
  if (id === null || vises.size > 1 || !vises.has(id)) {
    return { ok: false, raison: "le message vise un lien privé qui n'est pas celui de la réponse" };
  }
  const jeton = jetonLien(id, env);
  if (jeton === null) {
    return { ok: false, raison: "PARTAGES_SECRET absent ou trop court : jeton impossible" };
  }
  const remplacer = (t: string) =>
    t.replace(MASQUEE, (_m, brut: string) => `${PREFIXE_LIEN}/${brut.toLowerCase()}/${jeton}`);
  const html = remplacer(corps.html);
  const text = remplacer(corps.text);
  if (html.includes(MARQUEUR_JETON) || text.includes(MARQUEUR_JETON)) {
    return { ok: false, raison: "un marqueur de lien privé est resté dans le message" };
  }
  return { ok: true, html, text };
}
