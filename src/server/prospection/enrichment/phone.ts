/**
 * Prospection — Normalisation & validation de téléphones FR (T5, pur).
 * E.164 FR (`+33…`). Rejette surtaxés (08xx) et formats invalides.
 */

/** Normalise un numéro FR en E.164 (`+33XXXXXXXXX`), ou `null` si invalide. */
export function normalizePhoneFR(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.replace(/[^\d+]/g, "");
  // Formats internationaux
  if (s.startsWith("0033")) s = "+33" + s.slice(4);
  else if (s.startsWith("+33")) s = "+33" + s.slice(3);
  else if (s.startsWith("33") && s.length === 11) s = "+33" + s.slice(2);
  else if (s.startsWith("0") && s.length === 10) s = "+33" + s.slice(1);
  else return null;

  // +33 suivi de 9 chiffres, 1er chiffre ∈ 1-9 (0 réservé).
  if (!/^\+33[1-9]\d{8}$/.test(s)) return null;
  return s;
}

/** Vrai si numéro FR plausible et non surtaxé (08 = surtaxé/spécial). */
export function isValidPhoneFR(raw: string | null | undefined): boolean {
  const e164 = normalizePhoneFR(raw);
  if (!e164) return false;
  const firstDigit = e164.charAt(3); // après +33
  if (firstDigit === "8") return false; // 08xx surtaxé
  return true;
}

/** Statut de vérification téléphone. */
export function phoneVerifStatus(raw: string | null | undefined): "e164_ok" | "invalide" {
  return isValidPhoneFR(raw) ? "e164_ok" : "invalide";
}
