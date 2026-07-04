import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { ZipStockSource, downloadFile, INSEE_STOCK_URLS } from "./stock-downloader";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "stock-dl-"));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("ZipStockSource", () => {
  it("lit le CSV interne d'un zip EN FLUX (pas tout en mémoire)", async () => {
    const zip = new JSZip();
    zip.file(
      "StockUniteLegale_utf8.csv",
      "siren,denominationUniteLegale\n380000001,ACME\n380000002,BETA\n",
    );
    const buf = await zip.generateAsync({ type: "nodebuffer" });
    const zipPath = path.join(dir, "ul.zip");
    writeFileSync(zipPath, buf);

    const source = new ZipStockSource(zipPath, undefined);
    const rows: Array<Record<string, string>> = [];
    for await (const r of source.iterateUniteLegale()) rows.push(r);

    expect(rows).toHaveLength(2);
    expect(rows[0]!.siren).toBe("380000001");
    expect(rows[1]!.denominationUniteLegale).toBe("BETA");
  });

  it("zip absent → 0 ligne (pas d'erreur)", async () => {
    const source = new ZipStockSource(undefined, undefined);
    const rows = [];
    for await (const r of source.iterateUniteLegale()) rows.push(r);
    expect(rows).toHaveLength(0);
  });
});

describe("downloadFile", () => {
  it("écrit le flux téléchargé sur disque (fetch mocké)", async () => {
    const fetchImpl = (async () =>
      new Response("contenu-fichier", { status: 200 })) as unknown as typeof fetch;
    const dest = path.join(dir, "out.txt");
    await downloadFile("https://exemple/insee.zip", dest, { fetchImpl });
    expect(readFileSync(dest, "utf8")).toBe("contenu-fichier");
  });

  it("throw si le téléchargement échoue (404)", async () => {
    const fetchImpl = (async () =>
      new Response("nope", { status: 404 })) as unknown as typeof fetch;
    await expect(
      downloadFile("https://exemple/x.zip", path.join(dir, "x"), { fetchImpl }),
    ).rejects.toThrow(/404/);
  });
});

describe("INSEE_STOCK_URLS", () => {
  it("pointe vers data.gouv (open data officiel)", () => {
    expect(INSEE_STOCK_URLS.uniteLegale).toMatch(/files\.data\.gouv\.fr.*StockUniteLegale/);
    expect(INSEE_STOCK_URLS.etablissement).toMatch(/files\.data\.gouv\.fr.*StockEtablissement/);
  });
});
