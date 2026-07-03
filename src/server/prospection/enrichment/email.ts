/**
 * Prospection — Validation & matching d'emails (T5, pur sauf MX injecté).
 *
 * Validation GRATUITE : syntaxe RFC-ish + MX DNS (resolver injecté → testable).
 * Marque les emails de rôle (contact@/info@…). Matching nominatif déterministe
 * (prenom.nom@, pnom@, nom@) → rattachement à une `CompanyPerson` + confiance.
 */

import type { VerifStatus } from "@/lib/prospection/enums";

const EMAIL_RE =
  /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)$/i;

const ROLE_LOCALPARTS = new Set([
  "contact",
  "info",
  "infos",
  "accueil",
  "commercial",
  "commerciale",
  "administration",
  "admin",
  "direction",
  "rh",
  "recrutement",
  "sav",
  "support",
  "hello",
  "bonjour",
  "secretariat",
  "compta",
  "comptabilite",
  "facturation",
]);

/** Minuscule + trim + retrait du tag `+alias` (dédup). */
export function normalizeEmail(raw: string): string {
  const e = raw.trim().toLowerCase();
  const at = e.indexOf("@");
  if (at < 0) return e;
  const local = e.slice(0, at).replace(/\+.*$/, "");
  return `${local}@${e.slice(at + 1)}`;
}

export function isValidEmailSyntax(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function emailLocalPart(email: string): string {
  const e = normalizeEmail(email);
  const at = e.indexOf("@");
  return at < 0 ? e : e.slice(0, at);
}

export function emailDomain(email: string): string {
  const e = normalizeEmail(email);
  const at = e.indexOf("@");
  return at < 0 ? "" : e.slice(at + 1);
}

/** Email générique de rôle (gardé mais marqué `role`, non nominatif). */
export function isRoleEmail(email: string): boolean {
  return ROLE_LOCALPARTS.has(emailLocalPart(email));
}

export interface MxResolver {
  resolveMx(domain: string): Promise<{ exchange: string }[]>;
}

/**
 * Valide un email : syntaxe → MX DNS (resolver injecté). Retourne le statut de
 * vérification. Fail-soft : si le resolver jette, on reste `verified_syntax`.
 */
export async function verifyEmail(email: string, resolver: MxResolver): Promise<VerifStatus> {
  const norm = normalizeEmail(email);
  if (!isValidEmailSyntax(norm)) return "invalid";
  const role = isRoleEmail(norm);
  try {
    const mx = await resolver.resolveMx(emailDomain(norm));
    if (mx.length === 0) return role ? "role" : "verified_syntax";
    return role ? "role" : "mx_ok";
  } catch {
    return role ? "role" : "verified_syntax";
  }
}

/** Vrai si le statut compte comme « email valide MX-OK » (07-DECISIONS Q2). */
export function isMxOk(status: VerifStatus): boolean {
  return status === "mx_ok";
}

function stripAccents(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/**
 * Matching nominatif déterministe email ↔ personne. Retourne une confiance 0-1
 * (0 = pas de match). Patterns : `prenom.nom@`, `pnom@`, `prenomnom@`, `nom@`.
 */
export function matchEmailToPerson(
  email: string,
  person: { nom: string; prenoms?: string | null },
): number {
  const local = stripAccents(emailLocalPart(email));
  const nom = stripAccents(person.nom);
  if (!nom || !local) return 0;
  const firstPrenom = stripAccents((person.prenoms ?? "").split(/\s+/)[0] ?? "");
  const p = firstPrenom;
  const initial = p.slice(0, 1);

  if (p && (local === `${p}.${nom}` || local === `${p}${nom}`)) return 0.95; // prenom.nom / prenomnom
  if (p && initial && (local === `${initial}.${nom}` || local === `${initial}${nom}`)) return 0.85; // p.nom / pnom
  if (p && (local === `${nom}.${p}` || local === `${nom}${p}`)) return 0.8; // nom.prenom
  if (local === nom) return 0.5; // nom seul (ambigu)
  return 0;
}
