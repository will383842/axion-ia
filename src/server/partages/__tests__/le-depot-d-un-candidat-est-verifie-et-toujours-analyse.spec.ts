// @vitest-environment node

/**
 * LE FICHIER RENVOYÉ PAR UN CANDIDAT (L5b) — vérifié, rattaché, TOUJOURS analysé.
 *
 *  - il naît `personne`, catégorie « essai rendu », hors bibliothèque, rattaché
 *    au lien qui l'a reçu, « en attente » d'analyse quelle que soit sa taille ;
 *  - son type vient de l'extension, jamais du navigateur ;
 *  - à la fin, le serveur relit les PREMIERS OCTETS de l'objet assemblé : s'ils
 *    ne sont pas ceux d'une vidéo ou d'un ZIP, l'envoi est arrêté, jamais servi ;
 *  - l'antivirus analyse un fichier de candidat même au-delà de 200 Mo (au
 *    contraire d'un fichier de l'équipe) ; antivirus coupé → reste en attente.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { lignes, r2, clamav } = vi.hoisted(() => ({
  lignes: new Map<string, Record<string, unknown>>(),
  r2: {
    ouvrirEnvoiMorceauxR2: vi.fn(async () => "upload-1"),
    signerMorceauR2: vi.fn(async () => "https://r2/1"),
    listerMorceauxR2: vi.fn(),
    assemblerEnvoiR2: vi.fn(async () => undefined),
    arreterEnvoiR2: vi.fn(async () => undefined),
    tailleObjetR2: vi.fn(),
    debutObjetR2: vi.fn(),
    signerLectureR2: vi.fn(async () => "https://r2/lecture"),
    fluxObjetR2: vi.fn(async () => (async function* () {})()),
  },
  clamav: { analyserFlux: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    fichierPartage: {
      create: async (a: { data: Record<string, unknown> }) => {
        lignes.set(a.data.id as string, { ...a.data });
        return a.data;
      },
      findUnique: async (a: { where: { id: string } }) => lignes.get(a.where.id) ?? null,
      update: async (a: { where: { id: string }; data: Record<string, unknown> }) => {
        const l = { ...(lignes.get(a.where.id) ?? {}), ...a.data };
        lignes.set(a.where.id, l);
        return l;
      },
      findMany: async () => [],
    },
  },
}));
vi.mock("@/lib/r2-storage", () => r2);
vi.mock("@/server/careers/clamav", () => clamav);
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

import {
  analyserFichierPartage,
  commencerDepotPersonne,
  signerMorceaux,
  terminerDepot,
} from "../depot";
import { TAILLE_MORCEAU_OCTETS, tailleMorceau } from "../regles";

const LIEN = "11111111-1111-4111-8111-111111111111";
const MP4 = new Uint8Array([
  0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 2, 0,
]);
const EXE = new Uint8Array([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0, 0xff, 0xff, 0, 0]);
const MIO = 1024 * 1024;

beforeEach(() => {
  lignes.clear();
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

async function commencer(taille: number, nom = "Ma version.mp4"): Promise<string> {
  const r = await commencerDepotPersonne({ nom, taille, entete: MP4 }, LIEN);
  if (!r.ok) throw new Error(r.erreur);
  return r.valeur.fichierId;
}

describe("commencer (candidat)", () => {
  it("naît personne, essai rendu, hors bibliothèque, rattaché au lien, en attente même à 3 Go", async () => {
    const id = await commencer(3000 * MIO);
    expect(lignes.get(id)).toMatchObject({
      origine: "personne",
      categorie: "essai_rendu",
      dansBibliotheque: false,
      lienDepotId: LIEN,
      analyse: "en_attente",
      etatDepot: "en_cours",
      typeMime: "video/mp4",
      r2Cle: `partages/${id}/Ma-version.mp4`,
    });
    expect(r2.ouvrirEnvoiMorceauxR2).toHaveBeenCalledWith(
      expect.anything(),
      `partages/${id}/Ma-version.mp4`,
      "video/mp4",
    );
  });

  it("plus de 4 Go → refusé sans rien ouvrir dans le stockage ni écrire", async () => {
    const r = await commencerDepotPersonne(
      { nom: "v.mp4", taille: 4 * 1024 ** 3 + 1, entete: MP4 },
      LIEN,
    );
    expect(r.ok).toBe(false);
    expect(r2.ouvrirEnvoiMorceauxR2).not.toHaveBeenCalled();
    expect(lignes.size).toBe(0);
  });
});

describe("terminer (candidat) : les premiers octets sont relus dans le stockage", () => {
  it("une vraie vidéo → disponible, puis analysée", async () => {
    const taille = TAILLE_MORCEAU_OCTETS + 5;
    const id = await commencer(taille);
    r2.listerMorceauxR2.mockResolvedValue(morceauxComplets(taille));
    r2.tailleObjetR2.mockResolvedValue(taille);
    r2.debutObjetR2.mockResolvedValue(MP4);
    const r = await terminerDepot(id);
    expect(r.ok).toBe(true);
    expect(lignes.get(id)?.etatDepot).toBe("disponible");
  });

  it("des octets d'exécutable sous un nom .mp4 → arrêté, jamais disponible", async () => {
    const id = await commencer(5);
    r2.listerMorceauxR2.mockResolvedValue(morceauxComplets(5));
    r2.tailleObjetR2.mockResolvedValue(5);
    r2.debutObjetR2.mockResolvedValue(EXE);
    const r = await terminerDepot(id);
    expect(r.ok).toBe(false);
    expect(lignes.get(id)?.etatDepot).toBe("abandonne");
    expect(lignes.get(id)?.disponibleLe).toBeUndefined();
  });
});

describe("antivirus : un fichier de candidat est TOUJOURS analysé", () => {
  function disponible(taille: number, origine: "personne" | "equipe") {
    const id = "77777777-7777-4777-8777-777777777777";
    lignes.set(id, {
      id,
      origine,
      etatDepot: "disponible",
      analyse: "en_attente",
      r2Cle: `partages/${id}/v.mp4`,
      tailleOctets: BigInt(taille),
      disponibleLe: new Date(),
    });
    return id;
  }

  it("3 Go → passé à l'antivirus ; sain → visible", async () => {
    const id = disponible(3000 * MIO, "personne");
    clamav.analyserFlux.mockResolvedValue({ issue: "sain" });
    await analyserFichierPartage(id);
    expect(clamav.analyserFlux).toHaveBeenCalled();
    expect(lignes.get(id)?.analyse).toBe("sain");
  });

  it("antivirus coupé → reste « en attente », donc invisible", async () => {
    const id = disponible(3000 * MIO, "personne");
    clamav.analyserFlux.mockResolvedValue({ issue: "indisponible", raison: "connexion refusée" });
    await analyserFichierPartage(id);
    expect(lignes.get(id)?.analyse).toBe("en_attente");
  });
});

describe("dépôt public : chaque morceau à sa taille (relecture sécurité, 2026-10-08)", () => {
  it("chaque morceau d'un fichier de candidat est signé à SA taille exacte", async () => {
    const taille = 2 * TAILLE_MORCEAU_OCTETS + 11;
    const id = await commencer(taille);
    const r = await signerMorceaux(id, [1, 2, 3]);
    expect(r.ok).toBe(true);
    const tailles = r2.signerMorceauR2.mock.calls.map((c) => (c as unknown[])[4]);
    expect(tailles).toEqual([TAILLE_MORCEAU_OCTETS, TAILLE_MORCEAU_OCTETS, 11]);
  });

  it("terminer : un morceau de mauvaise taille → envoi arrêté dans R2, `abandonne`, ligne gardée", async () => {
    const taille = TAILLE_MORCEAU_OCTETS + 11;
    const id = await commencer(taille);
    const parts = morceauxComplets(taille);
    r2.listerMorceauxR2.mockResolvedValue([parts[0], { ...parts[1]!, taille: 4 * MIO }]);
    const r = await terminerDepot(id);
    expect(r.ok).toBe(false);
    expect(r2.arreterEnvoiR2).toHaveBeenCalledWith(
      expect.anything(),
      `partages/${id}/Ma-version.mp4`,
      "upload-1",
    );
    expect(r2.assemblerEnvoiR2).not.toHaveBeenCalled();
    expect(lignes.get(id)).toMatchObject({ origine: "personne", etatDepot: "abandonne" });
  });
});
