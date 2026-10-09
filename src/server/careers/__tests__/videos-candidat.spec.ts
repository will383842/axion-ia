// @vitest-environment node
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const racine = mkdtempSync(join(tmpdir(), "videos-"));
process.env.CV_STORAGE_PATH = racine;

const lignes = new Map<string, Record<string, unknown>>();
let trouvee: Record<string, unknown> | null = null;
vi.mock("@/lib/prisma", () => {
  const prisma = {
    jobApplicationVideo: {
      update: async (a: { where: { id: string }; data: Record<string, unknown> }) => {
        lignes.set(a.where.id, { ...(lignes.get(a.where.id) ?? {}), ...a.data });
      },
      findUnique: async () => trouvee,
    },
    jobApplication: { update: async () => ({}) },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };
  return { prisma };
});
const analyser = vi.fn();
vi.mock("@/server/careers/clamav", () => ({
  analyserFichier: (...a: unknown[]) => analyser(...a),
}));
vi.mock("@/features/admin-job-applications/journal", () => ({ consignerEvenement: vi.fn() }));

import { VIDEO_MORCEAU_OCTETS } from "@/lib/careers/videos";
import {
  cheminVideo,
  dossierVideos,
  ecrireMorceau,
  analyserVideo,
  finaliserVideo,
  supprimerVideosCandidature,
} from "../videos-candidat";

const APP = "11111111-1111-4111-8111-111111111111";
const VID = "22222222-2222-4222-8222-222222222222";
const mp4 = (taille: number) => {
  const b = Buffer.alloc(taille, 7);
  Buffer.from([0, 0, 0, 0x20]).copy(b, 0);
  Buffer.from("ftypisom").copy(b, 4);
  return b;
};

beforeEach(() => {
  lignes.clear();
  trouvee = null;
  rmSync(join(racine, "videos"), { recursive: true, force: true });
});
afterAll(() => rmSync(racine, { recursive: true, force: true }));

describe("dépôt par morceaux", () => {
  it("écrit les morceaux dans l'ordre, accepte un renvoi, refuse un trou", async () => {
    const taille = VIDEO_MORCEAU_OCTETS + 10;
    const fichier = mp4(taille);
    const v = { id: VID, applicationId: APP, taille, octetsRecus: 0 };
    const m0 = fichier.subarray(0, VIDEO_MORCEAU_OCTETS);
    const m1 = fichier.subarray(VIDEO_MORCEAU_OCTETS);

    expect(await ecrireMorceau(v, 1, m1)).toEqual({ ok: false, raison: "trou" });
    expect(await ecrireMorceau(v, 0, m0)).toEqual({ ok: true, octetsRecus: VIDEO_MORCEAU_OCTETS });
    // renvoi du morceau 0 après une coupure : accepté, rien de réécrit
    expect(await ecrireMorceau({ ...v, octetsRecus: VIDEO_MORCEAU_OCTETS }, 0, m0)).toEqual({
      ok: true,
      octetsRecus: VIDEO_MORCEAU_OCTETS,
    });
    expect(await ecrireMorceau({ ...v, octetsRecus: VIDEO_MORCEAU_OCTETS }, 1, m1)).toEqual({
      ok: true,
      octetsRecus: taille,
    });
    expect(readFileSync(`${cheminVideo(APP, VID)}.part`).equals(fichier)).toBe(true);
  });

  it("refuse un morceau qui dépasse la taille annoncée", async () => {
    expect(
      await ecrireMorceau(
        { id: VID, applicationId: APP, taille: 5, octetsRecus: 0 },
        0,
        Buffer.alloc(6),
      ),
    ).toEqual({ ok: false, raison: "depasse" });
  });

  it("🔴 un identifiant forgé ne devient jamais un chemin", () => {
    expect(() => dossierVideos("../../etc")).toThrow();
    expect(() => cheminVideo(APP, "../passwd")).toThrow();
  });
});

describe("fin d'envoi", () => {
  it("vidéo réelle → passe en analyse (et part à l'antivirus)", async () => {
    analyser.mockResolvedValue({ issue: "indisponible", raison: "test" });
    const f = mp4(100);
    await ecrireMorceau({ id: VID, applicationId: APP, taille: 100, octetsRecus: 0 }, 0, f);
    expect(
      await finaliserVideo({ id: VID, applicationId: APP, taille: 100, octetsRecus: 100 }),
    ).toEqual({
      ok: true,
    });
    expect(lignes.get(VID)).toMatchObject({
      statut: "analyse",
      etatFerme: "analyse",
      mime: "video/mp4",
    });
    expect(existsSync(cheminVideo(APP, VID))).toBe(true);
  });

  it("🔴 un faux fichier est REJETÉ et effacé avant l'antivirus", async () => {
    const faux = Buffer.from("MZ\u0090\u0000 ceci est un exécutable renommé");
    await ecrireMorceau(
      { id: VID, applicationId: APP, taille: faux.length, octetsRecus: 0 },
      0,
      faux,
    );
    expect(
      await finaliserVideo({
        id: VID,
        applicationId: APP,
        taille: faux.length,
        octetsRecus: faux.length,
      }),
    ).toEqual({ ok: false, raison: "format" });
    expect(lignes.get(VID)).toMatchObject({ statut: "rejetee", etatFerme: "rejetee" });
    expect(existsSync(`${cheminVideo(APP, VID)}.part`)).toBe(false);
  });

  it("incomplet → refusé", async () => {
    expect(
      await finaliserVideo({ id: VID, applicationId: APP, taille: 100, octetsRecus: 40 }),
    ).toEqual({
      ok: false,
      raison: "incomplet",
    });
  });
});

describe("L12 — verdict de l'antivirus : les deux colonnes d'état bougent ensemble", () => {
  const enAnalyse = () => ({
    id: VID,
    applicationId: APP,
    statut: "analyse",
    nomOriginal: "demo.mp4",
    taille: 100,
  });

  it("sain → disponible, en texte ET en liste fermée", async () => {
    trouvee = enAnalyse();
    analyser.mockResolvedValue({ issue: "sain" });
    await analyserVideo(VID);
    expect(lignes.get(VID)).toMatchObject({ statut: "disponible", etatFerme: "disponible" });
  });

  it("infecté → rejetee, en texte ET en liste fermée", async () => {
    trouvee = enAnalyse();
    analyser.mockResolvedValue({ issue: "infecte", signature: "Eicar-Test" });
    await analyserVideo(VID);
    expect(lignes.get(VID)).toMatchObject({ statut: "rejetee", etatFerme: "rejetee" });
  });
});

describe("effacement RGPD", () => {
  it("efface le dossier entier de la candidature, sans lever s'il n'existe pas", async () => {
    await ecrireMorceau(
      { id: VID, applicationId: APP, taille: 10, octetsRecus: 0 },
      0,
      Buffer.alloc(10),
    );
    await supprimerVideosCandidature(APP);
    expect(existsSync(dossierVideos(APP))).toBe(false);
    await expect(supprimerVideosCandidature(APP)).resolves.toBeUndefined();
    await expect(supprimerVideosCandidature("pas-un-uuid")).resolves.toBeUndefined();
  });
});
