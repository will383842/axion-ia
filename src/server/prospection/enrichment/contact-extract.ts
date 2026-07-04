/**
 * Prospection — Extraction email/téléphone depuis une page (T5, pur).
 * Cible `mailto:`/`tel:` + regex sur le texte. Dédup normalisé.
 */

import { htmlToText, extractHrefs } from "./html-utils";
import { normalizeEmail, isValidEmailSyntax } from "./email";
import { normalizePhoneFR } from "./phone";

const EMAIL_TEXT_RE =
  /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/gi;
// Téléphone FR : 0X XX XX XX XX / +33… / avec séparateurs variés.
const PHONE_TEXT_RE = /(?:\+33|0033|0)\s*[1-9](?:[\s.\-]*\d){8}/g;

export interface ExtractedContacts {
  emails: string[];
  phones: string[]; // E.164
}

/** Extrait emails (mailto + texte) et téléphones (tel + texte), dédupliqués. */
export function extractContacts(html: string): ExtractedContacts {
  const emails = new Set<string>();
  const phones = new Set<string>();

  for (const href of extractHrefs(html, "mailto:")) {
    const e = normalizeEmail(href);
    if (isValidEmailSyntax(e)) emails.add(e);
  }
  for (const href of extractHrefs(html, "tel:")) {
    const p = normalizePhoneFR(href);
    if (p) phones.add(p);
  }

  const text = htmlToText(html);
  for (const m of text.matchAll(EMAIL_TEXT_RE)) {
    const e = normalizeEmail(m[0]);
    if (isValidEmailSyntax(e)) emails.add(e);
  }
  for (const m of text.matchAll(PHONE_TEXT_RE)) {
    const p = normalizePhoneFR(m[0]);
    if (p) phones.add(p);
  }

  return { emails: [...emails], phones: [...phones] };
}
