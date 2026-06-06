/**
 * Utilitaires CSV/TSV internes — pas de dépendance npm externe.
 *
 * Gère :
 *   - RFC 4180 : guillemets doubles, champs avec retours à la ligne
 *   - BOM UTF-8 et UTF-16 (caractère `﻿` en string JS)
 *   - Séparateur configurable (virgule ou tabulation)
 *   - Caractères NUL parasites (UTF-16 LE mal décodé)
 *
 * Aucun import Prisma / accès DB.
 */

export interface CsvParseResult {
  headers: string[];
  rows: string[][];
}

/**
 * Parse un texte CSV/TSV et retourne les en-têtes + lignes de données.
 *
 * @param content   - Contenu textuel (BOM déjà retiré ou non, NUL tolérés).
 * @param separator - Séparateur de champs (défaut : `,`).
 */
export function parseCsvRows(content: string, separator = ","): CsvParseResult {
  // Nettoyer BOM éventuel et caractères NUL
  const texte = content.replace(/^﻿/, "").replace(/\0/g, "");

  const lignes = splitLines(texte);

  if (lignes.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = parseRow(lignes[0] ?? "", separator);
  const rows: string[][] = [];

  for (let i = 1; i < lignes.length; i++) {
    const ligne = lignes[i] ?? "";
    if (ligne.trim() === "") continue;
    rows.push(parseRow(ligne, separator));
  }

  return { headers, rows };
}

/**
 * Découpe le texte en lignes, respectant les guillemets multi-lignes RFC 4180.
 */
function splitLines(text: string): string[] {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;

    if (ch === '"') {
      // Double guillemet = guillemet littéral
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
        current += ch;
      }
    } else if ((ch === "\r" || ch === "\n") && !inQuotes) {
      // Gérer CRLF
      if (ch === "\r" && text[i + 1] === "\n") {
        i++;
      }
      lines.push(current);
      current = "";
    } else {
      current += ch;
    }
  }

  if (current.length > 0) {
    lines.push(current);
  }

  return lines;
}

/**
 * Parse une ligne CSV/TSV en tableau de champs.
 * Gère les guillemets RFC 4180 et les séparateurs configurables.
 */
export function parseRow(line: string, separator: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const ch = line[i]!;

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Guillemet échappé
        current += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i++;
      continue;
    }

    if (!inQuotes && line.slice(i, i + separator.length) === separator) {
      fields.push(current.trim());
      current = "";
      i += separator.length;
      continue;
    }

    current += ch;
    i++;
  }

  fields.push(current.trim());
  return fields;
}
