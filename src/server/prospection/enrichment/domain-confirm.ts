/**
 * Prospection — Confirmation d'appartenance du domaine au SIREN (T5, pur).
 *
 * Un domaine n'est retenu QUE si sa page mentions-légales/contact contient le
 * **SIREN** ou la **dénomination** de l'entreprise (matrice T5 #9 : un homonyme
 * sans preuve est écarté → évite la collecte déloyale + le poison de données).
 */

import type { DomainMatchMethod } from "@/lib/prospection/enums";
import { htmlToText } from "./html-utils";

function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface DomainConfirmResult {
  confirmed: boolean;
  method: DomainMatchMethod;
  confidence: number;
}

/**
 * Confirme (ou non) l'appartenance : cherche le SIREN (chiffres, tolérant aux
 * espaces) puis la dénomination normalisée dans le texte de la page.
 */
export function confirmDomainOwnership(
  html: string,
  company: { siren: string; denomination?: string | null },
): DomainConfirmResult {
  const text = htmlToText(html);
  // SIREN à FRONTIÈRE de chiffres (tolère espaces/points/insécables entre les
  // chiffres, ex. « 380 000 001 » ou le SIRET « 38000000100011 »), mais JAMAIS à
  // cheval sur deux nombres sans rapport (un téléphone/prix ne doit pas
  // « fabriquer » le SIREN par concaténation — sinon on rattache les personnes
  // scrapées à la MAUVAISE entreprise). Cf. vérif finale (data, RGPD-sensible).
  const sirenDigits = company.siren.replace(/\D/g, "");
  if (sirenDigits.length === 9) {
    const sep = "[\\s.\\u00A0]*";
    const spaced = sirenDigits.split("").join(sep);
    // SIREN seul (borné) OU SIREN suivi d'EXACTEMENT 5 chiffres NIC (= SIRET).
    const re = new RegExp(`(?<![0-9])${spaced}(?:${sep}(?:[0-9]${sep}){5})?(?![0-9])`);
    if (re.test(text)) {
      return { confirmed: true, method: "siren_on_page", confidence: 0.98 };
    }
  }
  const denom = normalizeText(company.denomination ?? "");
  // Match à la FRONTIÈRE de mot (espaces autour) — un « elis » ne doit pas matcher
  // « modelisation ». Seuil relevé à 4 caractères significatifs.
  if (denom.length >= 4 && ` ${normalizeText(text)} `.includes(` ${denom} `)) {
    return { confirmed: true, method: "denomination_on_page", confidence: 0.8 };
  }
  return { confirmed: false, method: "none", confidence: 0 };
}
