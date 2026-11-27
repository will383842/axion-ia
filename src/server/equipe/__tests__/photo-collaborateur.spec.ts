/**
 * @vitest-environment node
 */
import { mkdtempSync, existsSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  tm: { findUnique: vi.fn(), updateMany: vi.fn() },
  ev: { create: vi.fn() },
}));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
vi.mock("@/lib/prisma", () => {
  const prisma = {
    teamMember: m.tm,
    teamMemberEvent: m.ev,
    $transaction: async (cb: (tx: unknown) => unknown) => cb(prisma),
  };
  return { prisma };
});

const racine = mkdtempSync(join(tmpdir(), "equipe-photo-"));
process.env["TEAM_PHOTO_PRIVATE_PATH"] = join(racine, "prive");
process.env["TEAM_PHOTO_PUBLIC_PATH"] = join(racine, "public");

import {
  deposerPhotoCollaborateur,
  retirerPhotoCollaborateur,
  traiterPhoto,
} from "../photo-collaborateur";

const ID = "11111111-1111-4111-8111-111111111111";
const NOTE = "Accord reçu par message le 20/11, copie conservée";

async function image(
  largeur: number,
  hauteur: number,
  format: "jpeg" | "png" | "webp" = "jpeg",
  withExif = false,
): Promise<Buffer> {
  let p = sharp({
    create: { width: largeur, height: hauteur, channels: 3, background: { r: 200, g: 80, b: 40 } },
  });
  if (withExif) {
    p = p.withExif({ IFD0: { Copyright: "secret-copyright" }, IFD3: { GPSLatitudeRef: "N" } });
  }
  return p[format]().toBuffer();
}

const membre = (over: Record<string, unknown> = {}) => ({
  id: ID,
  slug: "julie",
  firstName: "Julie",
  status: "publie",
  photoKind: "avatar",
  photoStoragePath: null,
  photoUrl256: null,
  photoUrl1024: null,
  photoConsentAt: new Date("2026-11-01"),
  consentNote: null,
  erasureRequestedAt: null,
  updatedAt: new Date("2026-11-02"),
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.tm.updateMany.mockResolvedValue({ count: 1 });
  m.ev.create.mockResolvedValue({});
});
afterAll(() => rmSync(racine, { recursive: true, force: true }));

describe("traiterPhoto", () => {
  it("refuse un fichier dont les octets ne sont pas une image JPEG/PNG/WebP", async () => {
    const r = await traiterPhoto(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"));
    expect(r).toEqual({ ok: false, erreur: expect.stringMatching(/JPEG, PNG ou WebP/) });
  });
  it("refuse un faux .jpg qui est un GIF", async () => {
    const gif = await sharp({
      create: { width: 500, height: 500, channels: 3, background: "#fff" },
    })
      .gif()
      .toBuffer();
    expect((await traiterPhoto(gif)).ok).toBe(false);
  });
  it("refuse au-delà de 8 Mo", async () => {
    const gros = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(8 * 1024 * 1024)]);
    const r = await traiterPhoto(gros);
    expect(r).toEqual({ ok: false, erreur: expect.stringMatching(/8 Mo/) });
  });
  it("refuse une image de moins de 400 px de côté", async () => {
    const r = await traiterPhoto(await image(399, 800));
    expect(r).toEqual({ ok: false, erreur: expect.stringMatching(/400 px/) });
  });
  it.each(["jpeg", "png", "webp"] as const)("accepte %s et rend deux WebP carrés", async (fmt) => {
    const r = await traiterPhoto(await image(900, 600, fmt));
    if (!r.ok) throw new Error(r.erreur);
    const [a, b] = await Promise.all([sharp(r.v256).metadata(), sharp(r.v1024).metadata()]);
    expect([a.format, a.width, a.height]).toEqual(["webp", 256, 256]);
    expect([b.format, b.width, b.height]).toEqual(["webp", 600, 600]);
  });
  it("retire toutes les métadonnées (EXIF, GPS)", async () => {
    const source = await image(800, 800, "jpeg", true);
    expect((await sharp(source).metadata()).exif).toBeDefined();
    const r = await traiterPhoto(source);
    if (!r.ok) throw new Error(r.erreur);
    for (const v of [r.v256, r.v1024]) {
      const meta = await sharp(v).metadata();
      expect(meta.exif).toBeUndefined();
      expect(meta.icc).toBeUndefined();
      expect(v.includes(Buffer.from("secret-copyright"))).toBe(false);
    }
  });
});

describe("deposerPhotoCollaborateur", () => {
  it("écrit l'original en privé, les variantes en public, bascule en « reelle » et trace", async () => {
    m.tm.findUnique.mockResolvedValue(membre());
    const r = await deposerPhotoCollaborateur({
      memberId: ID,
      octets: await image(800, 800),
      acteur: "admin-1",
    });
    expect(r.ok).toBe(true);
    const data = m.tm.updateMany.mock.calls[0]![0].data;
    expect(data.photoKind).toBe("reelle");
    expect(data.photoAlt).toBe("Photo de Julie");
    expect(data.photoUrl256).toMatch(/^\/api\/equipe\/photo\/[a-f0-9]{32}\/256$/);
    expect(data.photoUrl1024).toMatch(/^\/api\/equipe\/photo\/[a-f0-9]{32}\/1024$/);
    expect(data.photoStoragePath.startsWith(join(racine, "prive"))).toBe(true);
    expect(data.photoStoragePath.startsWith(join(racine, "public"))).toBe(false);
    expect(existsSync(data.photoStoragePath)).toBe(true);
    const jeton = /photo\/([a-f0-9]{32})\//.exec(data.photoUrl256)![1]!;
    expect(existsSync(join(racine, "public", `${jeton}-256.webp`))).toBe(true);
    expect(existsSync(join(racine, "public", `${jeton}-1024.webp`))).toBe(true);
    expect(m.ev.create.mock.calls[0]![0].data).toMatchObject({
      memberId: ID,
      action: "photo_deposee",
      actor: "admin-1",
    });
    expect(JSON.stringify(m.ev.create.mock.calls[0]![0].data)).not.toMatch(
      /photo-collab|\/prive\//,
    );
    expect(m.revalidatePath).toHaveBeenCalledWith("/fr/equipe/julie");
    expect(m.revalidatePath).toHaveBeenCalledWith("/fr/equipe");
  });

  it("refuse sans consentement photo ni note de preuve, et n'écrit rien", async () => {
    m.tm.findUnique.mockResolvedValue(membre({ photoConsentAt: null }));
    const avant = existsSync(join(racine, "public"))
      ? readdirSync(join(racine, "public")).length
      : 0;
    const r = await deposerPhotoCollaborateur({
      memberId: ID,
      octets: await image(800, 800),
      acteur: "admin-1",
    });
    expect(r).toEqual({ ok: false, erreur: expect.stringMatching(/accord/i) });
    expect(m.tm.updateMany).not.toHaveBeenCalled();
    expect(readdirSync(join(racine, "public")).length).toBe(avant);
  });

  it("enregistre le consentement photo (version + note) quand la note de preuve est fournie", async () => {
    m.tm.findUnique.mockResolvedValue(membre({ photoConsentAt: null }));
    const r = await deposerPhotoCollaborateur({
      memberId: ID,
      octets: await image(800, 800),
      acteur: "admin-1",
      consentementConsole: { note: NOTE },
    });
    expect(r.ok).toBe(true);
    const data = m.tm.updateMany.mock.calls[0]![0].data;
    expect(data.photoConsentAt).toBeInstanceOf(Date);
    expect(data.photoConsentVersion).toEqual(expect.any(String));
    expect(data.consentNote).toContain(NOTE);
  });

  it("remplace : les anciens fichiers sont supprimés, les nouveaux créés", async () => {
    m.tm.findUnique.mockResolvedValue(membre());
    await deposerPhotoCollaborateur({ memberId: ID, octets: await image(800, 800), acteur: "a" });
    const premier = m.tm.updateMany.mock.calls[0]![0].data;
    m.tm.findUnique.mockResolvedValue(
      membre({
        photoKind: "reelle",
        photoStoragePath: premier.photoStoragePath,
        photoUrl256: premier.photoUrl256,
        photoUrl1024: premier.photoUrl1024,
      }),
    );
    const r = await deposerPhotoCollaborateur({
      memberId: ID,
      octets: await image(700, 900, "png"),
      acteur: "a",
    });
    expect(r.ok).toBe(true);
    const second = m.tm.updateMany.mock.calls[1]![0].data;
    expect(second.photoUrl256).not.toBe(premier.photoUrl256);
    expect(existsSync(premier.photoStoragePath)).toBe(false);
    const ancien = /photo\/([a-f0-9]{32})\//.exec(premier.photoUrl256)![1]!;
    expect(existsSync(join(racine, "public", `${ancien}-256.webp`))).toBe(false);
    expect(existsSync(second.photoStoragePath)).toBe(true);
  });

  it("si la base refuse l'écriture, les fichiers neufs sont retirés", async () => {
    m.tm.findUnique.mockResolvedValue(membre());
    m.tm.updateMany.mockResolvedValue({ count: 0 });
    const avant = readdirSync(join(racine, "public")).length;
    const r = await deposerPhotoCollaborateur({
      memberId: ID,
      octets: await image(800, 800),
      acteur: "a",
    });
    expect(r.ok).toBe(false);
    expect(readdirSync(join(racine, "public")).length).toBe(avant);
  });

  it("refuse une fiche avec demande d'effacement, une fiche absente, un id invalide", async () => {
    m.tm.findUnique.mockResolvedValue(membre({ erasureRequestedAt: new Date() }));
    const octets = await image(800, 800);
    expect((await deposerPhotoCollaborateur({ memberId: ID, octets, acteur: "a" })).ok).toBe(false);
    m.tm.findUnique.mockResolvedValue(null);
    expect((await deposerPhotoCollaborateur({ memberId: ID, octets, acteur: "a" })).ok).toBe(false);
    expect((await deposerPhotoCollaborateur({ memberId: "../x", octets, acteur: "a" })).ok).toBe(
      false,
    );
  });

  it("texte alternatif personnalisé, nettoyé", async () => {
    m.tm.findUnique.mockResolvedValue(membre());
    await deposerPhotoCollaborateur({
      memberId: ID,
      octets: await image(800, 800),
      acteur: "a",
      alt: "  Julie devant un écran  ",
    });
    expect(m.tm.updateMany.mock.calls[0]![0].data.photoAlt).toBe("Julie devant un écran");
  });
});

describe("retirerPhotoCollaborateur", () => {
  it("supprime variantes et original, remet l'avatar, retire le consentement photo, trace", async () => {
    m.tm.findUnique.mockResolvedValue(membre());
    await deposerPhotoCollaborateur({ memberId: ID, octets: await image(800, 800), acteur: "a" });
    const d = m.tm.updateMany.mock.calls[0]![0].data;
    m.tm.findUnique.mockResolvedValue(
      membre({
        photoKind: "reelle",
        photoStoragePath: d.photoStoragePath,
        photoUrl256: d.photoUrl256,
        photoUrl1024: d.photoUrl1024,
      }),
    );
    m.revalidatePath.mockClear();
    const r = await retirerPhotoCollaborateur({ memberId: ID, acteur: "admin-1" });
    expect(r.ok).toBe(true);
    expect(m.tm.updateMany.mock.calls[1]![0].data).toMatchObject({
      photoKind: "avatar",
      photoStoragePath: null,
      photoUrl256: null,
      photoUrl1024: null,
      photoAlt: null,
      photoConsentAt: null,
      photoConsentVersion: null,
    });
    expect(existsSync(d.photoStoragePath)).toBe(false);
    const jeton = /photo\/([a-f0-9]{32})\//.exec(d.photoUrl256)![1]!;
    expect(existsSync(join(racine, "public", `${jeton}-256.webp`))).toBe(false);
    expect(existsSync(join(racine, "public", `${jeton}-1024.webp`))).toBe(false);
    expect(m.ev.create.mock.calls.at(-1)![0].data).toMatchObject({ action: "photo_retiree" });
    expect(m.revalidatePath).toHaveBeenCalledWith("/fr/equipe/julie");
    expect(m.revalidatePath).toHaveBeenCalledWith("/fr/equipe");
  });

  it("ne supprime jamais un chemin hors du dossier privé (valeur falsifiée en base)", async () => {
    const hors = join(racine, "hors-zone.txt");
    const { writeFileSync } = await import("node:fs");
    writeFileSync(hors, "x");
    m.tm.findUnique.mockResolvedValue(
      membre({
        photoKind: "reelle",
        photoStoragePath: hors,
        photoUrl256: "/api/equipe/photo/../../etc/256",
      }),
    );
    await retirerPhotoCollaborateur({ memberId: ID, acteur: "a" });
    expect(existsSync(hors)).toBe(true);
  });

  it("accord photo sans fichier : le retrait efface l'accord", async () => {
    m.tm.findUnique.mockResolvedValue(membre());
    const r = await retirerPhotoCollaborateur({ memberId: ID, acteur: "a" });
    expect(r.ok).toBe(true);
    expect(m.tm.updateMany.mock.calls[0]![0].data.photoConsentAt).toBeNull();
  });

  it("ni photo ni accord : réponse claire, aucune écriture", async () => {
    m.tm.findUnique.mockResolvedValue(membre({ photoConsentAt: null }));
    const r = await retirerPhotoCollaborateur({ memberId: ID, acteur: "a" });
    expect(r.ok).toBe(false);
    expect(m.tm.updateMany).not.toHaveBeenCalled();
  });
});
