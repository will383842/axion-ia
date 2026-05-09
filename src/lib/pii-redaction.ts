// PII redaction helpers (Sprint 24.1 / ADR 0010 — Telegram minimisation).
//
// Doctrine : on minimise le PII personnel diffusé dans les notifications Telegram
// (sous-processeur hors UE, base légale dérogation art. 49 RGPD avec
// minimisation requise). Voir `docs/adr/0010-telegram-pii-minimisation.md`.
//
// Règles :
//   - Email     → 1ʳᵉ lettre + masque + @ + domaine.       j****@acme.com
//   - Nom       → initiales avec point séparateur.          J. D.
//   - Téléphone → préserve indicatif + 4 derniers chiffres. +33 ** ** ** 56 78
//
// Ce qui RESTE diffusé (acceptable, pas du PII personnel direct ou utile métier
// pour notification ops) :
//   - companyName + companySector (entreprise — pas PII personnel direct)
//   - dates / prix / interventionType / participantsCount
//   - IDs UUID (non-déréférençables sans accès admin DB)
//
// L'admin garde l'accès complet aux PII via la console (/admin/options + /admin/submissions).

const EMAIL_RE = /^([^@]+)@([^@]+)$/;

export function redactEmail(raw: string | null | undefined): string {
  if (!raw) return "(?)";
  const m = raw.trim().toLowerCase().match(EMAIL_RE);
  if (!m) return "(?)";
  const [, local, domain] = m as unknown as [string, string, string];
  if (local.length <= 1) return `*@${domain}`;
  return `${local[0]}****@${domain}`;
}

export function redactName(raw: string | null | undefined): string {
  if (!raw) return "(?)";
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "(?)";
  return parts.map((p) => `${(p[0] ?? "").toUpperCase()}.`).join(" ");
}

export function redactPhone(raw: string | null | undefined): string {
  if (!raw) return "(?)";
  const digits = raw.replace(/[^\d+]/g, "");
  // Indicatif country code (préserve `+33`, `+372`, `+1` …) si présent.
  let prefix = "";
  let rest = digits;
  if (digits.startsWith("+")) {
    const m = digits.match(/^(\+\d{1,3})(.*)$/);
    if (m) {
      prefix = m[1] ?? "";
      rest = m[2] ?? "";
    }
  }
  if (rest.length <= 4) return `${prefix}**`;
  const masked = rest.slice(0, -4).replace(/\d/g, "*");
  const tail = rest.slice(-4);
  return `${prefix} ${masked.match(/.{1,2}/g)?.join(" ") ?? masked} ${tail.match(/.{1,2}/g)?.join(" ") ?? tail}`.trim();
}

/**
 * Compose une ligne « contact » prête à coller dans un message Telegram.
 * Format : "J. D. (j****@acme.com)" — minimisation par défaut.
 */
export function redactContactLine(
  name: string | null | undefined,
  email: string | null | undefined,
): string {
  return `${redactName(name)} (${redactEmail(email)})`;
}
