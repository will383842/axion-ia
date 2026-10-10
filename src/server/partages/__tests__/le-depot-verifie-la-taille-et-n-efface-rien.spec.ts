// @vitest-environment node

/**
 * LE DÉPÔT REVÉRIFIE LA TAILLE AUPRÈS DU STOCKAGE, ET N'EFFACE RIEN (ADR 0065, lot L4).
 *
 *  - terminer : le serveur relit les morceaux dans R2 (il ne croit pas le
 *    navigateur), refuse un trou, assemble, puis compare la taille de l'objet à
 *    l'annonce ; un écart → envoi arrêté (`abandonne`), jamais servi ;
 *  - archiver ≠ supprimer : archiver pose une date, réafficher l'ôte, aucune
 *    fonction n'appelle `delete` ; un fichier infecté ne se réaffiche pas ;
 *  - un fichier sans verdict antivirus ne se télécharge pas.
 */

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { lignes, appels, r2 } = vi.hoisted(() => ({
  lignes: new Map<string, Record<string, unknown>>(),
  appels: [] as string[],
  r2: {
    ouvrirEnvoiMorceauxR2: vi.fn(async () => "upload-1"),
    signerMorceauR2: vi.fn(
      async (_c: unknown, _k: string, _u: string, n: number) => `https://r2/${n}`,
    ),
    listerMorceauxR2: vi.fn(),
    assemblerEnvoiR2: vi.fn(async () => undefined),
    arreterEnvoiR2: vi.fn(async () => undefined),
    tailleObjetR2: vi.fn(),
    signerLectureR2: vi.fn(async () => "https://r2/lecture"),
    fluxObjetR2: vi.fn(async () => null),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    fichierPartage: {
      create: async (a: { data: Record<string, unknown> }) => {
        appels.push("create");
        lignes.set(a.data.id as string, { ...a.data });
        return a.data;
      },
      findUnique: async (a: { where: { id: string } }) => lignes.get(a.where.id) ?? null,
      update: async (a: { where: { id: string }; data: Record<string, unknown> }) => {
        appels.push(`update:${Object.keys(a.data).join(",")}`);
        const l = { ...(lignes.get(a.where.id) ?? {}), ...a.data };
        lignes.set(a.where.id, l);
        return l;
      },
      findMany: async () => [],
      delete: async () => {
        appels.push("delete");
      },
      deleteMany: async () => {
        appels.push("deleteMany");
      },
    },
  },
}));
vi.mock("@/lib/r2-storage", () => r2);
vi.mock("@/server/careers/clamav", () => ({ analyserFlux: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

import {
  adresseTelechargement,
  archiverFichier,
  commencerDepot,
  reafficherFichier,
  signerMorceaux,
  terminerDepot,
  verifierDemandeDepot,
} from "../depot";
import { TAILLE_MORCEAU_OCTETS, tailleMorceau } from "../regles";

const AUTEUR = { id: "22222222-2222-4222-8222-222222222222", nom: "Will" };
const MIO = 1024 * 1024;

beforeEach(() => {
  lignes.clear();
  appels.length = 0;
  vi.clearAllMocks();
  Object.assign(process.env, {
    R2_ACCOUNT_ID: "compte",
    R2_PARTAGES_BUCKET_NAME: "axion-ia-partages",
    R2_PARTAGES_ACCESS_KEY_ID: "cle",
    R2_PARTAGES_SECRET_ACCESS_KEY: "secret-cle",
    PARTAGES_SECRET: "x".repeat(32),
  });
});

function morceauxComplets(taille: number) {
  const n = Math.ceil(taille / TAILLE_MORCEAU_OCTETS);
  return Array.from({ length: n }, (_, i) => ({
    numero: i + 1,
    etag: `"e${i + 1}"`,
    taille: tailleMorceau(taille, i + 1),
  }));
}

async function depot(taille: number): Promise<string> {
  const r = await commencerDepot({ nom: "Rushs projet B.zip", taille, categorie: "rushs" }, AUTEUR);
  if (!r.ok) throw new Error(r.erreur);
  return r.valeur.fichierId;
}

describe("commencer", () => {
  it("la clé R2 est choisie par le serveur, sous partages/<id>/", async () => {
    const id = await depot(10 * MIO);
    expect(lignes.get(id)?.r2Cle).toBe(`partages/${id}/Rushs-projet-B.zip`);
    expect(lignes.get(id)?.etatDepot).toBe("en_cours");
    expect(lignes.get(id)?.analyse).toBe("en_attente");
  });

  it("au-delà de 200 Mo, un fichier de l'équipe naît « non analysé » (décision 7)", async () => {
    const id = await depot(300 * MIO);
    expect(lignes.get(id)?.analyse).toBe("hors_limite");
  });

  it("refuse plus de 20 Go, un fichier vide, et les catégories qu'on ne dépose pas", () => {
    const go = 1024 ** 3;
    expect(verifierDemandeDepot({ nom: "a", taille: 21 * go, categorie: "rushs" }).ok).toBe(false);
    expect(verifierDemandeDepot({ nom: "a", taille: 0, categorie: "rushs" }).ok).toBe(false);
    expect(verifierDemandeDepot({ nom: "a", taille: 1, categorie: "essai_rendu" }).ok).toBe(false);
    expect(verifierDemandeDepot({ nom: "a", taille: 1, categorie: "kit_apporteur" }).ok).toBe(
      false,
    );
    expect(verifierDemandeDepot({ nom: "a", taille: 20 * go, categorie: "lut" }).ok).toBe(true);
  });

  it("ne signe que des numéros de morceau du fichier", async () => {
    const id = await depot(2 * TAILLE_MORCEAU_OCTETS);
    expect((await signerMorceaux(id, [3])).ok).toBe(false);
    expect((await signerMorceaux(id, [0])).ok).toBe(false);
    const ok = await signerMorceaux(id, [1, 2]);
    expect(ok.ok && ok.valeur.map((m) => m.numero)).toEqual([1, 2]);
  });

  it("signe chaque morceau à SA taille exacte, le dernier compris (relecture sécurité)", async () => {
    const taille = 2 * TAILLE_MORCEAU_OCTETS + 7;
    const id = await depot(taille);
    expect((await signerMorceaux(id, [1, 3])).ok).toBe(true);
    const cle = `partages/${id}/Rushs-projet-B.zip`;
    expect(r2.signerMorceauR2).toHaveBeenCalledWith(
      expect.anything(),
      cle,
      "upload-1",
      1,
      TAILLE_MORCEAU_OCTETS,
      3600,
    );
    expect(r2.signerMorceauR2).toHaveBeenCalledWith(expect.anything(), cle, "upload-1", 3, 7, 3600);
  });
});

describe("terminer : la taille est revérifiée auprès du stockage", () => {
  it("taille conforme → disponible", async () => {
    const taille = TAILLE_MORCEAU_OCTETS + 5;
    const id = await depot(taille);
    r2.listerMorceauxR2.mockResolvedValue(morceauxComplets(taille));
    r2.tailleObjetR2.mockResolvedValue(taille);
    const r = await terminerDepot(id);
    expect(r.ok).toBe(true);
    expect(r2.assemblerEnvoiR2).toHaveBeenCalled();
    expect(lignes.get(id)?.etatDepot).toBe("disponible");
  });

  it("un morceau manquant → refus, rien d'assemblé, l'envoi reste repris", async () => {
    const taille = 2 * TAILLE_MORCEAU_OCTETS;
    const id = await depot(taille);
    r2.listerMorceauxR2.mockResolvedValue(morceauxComplets(taille).slice(1));
    const r = await terminerDepot(id);
    expect(r.ok).toBe(false);
    expect(r2.assemblerEnvoiR2).not.toHaveBeenCalled();
    expect(lignes.get(id)?.etatDepot).toBe("en_cours");
  });

  it("un morceau reçu de mauvaise taille → envoi arrêté dans R2, ligne `abandonne`, rien d'effacé", async () => {
    const taille = 2 * TAILLE_MORCEAU_OCTETS;
    const id = await depot(taille);
    const parts = morceauxComplets(taille);
    r2.listerMorceauxR2.mockResolvedValue([
      parts[0],
      { ...parts[1], taille: parts[1]!.taille + 1 },
    ]);
    const r = await terminerDepot(id);
    expect(r.ok).toBe(false);
    expect(r2.assemblerEnvoiR2).not.toHaveBeenCalled();
    expect(r2.arreterEnvoiR2).toHaveBeenCalledWith(
      expect.anything(),
      `partages/${id}/Rushs-projet-B.zip`,
      "upload-1",
    );
    expect(lignes.get(id)?.etatDepot).toBe("abandonne");
    expect(lignes.has(id)).toBe(true);
    expect(appels.filter((a) => a.startsWith("delete"))).toEqual([]);
  });

  it("taille assemblée différente de l'annonce → arrêté, jamais disponible", async () => {
    const taille = TAILLE_MORCEAU_OCTETS + 5;
    const id = await depot(taille);
    r2.listerMorceauxR2.mockResolvedValue(morceauxComplets(taille));
    r2.tailleObjetR2.mockResolvedValue(taille - 1);
    const r = await terminerDepot(id);
    expect(r.ok).toBe(false);
    expect(lignes.get(id)?.etatDepot).toBe("abandonne");
    expect(lignes.get(id)?.disponibleLe).toBeUndefined();
  });

  it("un dépôt déjà terminé ne se termine pas deux fois", async () => {
    const id = await depot(5);
    r2.listerMorceauxR2.mockResolvedValue(morceauxComplets(5));
    r2.tailleObjetR2.mockResolvedValue(5);
    expect((await terminerDepot(id)).ok).toBe(true);
    expect((await terminerDepot(id)).ok).toBe(false);
  });
});

describe("archiver ≠ supprimer", () => {
  it("archiver pose une date, réafficher l'ôte, rien n'est supprimé", async () => {
    const id = await depot(5);
    expect((await archiverFichier(id, AUTEUR)).ok).toBe(true);
    expect(lignes.get(id)?.archiveLe).toBeInstanceOf(Date);
    expect(lignes.get(id)?.archiveParId).toBe(AUTEUR.id);
    expect((await reafficherFichier(id)).ok).toBe(true);
    expect(lignes.get(id)?.archiveLe).toBeNull();
    expect(lignes.has(id)).toBe(true);
    expect(appels.filter((a) => a.startsWith("delete"))).toEqual([]);
    expect(r2.arreterEnvoiR2).not.toHaveBeenCalled();
  });

  it("un fichier infecté ne se réaffiche pas", async () => {
    const id = await depot(5);
    lignes.set(id, { ...lignes.get(id), analyse: "infecte", archiveLe: new Date() });
    const r = await reafficherFichier(id);
    expect(r.ok).toBe(false);
    expect(lignes.get(id)?.archiveLe).toBeInstanceOf(Date);
  });

  it("garde statique : aucun code de src/ ne supprime un fichier partagé ni un lien", () => {
    const fichiers = execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "src"],
      {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      },
    )
      .trim()
      .split(/\r?\n/)
      .filter((f) => /\.tsx?$/.test(f) && !/__tests__|\.(spec|test)\.tsx?$/.test(f));
    expect(fichiers.length).toBeGreaterThan(1000);
    const fautifs: string[] = [];
    for (const f of fichiers) {
      const src = readFileSync(path.join(process.cwd(), f), "utf8");
      if (
        /\b(fichierPartage|lienPartage|lienPartageFichier|lienPartageAcces)\.(delete|deleteMany)\b/.test(
          src,
        ) ||
        /DELETE\s+FROM\s+"?(fichiers_partages|liens_partage)/i.test(src)
      ) {
        fautifs.push(f);
      }
    }
    expect(fautifs).toEqual([]);
  });
});

describe("téléchargement depuis la console", () => {
  it("jamais sans verdict antivirus, jamais infecté ; « non analysé » de l'équipe autorisé", async () => {
    const id = await depot(5);
    const maj = (d: Record<string, unknown>) => lignes.set(id, { ...lignes.get(id), ...d });
    maj({ etatDepot: "disponible", analyse: "en_attente" });
    expect((await adresseTelechargement(id)).ok).toBe(false);
    maj({ analyse: "infecte" });
    expect((await adresseTelechargement(id)).ok).toBe(false);
    maj({ analyse: "hors_limite" });
    expect((await adresseTelechargement(id)).ok).toBe(true);
    maj({ analyse: "sain" });
    const r = await adresseTelechargement(id);
    expect(r.ok && r.valeur.url).toBe("https://r2/lecture");
    expect(r2.signerLectureR2).toHaveBeenLastCalledWith(
      expect.anything(),
      `partages/${id}/Rushs-projet-B.zip`,
      300,
      { nom: "Rushs projet B.zip", disposition: "attachment" },
    );
  });
});
