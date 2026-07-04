/**
 * Prospection — Segmentation & lignes d'export (T8, pur).
 *
 * 3 segments (04-SPEC §5) : **exploitables** (email+…), **partiels**, **à
 * compléter**. Colonnes normalisées + colonnes de conformité (source, date de
 * collecte, base légale). CSV échappé RFC-4180.
 */

import type { Contactabilite } from "@/lib/prospection/enums";

export type ExportSegment = "exploitables" | "partiels" | "a_completer";

export function segmentOfContactabilite(c: Contactabilite | null): ExportSegment {
  if (c === "exploitable") return "exploitables";
  if (c === "partiel") return "partiels";
  return "a_completer";
}

export interface ExportCompanyRow {
  siren: string;
  denomination: string | null;
  naf: string | null;
  secteur: string | null;
  taille: string | null;
  departement: string | null;
  commune: string | null;
  emailPrincipal: string | null;
  telephonePrincipal: string | null;
  contactabilite: Contactabilite | null;
  leadScore: number | null;
  source: string | null;
  lastCollectedAt: Date | null;
}

/** Colonnes de l'export (normalisées + conformité RGPD). */
export const EXPORT_COLUMNS = [
  "siren",
  "denomination",
  "naf",
  "secteur",
  "taille",
  "departement",
  "commune",
  "email",
  "telephone",
  "contactabilite",
  "lead_score",
  "source",
  "date_collecte",
  "base_legale",
] as const;

const BASE_LEGALE = "Intérêt légitime (art. 6.1.f RGPD) — prospection B2B";

function csvEscape(value: string): string {
  // Anti-injection de formule (Excel/LibreOffice) : une cellule commençant par
  // = + - @ (ou tab/CR) — dénomination Sirene contrôlée par un tiers — est
  // préfixée d'une apostrophe pour ne pas être exécutée à l'ouverture.
  let v = value;
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function fmtDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

/** Une ligne CSV (valeurs échappées) alignée sur EXPORT_COLUMNS. */
export function exportRowValues(r: ExportCompanyRow): string[] {
  return [
    r.siren,
    r.denomination ?? "",
    r.naf ?? "",
    r.secteur ?? "",
    r.taille ?? "",
    r.departement ?? "",
    r.commune ?? "",
    r.emailPrincipal ?? "",
    r.telephonePrincipal ?? "",
    r.contactabilite ?? "",
    r.leadScore != null ? String(r.leadScore) : "",
    r.source ?? "",
    fmtDate(r.lastCollectedAt),
    BASE_LEGALE,
  ];
}

/** Génère le CSV complet (header + lignes) d'un ensemble d'entreprises. */
export function buildCsv(rows: ReadonlyArray<ExportCompanyRow>): string {
  const lines = [EXPORT_COLUMNS.join(",")];
  for (const r of rows) lines.push(exportRowValues(r).map(csvEscape).join(","));
  return lines.join("\r\n");
}
