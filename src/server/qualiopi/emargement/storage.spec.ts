/**
 * Tests — storage.ts
 *
 * Deux invariants valent la peine d'être tenus par des tests, parce que les
 * violer ne se voit pas :
 *
 *  1. La fonction NE RETOURNE JAMAIS un succès silencieux. Un `null` toléré ici
 *     produirait des signatures sans image — visibles seulement à l'audit, des
 *     mois plus tard. Chaque chemin d'échec est donc vérifié comme LEVANT.
 *  2. L'empreinte porte sur l'octet RÉELLEMENT écrit sur R2. Hacher l'entrée
 *     brute passerait tous les tests naïfs et rendrait la vérification
 *     d'intégrité fausse à jamais.
 *
 * `sharp` n'est PAS mocké : la normalisation est précisément ce qui matérialise
 * la frontière RGPD art. 6 / art. 9, et un mock ne prouverait rien.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { crc32 } from "node:zlib";

vi.mock("@/lib/r2-storage", () => ({
  isR2Configured: vi.fn(),
  uploadToR2: vi.fn(),
  deleteFromR2: vi.fn(),
  existsInR2: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { isR2Configured, uploadToR2, deleteFromR2, existsInR2 } from "@/lib/r2-storage";
import * as Sentry from "@sentry/nextjs";
import {
  decoderDataUrl,
  normaliserImageSignature,
  cleImageSignature,
  storeSignatureImage,
  supprimerImageSignature,
  SignatureStockageError,
  TAILLE_MAX_ENTREE_OCTETS,
  MIME_SIGNATURE,
} from "./storage";

const mockIsR2Configured = isR2Configured as unknown as ReturnType<typeof vi.fn>;
const mockUploadToR2 = uploadToR2 as unknown as ReturnType<typeof vi.fn>;
const mockDeleteFromR2 = deleteFromR2 as unknown as ReturnType<typeof vi.fn>;
const mockExistsInR2 = existsInR2 as unknown as ReturnType<typeof vi.fn>;
const mockCapture = Sentry.captureException as unknown as ReturnType<typeof vi.fn>;

/** UUID fixe : la clé R2 n'accepte rien d'autre. */
const ID_A = "11111111-2222-4333-8444-555555555555";
const ID_B = "66666666-7777-4888-8999-aaaaaaaaaaaa";

/** Fabrique un PNG réel (pas un octet inventé : sharp doit pouvoir le décoder). */
async function pngReel(width = 300, height = 150): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } },
  })
    .png()
    .toBuffer();
}

async function dataUrlPng(width?: number, height?: number): Promise<string> {
  const buf = await pngReel(width, height);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

/**
 * Insère un chunk `tEXt` avant `IEND`.
 *
 * Fabriqué à la main parce que `sharp` refuse d'en écrire : c'est précisément
 * ce qu'un client hostile ferait, et c'est le vecteur nommé par l'en-tête de
 * `storage.ts`. Le tester avec l'API sharp aurait prouvé l'inverse de ce qu'on
 * cherche — que sharp n'en produit pas.
 */
function injecterChunkTEXt(png: Buffer, motCle: string, valeur: string): Buffer {
  const data = Buffer.concat([
    Buffer.from(motCle, "latin1"),
    Buffer.from([0]),
    Buffer.from(valeur, "latin1"),
  ]);
  const type = Buffer.from("tEXt", "latin1");
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([type, data])) >>> 0);
  const iend = png.length - 12; // longueur + type + CRC du chunk IEND final
  return Buffer.concat([
    png.subarray(0, iend),
    Buffer.concat([longueur, type, data, crc]),
    png.subarray(iend),
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
  // ⚠️ `clearAllMocks` efface les APPELS, pas les valeurs de retour : chaque
  // valeur est reposée ici, sinon elle fuit d'un `describe` à l'autre.
  mockIsR2Configured.mockReturnValue(true);
  mockUploadToR2.mockResolvedValue({ key: "k", etag: null, sizeBytes: 0 });
  mockDeleteFromR2.mockResolvedValue(undefined);
  mockExistsInR2.mockResolvedValue(false);
});

describe("decoderDataUrl", () => {
  it("refuse ce qui n'est pas une data-URL", () => {
    expect(() => decoderDataUrl("https://exemple.test/signature.png")).toThrow(
      SignatureStockageError,
    );
  });

  it("refuse une data-URL non base64", () => {
    expect(() => decoderDataUrl("data:image/png,%89PNG")).toThrow(SignatureStockageError);
  });

  it("refuse le type SVG déclaré", () => {
    // ⚠️ Ce test ne prouve QUE le filtre sur le type déclaré. La vraie défense
    // est testée plus bas (« refuse un SVG déguisé en PNG ») : celle-ci passait
    // même quand le contenu n'était jamais recoupé.
    const svg = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>").toString("base64");
    try {
      decoderDataUrl(`data:image/svg+xml;base64,${svg}`);
      expect.unreachable("le SVG aurait dû être refusé");
    } catch (err) {
      expect((err as SignatureStockageError).motif).toBe("type_non_supporte");
    }
  });

  it("refuse une charge utile vide", () => {
    try {
      decoderDataUrl("data:image/png;base64,");
      expect.unreachable("une image vide aurait dû être refusée");
    } catch (err) {
      expect((err as SignatureStockageError).motif).toBe("charge_utile_invalide");
    }
  });

  it("refuse au-delà du plafond de taille", () => {
    const gros = Buffer.alloc(TAILLE_MAX_ENTREE_OCTETS + 1, 0x41).toString("base64");
    try {
      decoderDataUrl(`data:image/png;base64,${gros}`);
      expect.unreachable("une image trop volumineuse aurait dû être refusée");
    } catch (err) {
      expect((err as SignatureStockageError).motif).toBe("trop_volumineux");
    }
  });

  it("accepte PNG et JPEG", async () => {
    const png = await dataUrlPng();
    expect(decoderDataUrl(png).mime).toBe("image/png");

    const jpeg = await sharp({
      create: { width: 20, height: 10, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .jpeg()
      .toBuffer();
    expect(decoderDataUrl(`data:image/jpeg;base64,${jpeg.toString("base64")}`).mime).toBe(
      "image/jpeg",
    );
  });

  it("marque les fautes de charge utile comme imputables au client", () => {
    try {
      decoderDataUrl("pas une data-url");
      expect.unreachable();
    } catch (err) {
      expect((err as SignatureStockageError).imputableAuClient).toBe(true);
    }
  });
});

describe("normaliserImageSignature — le contenu réel prime sur le type déclaré", () => {
  it("refuse un SVG déguisé en PNG — le type de la data-URL est écrit par le client", async () => {
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100"/></svg>`,
    );
    try {
      await normaliserImageSignature(svg);
      expect.unreachable("un SVG ne doit jamais atteindre le rasteriseur");
    } catch (err) {
      expect((err as SignatureStockageError).motif).toBe("type_non_supporte");
    }
  });

  it.each(["webp", "gif", "tiff"] as const)(
    "refuse le format %s, même décodable par sharp",
    async (format) => {
      const buf = await sharp({
        create: { width: 20, height: 10, channels: 3, background: { r: 0, g: 0, b: 0 } },
      })
        .toFormat(format)
        .toBuffer();
      await expect(normaliserImageSignature(buf)).rejects.toMatchObject({
        motif: "type_non_supporte",
      });
    },
  );

  it("applique l'orientation EXIF avant de l'effacer — sinon la feuille papier reste couchée", async () => {
    // `Orientation = 6` = « pivoter de 90° » : ce que pose tout téléphone tenu
    // à la verticale. sharp SUPPRIME l'EXIF sans l'APPLIQUER ; sans `rotate()`
    // l'image est archivée couchée, définitivement, le marqueur ayant disparu.
    const couche = await sharp({
      create: { width: 400, height: 200, channels: 3, background: { r: 5, g: 5, b: 5 } },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    expect((await sharp(couche).metadata()).orientation).toBe(6);

    // Le paysage devient portrait : sans `rotate()` la sortie resterait 400×200,
    // ce qui rend ce test discriminant plutôt que décoratif.
    const meta = await sharp(await normaliserImageSignature(couche)).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(400);
    // …et le marqueur est bien effacé après avoir été appliqué.
    expect(meta.orientation).toBeUndefined();
  });
});

describe("normaliserImageSignature — frontière RGPD", () => {
  it("n'emporte AUCUN chunk texte PNG — le vecteur exact d'une dynamique de tracé", async () => {
    // C'est LE scénario que l'art. 9 interdit : `pressure` / `tiltX` /
    // `timeStamp` voyageant dans un `tEXt`, malgré la promesse faite côté
    // client. Le test EXIF sur JPEG ne le couvre pas : la sortie étant du PNG,
    // `meta.exif` serait `undefined` même si les chunks texte étaient recopiés.
    const base = await sharp({
      create: { width: 40, height: 20, channels: 3, background: { r: 9, g: 9, b: 9 } },
    })
      .png()
      .toBuffer();
    const avecTexte = injecterChunkTEXt(base, "dyn", "pressure=0.83;tiltX=12;timeStamp=1699");

    // Le vecteur est réellement présent dans l'entrée : sans cette assertion, le
    // test passerait même si la fixture n'avait rien injecté du tout.
    expect(avecTexte.includes(Buffer.from("pressure=0.83"))).toBe(true);
    expect((await sharp(avecTexte).metadata()).format).toBe("png");

    const sortie = await normaliserImageSignature(avecTexte);
    expect(sortie.includes(Buffer.from("pressure=0.83"))).toBe(false);
    expect(sortie.includes(Buffer.from("tiltX"))).toBe(false);
  });

  it("n'emporte AUCUN EXIF porté par un PNG", async () => {
    const avecExif = await sharp({
      create: { width: 40, height: 20, channels: 3, background: { r: 9, g: 9, b: 9 } },
    })
      .png()
      .withMetadata({ exif: { IFD0: { ImageDescription: "pressure=0.83;tiltX=12" } } })
      .toBuffer();
    expect((await sharp(avecExif).metadata()).exif).toBeDefined();

    const sortie = await normaliserImageSignature(avecExif);
    expect((await sharp(sortie).metadata()).exif).toBeUndefined();
    expect(sortie.includes(Buffer.from("pressure=0.83"))).toBe(false);
  });

  it("n'emporte AUCUNE métadonnée EXIF dans la sortie", async () => {
    // Une image porteuse d'EXIF : c'est le vecteur par lequel une dynamique de
    // tracé (art. 9) pourrait voyager malgré la promesse faite côté client.
    const avecExif = await sharp({
      create: { width: 40, height: 20, channels: 3, background: { r: 10, g: 10, b: 10 } },
    })
      .withExif({ IFD0: { Software: "dynamique-de-trace-interdite" } })
      .jpeg()
      .toBuffer();
    expect((await sharp(avecExif).metadata()).exif).toBeDefined();

    const sortie = await normaliserImageSignature(avecExif);
    const meta = await sharp(sortie).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.iptc).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
  });

  it("sort toujours du PNG, quelle que soit l'entrée", async () => {
    const jpeg = await sharp({
      create: { width: 30, height: 15, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .jpeg()
      .toBuffer();
    expect((await sharp(await normaliserImageSignature(jpeg)).metadata()).format).toBe("png");
  });

  it("réduit au-delà de la largeur maximale", async () => {
    const enorme = await pngReel(3000, 400);
    const meta = await sharp(await normaliserImageSignature(enorme)).metadata();
    expect(meta.width).toBe(1200);
  });

  it("n'agrandit pas un petit tracé — agrandir n'ajoute pas d'information", async () => {
    const petit = await pngReel(120, 60);
    const meta = await sharp(await normaliserImageSignature(petit)).metadata();
    expect(meta.width).toBe(120);
    expect(meta.height).toBe(60);
  });

  it("lève sur une image illisible plutôt que de produire un objet vide", async () => {
    await expect(normaliserImageSignature(Buffer.from("ceci n'est pas une image"))).rejects.toThrow(
      SignatureStockageError,
    );
  });
});

describe("cleImageSignature", () => {
  it("partitionne par année et par genre", () => {
    expect(cleImageSignature("signatures", 2026, "abc")).toBe("emargement/2026/signatures/abc.png");
    expect(cleImageSignature("contresignatures", 2025, "xyz")).toBe(
      "emargement/2025/contresignatures/xyz.png",
    );
  });
});

describe("storeSignatureImage", () => {
  const SIGNE_AT = new Date("2025-03-04T09:30:00.000Z");

  it("LÈVE quand R2 n'est pas configuré — jamais de null silencieux", async () => {
    mockIsR2Configured.mockReturnValue(false);
    const promesse = storeSignatureImage({
      dataUrl: await dataUrlPng(),
      genre: "signatures",
      signeAt: SIGNE_AT,
    });
    await expect(promesse).rejects.toMatchObject({ motif: "r2_absent" });
    expect(mockUploadToR2).not.toHaveBeenCalled();
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it("n'impute PAS au client une panne de notre stockage", async () => {
    mockIsR2Configured.mockReturnValue(false);
    try {
      await storeSignatureImage({
        dataUrl: await dataUrlPng(),
        genre: "signatures",
        signeAt: SIGNE_AT,
      });
      expect.unreachable();
    } catch (err) {
      expect((err as SignatureStockageError).imputableAuClient).toBe(false);
    }
  });

  it("LÈVE et remonte à Sentry si l'écriture R2 échoue", async () => {
    mockUploadToR2.mockRejectedValue(new Error("R2 503"));
    await expect(
      storeSignatureImage({
        dataUrl: await dataUrlPng(),
        genre: "signatures",
        signeAt: SIGNE_AT,
      }),
    ).rejects.toMatchObject({ motif: "upload_echoue" });
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it("valide la charge utile AVANT de constater l'absence de R2", async () => {
    // Sinon un stagiaire recevrait « notre stockage est en panne » pour une
    // image qu'il n'aurait de toute façon pas fallu accepter.
    mockIsR2Configured.mockReturnValue(false);
    await expect(
      storeSignatureImage({ dataUrl: "n'importe quoi", genre: "signatures", signeAt: SIGNE_AT }),
    ).rejects.toMatchObject({ motif: "charge_utile_invalide" });
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("hache l'octet RÉELLEMENT écrit, pas la charge utile d'entrée", async () => {
    const entree = await pngReel(3000, 400); // sera redimensionné : les octets diffèrent
    const res = await storeSignatureImage({
      dataUrl: `data:image/png;base64,${entree.toString("base64")}`,
      genre: "signatures",
      signeAt: SIGNE_AT,
    });

    const [, bufferEnvoye] = mockUploadToR2.mock.calls[0] as [string, Buffer, string, unknown];
    expect(res.sha256).toBe(createHash("sha256").update(bufferEnvoye).digest("hex"));
    expect(res.sha256).not.toBe(createHash("sha256").update(entree).digest("hex"));
    expect(res.sizeBytes).toBe(bufferEnvoye.byteLength);
  });

  it("partitionne sur l'année de SIGNATURE, pas sur l'année courante", async () => {
    const res = await storeSignatureImage({
      dataUrl: await dataUrlPng(),
      genre: "signatures",
      signeAt: SIGNE_AT,
      id: ID_A,
    });
    expect(res.key).toBe(`emargement/2025/signatures/${ID_A}.png`);
    expect(mockUploadToR2).toHaveBeenCalledWith(
      `emargement/2025/signatures/${ID_A}.png`,
      expect.any(Buffer),
      MIME_SIGNATURE,
      expect.objectContaining({ sha256: res.sha256 }),
    );
  });

  it("partitionne sur l'année PARIS — le 1ᵉʳ janvier à 00 h 30 n'appartient pas à l'année passée", async () => {
    // En UTC cet instant est le 31/12/2025 : la clé tomberait sur le préfixe
    // 2025 et la purge des 5 ans effacerait l'image un an trop tôt.
    const res = await storeSignatureImage({
      dataUrl: await dataUrlPng(),
      genre: "signatures",
      signeAt: new Date("2025-12-31T23:30:00.000Z"),
      id: ID_A,
    });
    expect(res.key).toBe(`emargement/2026/signatures/${ID_A}.png`);
  });

  it("réutilise l'identifiant fourni — l'objet et la future ligne doivent se retrouver", async () => {
    const res = await storeSignatureImage({
      dataUrl: await dataUrlPng(),
      genre: "contresignatures",
      signeAt: SIGNE_AT,
      id: ID_B,
    });
    expect(res.id).toBe(ID_B);
    expect(res.key).toBe(`emargement/2025/contresignatures/${ID_B}.png`);
  });

  it("refuse un identifiant qui n'est pas un UUID — rien d'autre ne compose un chemin R2", async () => {
    await expect(
      storeSignatureImage({
        dataUrl: await dataUrlPng(),
        genre: "signatures",
        signeAt: SIGNE_AT,
        id: "../../documents/2026/facture/AXION-2026-0042",
      }),
    ).rejects.toMatchObject({ motif: "charge_utile_invalide" });
    expect(mockUploadToR2).not.toHaveBeenCalled();
  });

  it("REFUSE d'écraser un objet existant — une reprise ne doit pas détruire une preuve", async () => {
    // Scénario réel : upload OK, insertion en base échouée, l'appelant retente
    // avec le même identifiant. Écraser rendrait le `signatureSha256` déjà
    // scellé dans `selfHash` faux, définitivement et sans détection possible.
    mockExistsInR2.mockResolvedValue(true);
    await expect(
      storeSignatureImage({
        dataUrl: await dataUrlPng(),
        genre: "signatures",
        signeAt: SIGNE_AT,
        id: ID_A,
      }),
    ).rejects.toMatchObject({ motif: "collision_de_cle" });
    expect(mockUploadToR2).not.toHaveBeenCalled();
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it("génère un UUID quand l'appelant n'en fournit pas", async () => {
    const res = await storeSignatureImage({
      dataUrl: await dataUrlPng(),
      genre: "signatures",
      signeAt: SIGNE_AT,
    });
    expect(res.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.key).toBe(`emargement/2025/signatures/${res.id}.png`);
  });
});

describe("supprimerImageSignature", () => {
  const CLE_VALIDE = `emargement/2025/signatures/${ID_A}.png`;

  it.each([
    ["une facture", "invoices/2026/AXION-2026-0042.pdf"],
    ["une remontée de chemin", "emargement/../invoices/2026/AXION-2026-0042.pdf"],
    ["la racine du bucket", "backups/dump.sql"],
    ["une clé au bon préfixe mais mal formée", "emargement/2025/signatures/pas-un-uuid.png"],
  ])("REFUSE de supprimer %s — le bucket est partagé", async (_, cle) => {
    // `deleteFromR2` ne filtre rien et le bucket porte aussi les factures, devis
    // et contrats. Une purge RGPD recevant une clé mal recoupée effacerait une
    // pièce comptable.
    await expect(supprimerImageSignature(cle)).rejects.toMatchObject({
      motif: "charge_utile_invalide",
    });
    expect(mockDeleteFromR2).not.toHaveBeenCalled();
  });

  it("supprime l'objet demandé", async () => {
    await supprimerImageSignature(CLE_VALIDE);
    expect(mockDeleteFromR2).toHaveBeenCalledWith(CLE_VALIDE);
  });

  it("LÈVE si R2 est absent — un effacement RGPD cru fait mais non fait est pire que rien", async () => {
    mockIsR2Configured.mockReturnValue(false);
    await expect(supprimerImageSignature(CLE_VALIDE)).rejects.toMatchObject({ motif: "r2_absent" });
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it("LÈVE et remonte à Sentry si la suppression échoue, avec son PROPRE motif", async () => {
    // Distinct d'`upload_echoue` : sinon un tableau de bord filtrant sur ce
    // motif mélangerait des écritures ratées et des purges RGPD non faites.
    mockDeleteFromR2.mockRejectedValue(new Error("R2 500"));
    await expect(supprimerImageSignature(CLE_VALIDE)).rejects.toMatchObject({
      motif: "suppression_echouee",
    });
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });
});
