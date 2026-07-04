/**
 * Prospection — Abstraction de la source Stock Sirene (T3).
 *
 * Le téléchargement du Stock (fichiers CSV ~4 Go, MAJ mensuelle) est abstrait
 * derrière `StockSource` : en test = fichier local (fixture), en prod = download
 * data.gouv. Streaming ligne-à-ligne (jamais de chargement mémoire complet).
 * Stub-aware : au build `stub.invalid`, aucune I/O réseau.
 */

import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import type { Readable } from "node:stream";

/** Une ligne du Stock, indexée par nom de colonne (header CSV). */
export type StockRow = Record<string, string>;

export interface StockSource {
  /** Itère les unités légales (SIREN). Vide si la source n'en fournit pas. */
  iterateUniteLegale(): AsyncIterable<StockRow>;
  /** Itère les établissements (SIRET). Vide si la source n'en fournit pas. */
  iterateEtablissement(): AsyncIterable<StockRow>;
}

/** Parse une ligne CSV (séparateur `,`, guillemets `"` doublés). */
export function parseCsvLine(line: string, separator = ","): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === separator) {
      fields.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Stream un flux (texte ou gzip) en objets `StockRow` (1re ligne = header).
 * Exporté pour réutilisation par toute source basée fichier/HTTP.
 */
export async function* streamCsv(
  stream: Readable,
  opts: { gzip?: boolean; separator?: string | undefined } = {},
): AsyncGenerator<StockRow> {
  const input = opts.gzip ? stream.pipe(createGunzip()) : stream;
  const rl = createInterface({ input, crlfDelay: Infinity });
  let header: string[] | null = null;
  for await (const rawLine of rl) {
    // Retire un éventuel BOM UTF-8 en tête de fichier (sinon la 1re colonne du
    // header deviendrait "siren" → toutes les lignes seraient invalides).
    const line = header === null ? rawLine.replace(/^\uFEFF/, "") : rawLine;
    if (line.trim() === "") continue;
    const fields = parseCsvLine(line, opts.separator ?? ",");
    if (header === null) {
      header = fields.map((h) => h.trim());
      continue;
    }
    const row: StockRow = {};
    for (let i = 0; i < header.length; i++) {
      const key = header[i];
      if (key !== undefined) row[key] = fields[i] ?? "";
    }
    yield row;
  }
}

/** Source basée sur des fichiers CSV locaux (test = fixture ; prod = fichier téléchargé). */
export class LocalFileStockSource implements StockSource {
  constructor(
    private readonly paths: {
      uniteLegale?: string | undefined;
      etablissement?: string | undefined;
    },
    private readonly opts: { separator?: string | undefined } = {},
  ) {}

  private async *streamFile(path: string | undefined): AsyncGenerator<StockRow> {
    if (!path) return;
    const gzip = path.endsWith(".gz");
    yield* streamCsv(createReadStream(path), { gzip, separator: this.opts.separator });
  }

  iterateUniteLegale(): AsyncIterable<StockRow> {
    return this.streamFile(this.paths.uniteLegale);
  }

  iterateEtablissement(): AsyncIterable<StockRow> {
    return this.streamFile(this.paths.etablissement);
  }
}

/** Vrai si l'environnement de build stub est actif (pas d'I/O réseau). */
export function isBuildStub(): boolean {
  return (
    process.env.DATABASE_URL?.includes("stub.invalid") === true ||
    process.env.REDIS_URL?.includes("stub.invalid") === true
  );
}

/** Source vide (aucune ligne) — utilisée au build stub. */
export class EmptyStockSource implements StockSource {
  async *iterateUniteLegale(): AsyncGenerator<StockRow> {
    // volontairement vide
  }
  async *iterateEtablissement(): AsyncGenerator<StockRow> {
    // volontairement vide
  }
}
