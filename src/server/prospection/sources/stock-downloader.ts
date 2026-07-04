/**
 * Prospection — Téléchargement AUTOMATIQUE du Stock Sirene (INSEE) depuis
 * data.gouv, pour éviter le dépôt manuel du fichier.
 *
 * Les fichiers officiels sont de gros ZIP (plusieurs Go). On télécharge en flux
 * vers le disque, puis on lit le CSV DANS le zip en flux (unzipper — jamais tout
 * en mémoire ni le CSV décompressé de 30 Go sur disque). `fetch` injecté (testable).
 *
 * ⚠️ Prévoir de l'espace disque serveur (~5-10 Go temporaire, un zip à la fois).
 */

import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import path from "node:path";
import unzipper from "unzipper";
import { streamCsv, type StockSource, type StockRow } from "./stock-source";

/** URLs officielles data.gouv (« latest » — pointent vers le mois courant). */
export const INSEE_STOCK_URLS = {
  uniteLegale: "https://files.data.gouv.fr/insee-sirene/StockUniteLegale_utf8.zip",
  etablissement: "https://files.data.gouv.fr/insee-sirene/StockEtablissement_utf8.zip",
} as const;

export interface DownloadDeps {
  fetchImpl?: typeof fetch;
}

/** Télécharge une URL vers un fichier local, en flux (pas de chargement mémoire). */
export async function downloadFile(
  url: string,
  destPath: string,
  deps: DownloadDeps = {},
): Promise<void> {
  const doFetch = deps.fetchImpl ?? fetch;
  const res = await doFetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Téléchargement échoué (${res.status}) : ${url}`);
  }
  await pipeline(
    Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]),
    createWriteStream(destPath),
  );
}

export interface DownloadStockResult {
  ulZip: string;
  etZip: string;
}

/** Télécharge les 2 zips Stock (UL + établissements) dans `targetDir`. */
export async function downloadStockFiles(
  targetDir: string,
  opts: DownloadDeps & { ulUrl?: string; etUrl?: string } = {},
): Promise<DownloadStockResult> {
  const ulUrl = opts.ulUrl ?? process.env.PROSPECTION_STOCK_UL_URL ?? INSEE_STOCK_URLS.uniteLegale;
  const etUrl =
    opts.etUrl ?? process.env.PROSPECTION_STOCK_ET_URL ?? INSEE_STOCK_URLS.etablissement;
  const ulZip = path.join(targetDir, "StockUniteLegale.zip");
  const etZip = path.join(targetDir, "StockEtablissement.zip");
  await downloadFile(ulUrl, ulZip, opts);
  await downloadFile(etUrl, etZip, opts);
  return { ulZip, etZip };
}

/**
 * Source Stock à partir de fichiers ZIP : lit le CSV interne EN FLUX (unzipper
 * ne charge pas tout le zip en mémoire ; on ne matérialise jamais le CSV géant).
 */
export class ZipStockSource implements StockSource {
  constructor(
    private readonly ulZip: string | undefined,
    private readonly etZip: string | undefined,
    private readonly separator = ",",
  ) {}

  private async *streamZip(zipPath: string | undefined): AsyncGenerator<StockRow> {
    if (!zipPath) return;
    const directory = await unzipper.Open.file(zipPath);
    // Un seul CSV par zip INSEE ; repli sur la 1re entrée si l'extension diffère.
    const entry = directory.files.find((f) => /\.csv$/i.test(f.path)) ?? directory.files[0];
    if (!entry) return;
    yield* streamCsv(entry.stream(), { separator: this.separator });
  }

  iterateUniteLegale(): AsyncIterable<StockRow> {
    return this.streamZip(this.ulZip);
  }
  iterateEtablissement(): AsyncIterable<StockRow> {
    return this.streamZip(this.etZip);
  }
}
