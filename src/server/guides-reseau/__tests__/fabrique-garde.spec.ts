// @vitest-environment node
// G3 — gardes structurelles : aucun module de la file n'importe fabrique-pdf ; imports sans effet ; stockage sûr.
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  readdirSync,
  readFileSync,
  statSync,
  mkdtempSync,
  mkdirSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? fichiers(p) : [p];
  });
}
afterEach(() => vi.unstubAllEnvs());

describe("imports", () => {
  it("aucun module de src/server/queue n'importe fabrique-pdf, guide-pdf ni le stockage des guides", () => {
    for (const f of fichiers(path.join(process.cwd(), "src/server/queue"))) {
      if (!/\.tsx?$/.test(f)) continue;
      expect(readFileSync(f, "utf8"), f).not.toMatch(
        /fabrique-pdf|guide-pdf|stockage-guides|guideReseauVersion|telechargement-version/,
      );
    }
  });
  it("importer les modules avec les URL factices du build ne touche ni base, ni R2, ni polices, ni secrets", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://stub:stub@stub.invalid:5432/stub");
    vi.stubEnv("REDIS_URL", "redis://stub.invalid:6379");
    vi.stubEnv("SKIP_ENV_VALIDATION", "true");
    vi.resetModules();
    const f = await import("../fabrique-pdf");
    await import("../stockage-guides");
    await import("../telechargement-version");
    await import("@/app/api/interne/guides-reseau/contenu/route");
    await import("@/app/api/interne/guides-reseau/versions/route");
    await import("@/app/api/guides-reseau/fichier/route");
    expect(typeof f.deposerContenu).toBe("function");
    // Éteint : une demande n'atteint jamais la base factice.
    expect(process.env.GUIDES_RESEAU_FABRIQUE_ENABLED).toBeUndefined();
  });
});

describe("stockage : compartiment R2 et volume", () => {
  it("le compartiment des sauvegardes est refusé (même configuré), le dédié accepté", async () => {
    const { cibleGuidesR2 } = await import("../fabrique-config");
    const base = {
      R2_ACCOUNT_ID: "acc",
      R2_GUIDES_ACCESS_KEY_ID: "k",
      R2_GUIDES_SECRET_ACCESS_KEY: "s",
    };
    for (const b of ["axion-ia-backups", "axion-ia-backups-immutable", "mes-sauvegardes-x"]) {
      expect(cibleGuidesR2({ ...base, R2_GUIDES_BUCKET_NAME: b })).toBeNull();
    }
    expect(
      cibleGuidesR2({ ...base, R2_GUIDES_BUCKET_NAME: "gros", R2_BUCKET_NAME: "gros" }),
    ).toBeNull();
    expect(cibleGuidesR2({ ...base, R2_GUIDES_BUCKET_NAME: "axion-ia-guides" })?.bucket).toBe(
      "axion-ia-guides",
    );
    expect(cibleGuidesR2({ ...base })).toBeNull();
  });
  it("stockage « r2 » mal configuré = pas de stockage ; mode implicite = aucun", async () => {
    const { ouvrirStockage } = await import("../stockage-guides");
    expect(
      ouvrirStockage({ GUIDES_RESEAU_STOCKAGE: "r2", R2_GUIDES_BUCKET_NAME: "axion-ia-backups" }),
    ).toBeNull();
    expect(ouvrirStockage({})).toBeNull();
    expect(ouvrirStockage({ GUIDES_RESEAU_STOCKAGE: "autre" })).toBeNull();
  });
  it("volume : « .. » et préfixe voisin refusés ; dépôt et relecture dans la racine", async () => {
    const { cheminSousRacine, ouvrirStockage } = await import("../stockage-guides");
    const racine = mkdtempSync(path.join(tmpdir(), "guides-"));
    expect(cheminSousRacine(racine, "../secret.pdf")).toBeNull();
    expect(cheminSousRacine(racine, "guides-reseau/../../x.pdf")).toBeNull();
    expect(cheminSousRacine(racine, racine + "-voisin/x.pdf")).toBeNull();
    expect(cheminSousRacine(racine, "guides-reseau/gde-a/v1.pdf")).toBe(
      path.join(racine, "guides-reseau/gde-a/v1.pdf"),
    );
    const s = ouvrirStockage({ GUIDES_RESEAU_STOCKAGE: "volume", GUIDES_RESEAU_VOLUME: racine })!;
    await s.deposer("guides-reseau/gde-essai-01/v1.pdf", Buffer.from("%PDF-1.4 ok"));
    expect(await s.taille("guides-reseau/gde-essai-01/v1.pdf")).toBe(11);
    expect(await s.taille("guides-reseau/gde-essai-01/v2.pdf")).toBeNull();
    await expect(s.deposer("../evasion.pdf", Buffer.from("x"))).rejects.toThrow();
  });
  it("volume : un lien symbolique n'est ni écrit ni lu", async () => {
    const { ouvrirStockage, cheminLisibleVolume } = await import("../stockage-guides");
    const racine = mkdtempSync(path.join(tmpdir(), "guides-"));
    const dehors = mkdtempSync(path.join(tmpdir(), "dehors-"));
    writeFileSync(path.join(dehors, "v1.pdf"), "secret");
    mkdirSync(path.join(racine, "guides-reseau"));
    symlinkSync(dehors, path.join(racine, "guides-reseau", "gde-piege-01"));
    const env = { GUIDES_RESEAU_STOCKAGE: "volume", GUIDES_RESEAU_VOLUME: racine };
    expect(await cheminLisibleVolume("guides-reseau/gde-piege-01/v1.pdf", env)).toBeNull();
    const s = ouvrirStockage(env)!;
    await expect(
      s.deposer("guides-reseau/gde-piege-01/v2.pdf", Buffer.from("x")),
    ).rejects.toThrow();
    expect(await s.taille("guides-reseau/gde-piege-01/v1.pdf")).toBeNull();
  });
});

describe("lien signé du volume", () => {
  it("valide 10 min, lié au code et à la version, altération refusée", async () => {
    const { signerLienFichier, verifierLienFichier } = await import("../lien-fichier-guide");
    const secret = "k".repeat(40);
    const t = 1_800_000_000;
    const { e, s } = signerLienFichier(secret, "gde-essai-01", 2, t);
    expect(e - t).toBe(600);
    expect(verifierLienFichier(secret, "gde-essai-01", 2, e, s, t + 10)).toBe(true);
    expect(verifierLienFichier(secret, "gde-essai-01", 3, e, s, t + 10)).toBe(false);
    expect(verifierLienFichier(secret, "gde-autre-02", 2, e, s, t + 10)).toBe(false);
    expect(verifierLienFichier(secret, "gde-essai-01", 2, e, s, e + 1)).toBe(false);
    expect(verifierLienFichier(secret, "gde-essai-01", 2, e + 100, s, t)).toBe(false);
    expect(verifierLienFichier("z".repeat(40), "gde-essai-01", 2, e, s, t)).toBe(false);
    expect(verifierLienFichier(secret, "gde-essai-01", 2, e, "pas-hex", t)).toBe(false);
  });
  it("le secret des liens est distinct de celui de la signature, ≥ 32 caractères", async () => {
    const { secretFichierGuide } = await import("../fabrique-config");
    const long = "a".repeat(40);
    expect(
      secretFichierGuide({ GUIDES_RESEAU_FICHIER_SECRET: long, GUIDES_RESEAU_HMAC_SECRET: long }),
    ).toBeNull();
    expect(secretFichierGuide({ GUIDES_RESEAU_FICHIER_SECRET: "court" })).toBeNull();
    expect(secretFichierGuide({ GUIDES_RESEAU_FICHIER_SECRET: long })).toBe(long);
  });
});
