// @vitest-environment node
// (a) Le dépôt sur le volume n'écrit RIEN une fois le rendu abandonné (délai de 60 s dépassé). Disque temporaire, aucun réseau.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, readdir, stat } from "node:fs/promises";
import os from "node:os";
import { readdirSync } from "node:fs";
import path from "node:path";
import { ouvrirStockage } from "../stockage-guides";

const r2 = vi.hoisted(() => ({ envois: [] as { entree: unknown; options: unknown }[] }));
vi.mock("@/lib/r2-storage", () => ({
  clientR2Cible: () => ({
    send: (entree: unknown, options: { abortSignal?: AbortSignal } = {}) => {
      r2.envois.push({ entree, options });
      return new Promise((_resolve, rejeter) => {
        options.abortSignal?.addEventListener("abort", () => rejeter(new Error("annule")));
      });
    },
  }),
  tailleObjetR2: async () => null,
}));

let racine = "";
beforeEach(async () => {
  racine = await mkdtemp(path.join(os.tmpdir(), "guides-abandon-"));
});
afterEach(async () => {
  await rm(racine, { recursive: true, force: true });
});
const env = () => ({ GUIDES_RESEAU_STOCKAGE: "volume", GUIDES_RESEAU_VOLUME: racine });

async function fichiers(dir: string): Promise<string[]> {
  const sortie: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const chemin = path.join(dir, e.name);
    if (e.isDirectory()) sortie.push(...(await fichiers(chemin)));
    else sortie.push(chemin);
  }
  return sortie;
}

describe("stockage volume — abandon", () => {
  it("abandonné AVANT le dépôt : aucun fichier, aucun temporaire", async () => {
    const st = ouvrirStockage(env());
    expect(st?.mode).toBe("volume");
    await st!.deposer("gde-essai-01/v1.pdf", Buffer.from("%PDF-"), () => true);
    expect(await fichiers(racine)).toEqual([]);
  });
  it("sans abandon : le fichier est bien rangé", async () => {
    const st = ouvrirStockage(env());
    await st!.deposer("gde-essai-01/v1.pdf", Buffer.from("%PDF-"), () => false);
    expect((await stat(path.join(racine, "gde-essai-01/v1.pdf"))).size).toBe(5);
  });
  it("abandonné APRÈS writeFile (faux au 1er appel, vrai au 2e) : NI fichier final NI .tmp-*", async () => {
    const st = ouvrirStockage(env());
    let appels = 0;
    await st!.deposer("gde-essai-01/v1.pdf", Buffer.from("%PDF-"), () => ++appels > 1);
    expect(appels).toBeGreaterThanOrEqual(2);
    expect(await fichiers(racine)).toEqual([]);
  });
  it("deux dépôts de la même clé n'ont jamais le même nom temporaire", async () => {
    const st = ouvrirStockage(env());
    // Relevé direct : on observe le répertoire pendant le 2e contrôle.
    const vus: string[] = [];
    for (let i = 0; i < 2; i++) {
      let appels = 0;
      await st!.deposer("gde-essai-01/v1.pdf", Buffer.from("%PDF-"), () => {
        appels++;
        // 2e contrôle : le temporaire existe, on le relève de façon synchrone avant son retrait.
        if (appels === 2) vus.push(...readdirSync(path.join(racine, "gde-essai-01")));
        return appels > 1;
      });
    }
    expect(vus).toHaveLength(2);
    expect(new Set(vus).size).toBe(2);
    expect(vus.every((n) => /\.tmp-.+/.test(n))).toBe(true);
  });
});

describe("stockage R2 — abandon (faux client, aucun réseau)", () => {
  const envR2 = () => ({
    GUIDES_RESEAU_STOCKAGE: "r2",
    R2_ACCOUNT_ID: "compte",
    R2_GUIDES_BUCKET_NAME: "guides-essai",
    R2_GUIDES_ACCESS_KEY_ID: "cle",
    R2_GUIDES_SECRET_ACCESS_KEY: "secret",
  });
  beforeEach(() => {
    r2.envois.length = 0;
  });
  it("abandonné avant l'envoi : aucun PUT", async () => {
    const st = ouvrirStockage(envR2());
    expect(st?.mode).toBe("r2");
    await st!.deposer("guides-reseau/gde-essai-01/v1.pdf", Buffer.from("%PDF-"), () => true);
    expect(r2.envois).toHaveLength(0);
  });
  it("le PUT déjà parti reçoit le signal : l'abandon l'ANNULE", async () => {
    const st = ouvrirStockage(envR2());
    const controleur = new AbortController();
    const depot = st!.deposer(
      "guides-reseau/gde-essai-01/v1.pdf",
      Buffer.from("%PDF-"),
      () => false,
      controleur.signal,
    );
    const resultat = depot.then(
      () => "fini",
      (e: Error) => e.message,
    );
    await vi.waitFor(() => expect(r2.envois).toHaveLength(1));
    expect((r2.envois[0]!.options as { abortSignal?: AbortSignal }).abortSignal).toBe(
      controleur.signal,
    );
    controleur.abort();
    expect(await resultat).toBe("annule");
  });
});
