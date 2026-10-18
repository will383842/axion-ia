/**
 * SCHÉMA DES VIDÉOS DU SITE CONTRE UN VRAI POSTGRES
 * (`pnpm test:integration tests/integration/videos/schema`).
 *
 * Chaque cas vit dans SA transaction, ANNULÉE : la base reste vide.
 * Sans `DATABASE_URL`, ce fichier ÉCHOUE — il ne se saute pas.
 */
import { describe, expect, it } from "vitest";
import { PrismaClient } from "../../../prisma/generated/client";

const prisma = new PrismaClient();

class Annulation extends Error {}

/** Exécute `fn` dans une transaction toujours annulée. */
async function dansUneTransactionAnnulee(fn: (tx: PrismaClient) => Promise<void>): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      await fn(tx as unknown as PrismaClient);
      throw new Annulation();
    });
  } catch (e) {
    if (!(e instanceof Annulation)) throw e;
  }
}

function video(slug: string, studioVideoId: string) {
  const maintenant = new Date();
  return {
    studioVideoId,
    version: 1,
    slug,
    theme: "automatisation",
    titre: "Un titre de vidéo suffisamment long",
    description: "d".repeat(100),
    resume: "r".repeat(400),
    aRetenir: ["a", "b", "c"],
    questions: [],
    fichiers: {},
    dureeSecondes: 60,
    lienType: "service",
    lienChemin: "/fr/implementation",
    corpsSha256: "a".repeat(64),
    publieeLe: maintenant,
    modifieeLe: maintenant,
  };
}

describe("site_videos / site_video_receptions", () => {
  it("DATABASE_URL est posée", () => {
    expect(process.env.DATABASE_URL, "DATABASE_URL manquante").toBeTruthy();
  });

  it("crée une vidéo : statut `publiee` par défaut, chapitres `[]` par défaut", async () => {
    await dansUneTransactionAnnulee(async (tx) => {
      const v = await tx.siteVideo.create({ data: video("une-video", "vs_00000001") });
      expect(v.statut).toBe("publiee");
      expect(v.chapitres).toEqual([]);
      expect(v.retireeLe).toBeNull();
      expect(v.iaVoixGeneree).toBe(false);
    });
  });

  it("le slug est unique", async () => {
    await dansUneTransactionAnnulee(async (tx) => {
      await tx.siteVideo.create({ data: video("meme-slug", "vs_00000001") });
      await expect(
        tx.siteVideo.create({ data: video("meme-slug", "vs_00000002") }),
      ).rejects.toThrow();
    });
  });

  it("studio_video_id est unique", async () => {
    await dansUneTransactionAnnulee(async (tx) => {
      await tx.siteVideo.create({ data: video("slug-a", "vs_00000001") });
      await expect(tx.siteVideo.create({ data: video("slug-b", "vs_00000001") })).rejects.toThrow();
    });
  });

  it("le nonce du journal est unique", async () => {
    const ligne = (nonce: string) => ({
      nonce,
      methode: "POST",
      chemin: "/api/interne/videos",
      horodatage: 1_800_000_000,
      corpsSha256: "b".repeat(64),
      reponseStatut: 201,
      reponseCorps: { ok: true },
    });
    await dansUneTransactionAnnulee(async (tx) => {
      await tx.siteVideoReception.create({ data: ligne("0".repeat(32)) });
      await expect(tx.siteVideoReception.create({ data: ligne("0".repeat(32)) })).rejects.toThrow();
    });
  });

  it("les cas annulés ne laissent aucune ligne de test", async () => {
    expect(
      await prisma.siteVideo.count({ where: { studioVideoId: { startsWith: "vs_0000000" } } }),
    ).toBe(0);
    expect(await prisma.siteVideoReception.count({ where: { nonce: "0".repeat(32) } })).toBe(0);
  });
});
