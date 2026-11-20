// Score IA TPE-PME — code de retrait (plan V2-10 §4.5). Module PUR, côté navigateur.
// 80 bits (`crypto.getRandomValues`), alphabet base32 de Crockford (sans caractère ambigu),
// affiché en 4 groupes de 4. Seul SHA-256(code normalisé) part au serveur : il ne voit jamais le code.

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const NB_CARACTERES = 16; // 16 × 5 bits = 80 bits
const NBSP = " ";

/** Code brut (16 caractères) tiré de `crypto.getRandomValues`. */
export function genererCode(): string {
  const octets = new Uint8Array(10); // 80 bits
  crypto.getRandomValues(octets);
  let bits = 0;
  let nb = 0;
  let out = "";
  for (const o of octets) {
    bits = (bits << 8) | o;
    nb += 8;
    while (nb >= 5) {
      out += ALPHABET[(bits >> (nb - 5)) & 31];
      nb -= 5;
    }
    bits &= (1 << nb) - 1;
  }
  return out.slice(0, NB_CARACTERES);
}

/** « ABCD EFGH JKMN PQRS » (espaces insécables). */
export function formaterCode(code: string): string {
  return (code.match(/.{1,4}/g) ?? []).join(NBSP);
}

/** Saisie tolérante : majuscules, sans espaces ni tirets, O→0, I/L→1 (convention Crockford). */
export function normaliserCode(saisie: string): string {
  return saisie
    .toUpperCase()
    .replace(/[\s -]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
}

export function codeValide(code: string): boolean {
  return code.length === NB_CARACTERES && [...code].every((c) => ALPHABET.includes(c));
}

/** SHA-256 (hex minuscule, 64 caractères) du code normalisé. */
export async function empreinteDuCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(normaliserCode(code));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
