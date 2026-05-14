/**
 * Knowledge Base — 10 domaines (axes de classification).
 * SSOT : `_AUDIT/KNOWLEDGE-BASE-2026/02-SSOT.md`.
 */

import type { KbDomain } from "../../../prisma/generated/client";

export const KB_DOMAINS: readonly KbDomain[] = [
  "commercial",
  "technical",
  "legal",
  "hr",
  "product",
  "client",
  "watch",
  "internal",
  "editorial",
  "methodology",
] as const;

export const KB_DOMAIN_LABELS_FR: Record<KbDomain, string> = {
  commercial: "Commercial",
  technical: "Technique",
  legal: "Juridique",
  hr: "RH",
  product: "Produit",
  client: "Client",
  watch: "Veille",
  internal: "Interne",
  editorial: "Éditorial",
  methodology: "Méthodologie",
};

export const KB_DOMAIN_LABELS_EN: Record<KbDomain, string> = {
  commercial: "Commercial",
  technical: "Technical",
  legal: "Legal",
  hr: "HR",
  product: "Product",
  client: "Client",
  watch: "Market watch",
  internal: "Internal",
  editorial: "Editorial",
  methodology: "Methodology",
};

export function getDomainLabel(domain: KbDomain, locale: "fr" | "en"): string {
  return locale === "fr" ? KB_DOMAIN_LABELS_FR[domain] : KB_DOMAIN_LABELS_EN[domain];
}
