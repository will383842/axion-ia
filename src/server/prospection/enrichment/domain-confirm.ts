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
  const digitsOnly = text.replace(/\D/g, "");
  if (company.siren && digitsOnly.includes(company.siren)) {
    return { confirmed: true, method: "siren_on_page", confidence: 0.98 };
  }
  const denom = normalizeText(company.denomination ?? "");
  if (denom.length >= 4 && normalizeText(text).includes(denom)) {
    return { confirmed: true, method: "denomination_on_page", confidence: 0.8 };
  }
  return { confirmed: false, method: "none", confidence: 0 };
}
