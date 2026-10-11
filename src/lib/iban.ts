/**
 * IBAN — validateur NEUTRE (FAC-5), extrait du dossier apporteur. Module pur.
 */

/**
 * Pays de la zone SEPA (analyse du 09/10, réseau réservé à la France) : les commissions sont
 * versées par virement SEPA, sans frais ni change ; un IBAN hors de la zone est refusé.
 */
export const PAYS_SEPA: ReadonlySet<string> = new Set([
  "AD",
  "AT",
  "BE",
  "BG",
  "CH",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "ES",
  "FI",
  "FR",
  "GB",
  "GG",
  "GI",
  "GR",
  "HR",
  "HU",
  "IE",
  "IM",
  "IS",
  "IT",
  "JE",
  "LI",
  "LT",
  "LU",
  "LV",
  "MC",
  "MT",
  "NL",
  "NO",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK",
  "SM",
  "VA",
]);

/** IBAN : forme, pays SEPA et clé de contrôle (ISO 13616, modulo 97). */
export function ibanValide(brut: string): boolean {
  const s = brut.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  if (!PAYS_SEPA.has(s.slice(0, 2))) return false;
  const r = s.slice(4) + s.slice(0, 4);
  let reste = 0;
  for (const c of r) {
    const v = c >= "A" && c <= "Z" ? (c.charCodeAt(0) - 55).toString() : c;
    for (const ch of v) reste = (reste * 10 + Number(ch)) % 97;
  }
  return reste === 1;
}
