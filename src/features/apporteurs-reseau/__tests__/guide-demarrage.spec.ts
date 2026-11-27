import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ r2: vi.fn(), configure: true, signaler: vi.fn() }));
vi.mock("@/lib/r2-storage", () => ({
  isR2Configured: () => h.configure,
  getObjectBufferR2: (...a: unknown[]) => h.r2(...a),
}));
vi.mock("../signaler", () => ({ signalerErreurReseau: (...a: unknown[]) => h.signaler(...a) }));

import { CLE_R2_GUIDE, CLE_R2_LIVRET, lireLivret } from "../documents-prives";
import { NOM_FICHIER_GUIDE, lireGuideDemarrage } from "../guide-demarrage";

// Le guide de démarrage : un PDF PRIVÉ qui porte des montants. Le dépôt GitHub est public : il
// n'y est PLUS, il est lu depuis R2 seulement, et servi par la route contrôlée de l'espace.
const racine = process.cwd();
const INTERDITS = [
  /gr[e]noble/i,
  /aucun\s+gain\s+garanti/i,
  /salari[ée]/i,
  /obj[e]ctif/i,
  /sans\s+discussion/i,
  /5\s+fois/i,
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  h.configure = true;
});

describe("le guide de démarrage", () => {
  it("n'est jamais dans le dépôt : ni sous private/, ni sous public/", () => {
    expect(existsSync(join(racine, "private/apporteurs/guide-demarrage-apporteur.pdf"))).toBe(
      false,
    );
    const sousPublic = readdirSync(join(racine, "public"), { recursive: true, encoding: "utf-8" });
    expect(sousPublic.filter((f) => /guide-demarrage/i.test(f))).toEqual([]);
  });

  it("sa source lisible ne contient aucun mot interdit", () => {
    const html = join(racine, "docs/apporteurs/guide-demarrage-apporteur.html");
    expect(existsSync(html) && statSync(html).size > 1000).toBe(true);
    const t = readFileSync(html, "utf-8");
    for (const re of INTERDITS) expect(t).not.toMatch(re);
  });

  it("lireGuideDemarrage lit R2 à la clé fixe et rend le PDF", async () => {
    h.r2.mockResolvedValue(Buffer.from("%PDF-1.7 guide"));
    const buf = await lireGuideDemarrage();
    expect(h.r2).toHaveBeenCalledWith(CLE_R2_GUIDE);
    expect(buf?.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("le nom montré à l'apporteur est sûr", () => {
    expect(NOM_FICHIER_GUIDE).toMatch(/^[A-Za-z0-9-]+\.pdf$/);
  });
});

describe("🔴 lecture R2 : repli sans crash", () => {
  it("objet absent : null, alerte journalisée et signalée, aucune exception", async () => {
    h.r2.mockResolvedValue(null);
    expect(await lireGuideDemarrage()).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("absent"));
    expect(h.signaler).toHaveBeenCalledTimes(1);
  });

  it("objet vide ou qui n'est pas un PDF : null", async () => {
    h.r2.mockResolvedValue(Buffer.alloc(0));
    expect(await lireLivret()).toBeNull();
    h.r2.mockResolvedValue(Buffer.from("<html>pas un pdf"));
    expect(await lireLivret()).toBeNull();
    expect(h.r2).toHaveBeenCalledWith(CLE_R2_LIVRET);
  });

  it("R2 qui lève ou non configuré : null, rien n'est levé", async () => {
    h.r2.mockRejectedValue(new Error("réseau"));
    expect(await lireGuideDemarrage()).toBeNull();
    h.configure = false;
    expect(await lireGuideDemarrage()).toBeNull();
  });
});
