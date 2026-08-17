// @vitest-environment node
//
// Environnement `node` : Sharp est un binding natif, il n'existe pas sous jsdom.

/**
 * Verrou GEO-091 / GEO-092 — l'EXIF était publié, GPS compris, et les photos
 * pivotées sortaient couchées (audit GEO/AEO du 2026-08-14, lot 18).
 *
 * ## Ce qui était faux, et pourquoi personne ne l'a vu
 *
 * Le pipeline appelait `.withMetadata({ orientation: 1 })` sous un commentaire
 * « RGPD CRITIQUE : strip EXIF GPS si présent (PII) ». Dans `src/lib/image-utils.ts`
 * la même ligne portait un nom de fonction encore plus affirmatif :
 * `stripExifPreserveOrientation`. Le code faisait l'inverse des deux.
 *
 *   - `withMetadata()` est documenté « Include **all** metadata (EXIF, XMP, IPTC)
 *     from the input image in the output image. The default behaviour, when
 *     withMetadata is **not** used, is to **strip all metadata**. » C'est donc son
 *     ABSENCE qui protège. L'appeler est ce qui fait fuiter.
 *   - `{ orientation: 1 }` écrasait l'indice « pivote-moi » SANS pivoter les
 *     pixels. Une photo portrait de téléphone ressortait en paysage, et le
 *     navigateur ne pouvait plus la redresser puisque l'indice avait disparu.
 *
 * 🔑 Les deux défauts sont indissociables : `metadata().width/height` sont les
 * pixels STOCKÉS (« EXIF orientation is not taken into consideration »). Corriger
 * l'EXIF sans corriger la rotation publierait des images couchées ; corriger la
 * rotation sans corriger les dimensions laisserait un mauvais ratio en base
 * (donc du CLS) et une facette `orientation` inversée.
 *
 * ## Ce que cette garde vérifie
 *
 * Elle ne relit pas le commentaire du code — elle fabrique une photo de téléphone
 * (orientation EXIF 6 + tag GPS 0x8825) et regarde ce qui SORT. Contre-épreuve
 * faite : en remettant `.withMetadata({ orientation: 1 })`, les deux premiers
 * tests rougissent.
 */

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { stripExifAndAutoOrient } from "@/lib/image-utils";

/** Tag EXIF « pointeur vers l'IFD GPS ». Sa présence = coordonnées embarquées. */
const TAG_POINTEUR_GPS = 0x8825;
/** Tag EXIF « Orientation ». */
const TAG_ORIENTATION = 0x0112;

/**
 * Lecture minimale d'un bloc EXIF : renvoie les tags de l'IFD0.
 *
 * Volontairement écrite ici plutôt que tirée d'une bibliothèque : la garde doit
 * pouvoir affirmer « ce tag précis est absent », pas « une bibliothèque n'a rien
 * trouvé ». Une dépendance qui ne saurait pas lire le bloc rendrait un test vert
 * pour la mauvaise raison.
 */
function tagsExifIfd0(buf: Buffer | undefined): { tags: number[]; gps: boolean } {
  if (!buf || buf.byteLength < 12) return { tags: [], gps: false };
  const b = Buffer.from(buf);
  const debut = b.subarray(0, 6).toString("latin1") === "Exif\0\0" ? 6 : 0;
  const ordre = b.subarray(debut, debut + 2).toString("latin1");
  if (ordre !== "II" && ordre !== "MM") return { tags: [], gps: false };
  const le = ordre === "II";
  const u16 = (o: number): number => (le ? b.readUInt16LE(o) : b.readUInt16BE(o));
  const u32 = (o: number): number => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
  const ifd0 = debut + u32(debut + 4);
  const tags: number[] = [];
  const n = u16(ifd0);
  for (let i = 0; i < n; i++) tags.push(u16(ifd0 + 2 + i * 12));
  return { tags, gps: tags.includes(TAG_POINTEUR_GPS) };
}

/**
 * Une photo de téléphone : 400×300 en mémoire, mais un tag d'orientation 6 qui
 * signifie « je suis en réalité un portrait 300×400 », plus des coordonnées GPS.
 */
async function photoTelephone(): Promise<Buffer> {
  return await sharp({
    create: { width: 400, height: 300, channels: 3, background: { r: 10, g: 90, b: 160 } },
  })
    .withMetadata({
      orientation: 6,
      exif: {
        IFD3: {
          GPSLatitudeRef: "N",
          GPSLatitude: "45/1 11/1 3000/100",
          GPSLongitudeRef: "E",
          GPSLongitude: "5/1 43/1 1200/100",
        },
      },
    })
    .jpeg()
    .toBuffer();
}

describe("l'échantillon de test est bien piégé", () => {
  it("porte réellement un GPS et une orientation non triviale", async () => {
    // 🔑 Sans cette vérification, une régression de `withExif` dans une future
    // version de Sharp rendrait tous les tests suivants verts pour la mauvaise
    // raison : on ne strippe pas un GPS qui n'a jamais été écrit.
    const meta = await sharp(await photoTelephone()).metadata();
    expect(meta.orientation, "l'orientation EXIF doit valoir 6").toBe(6);
    expect(tagsExifIfd0(meta.exif).gps, "l'echantillon doit porter un tag GPS").toBe(true);
    expect(meta.width).toBe(400);
    expect(meta.height).toBe(300);
    expect(
      meta.autoOrient,
      "Sharp doit exposer les dimensions d'affichage, distinctes des dimensions stockees",
    ).toMatchObject({ width: 300, height: 400 });
  });
});

describe("GEO-091 — aucune métadonnée ne sort du pipeline", () => {
  it("🔴 le GPS de la source ne se retrouve PAS dans le fichier livré", async () => {
    const sortie = await stripExifAndAutoOrient(sharp(await photoTelephone()))
      .resize({ width: 200 })
      .webp()
      .toBuffer();

    const meta = await sharp(sortie).metadata();
    expect(
      meta.exif?.byteLength ?? 0,
      "un EXIF non vide en sortie signifie que withMetadata() est revenu quelque part",
    ).toBe(0);
    expect(tagsExifIfd0(meta.exif).gps).toBe(false);
  });

  it("🔴 contre-épreuve : avec `withMetadata()`, le GPS traverse — c'était le défaut", async () => {
    // Ce test documente le comportement fautif. S'il devenait vert dans l'autre
    // sens (EXIF vide), c'est que Sharp aurait changé de semantique : le
    // commentaire du service devrait alors etre reecrit, pas le pipeline.
    const source = await photoTelephone();
    const fautif = await sharp(source)
      .resize({ width: 200 })
      .webp()
      .withMetadata({ orientation: 1 })
      .toBuffer();

    const meta = await sharp(fautif).metadata();
    expect(tagsExifIfd0(meta.exif).gps, "withMetadata() laisse bien passer le GPS").toBe(true);
  });
});

describe("GEO-092 — la rotation est cuite dans les pixels", () => {
  it("🔴 une photo portrait sort en portrait", async () => {
    const sortie = await stripExifAndAutoOrient(sharp(await photoTelephone()))
      .resize({ width: 200 })
      .webp()
      .toBuffer();

    const meta = await sharp(sortie).metadata();
    expect(meta.width).toBe(200);
    expect(
      meta.height,
      "300x400 redimensionne a 200 de large donne 267 de haut ; 150 signifierait " +
        "que l'image est sortie couchee",
    ).toBe(267);
  });

  it("🔴 contre-épreuve : `withMetadata({orientation:1})` la couche ET efface l'indice", async () => {
    const fautif = await sharp(await photoTelephone())
      .resize({ width: 200 })
      .webp()
      .withMetadata({ orientation: 1 })
      .toBuffer();

    const meta = await sharp(fautif).metadata();
    expect(meta.height, "paysage : l'image est couchee").toBe(150);
    const { tags } = tagsExifIfd0(meta.exif);
    const posOrientation = tags.indexOf(TAG_ORIENTATION);
    expect(
      posOrientation,
      "l'indice de rotation est toujours la, mais ecrase a 1 : le navigateur " +
        "croit l'image droite et ne la redressera pas",
    ).toBeGreaterThanOrEqual(0);
  });

  it("`autoOrient()` est sans effet sur une image déjà droite", async () => {
    // Garantit qu'on peut le poser sur tous les chemins sans se demander si
    // l'image est deja passee par un autre `autoOrient()`.
    const droite = await sharp({
      create: { width: 400, height: 300, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .jpeg()
      .toBuffer();

    const une = await sharp(droite).autoOrient().webp().toBuffer();
    const deux = await sharp(une).autoOrient().webp().toBuffer();
    const [a, b] = await Promise.all([sharp(une).metadata(), sharp(deux).metadata()]);
    expect({ w: a.width, h: a.height }).toEqual({ w: 400, h: 300 });
    expect({ w: b.width, h: b.height }).toEqual({ w: 400, h: 300 });
  });
});

describe("GEO-091 — écrire un copyright ne doit pas rapatrier l'EXIF de la source", () => {
  it("🔴 `withExif()` pose la mention voulue SANS le GPS d'origine", async () => {
    const sortie = await sharp(await photoTelephone())
      .autoOrient()
      .withExif({ IFD0: { Copyright: "© 2026 Axion-IA" } })
      .resize({ width: 200 })
      .webp()
      .toBuffer();

    const meta = await sharp(sortie).metadata();
    const { tags, gps } = tagsExifIfd0(meta.exif);
    expect(gps, "withExif() ignore l'EXIF d'entree : le GPS ne doit pas survivre").toBe(false);
    expect(tags.length, "la mention voulue, elle, doit bien etre ecrite").toBeGreaterThan(0);
  });

  it("🔴 `withExifMerge()`, lui, laisse repasser le GPS — d'où l'avertissement en commentaire", async () => {
    const fusionne = await sharp(await photoTelephone())
      .autoOrient()
      .withExifMerge({ IFD0: { Copyright: "© 2026 Axion-IA" } })
      .resize({ width: 200 })
      .webp()
      .toBuffer();

    const meta = await sharp(fusionne).metadata();
    expect(
      tagsExifIfd0(meta.exif).gps,
      "c'est precisement pourquoi le code interdit withExifMerge() sur une source externe",
    ).toBe(true);
  });
});
