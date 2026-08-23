/**
 * Console éditoriale — tests du stockage des médias (critères 3 à 5).
 *
 * Deux règles du plan se vérifient ici, et ce sont des règles de FOND, pas
 * des détails d'implémentation :
 *
 *   - le §5 : « les rushes ne passent jamais par l'outil » — matérialisé par
 *     les plafonds de taille, dont le refus doit DIRE où aller à la place ;
 *   - le critère 5 : « déposer deux fois le même fichier signale un doublon
 *     au lieu de le dupliquer » — ce qui suppose une empreinte du CONTENU,
 *     pas du nom.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  validerFichier,
  empreinte,
  cheminRelatif,
  cheminVignette,
  urlPublique,
  nomArchive,
  nomDansArchive,
  racineStockage,
  TYPES_ACCEPTES,
  PLAFONDS_MO,
  SEGMENT_URL,
} from "./stockage";

const MO = 1024 * 1024;

describe("validerFichier — ce qui entre et ce qui reste dehors", () => {
  it("accepte les formats courants, avec leur extension canonique", () => {
    expect(validerFichier("image/jpeg", 2 * MO)).toMatchObject({
      accepte: true,
      extension: "jpg",
      famille: "image",
    });
    expect(validerFichier("application/pdf", 5 * MO)).toMatchObject({
      accepte: true,
      extension: "pdf",
      famille: "document",
    });
  });

  it("🔴 REFUSE un type inconnu, en DISANT ce qui est accepté", () => {
    // Un « type non supporté » sec fait réessayer trois fois avec le même
    // fichier.
    const v = validerFichier("application/x-msdownload", 1 * MO);
    expect(v.accepte).toBe(false);
    expect(v.message).toContain("non accepté");
    expect(v.message).toMatch(/jpg|png/);
  });

  it("REFUSE un type vide sans planter", () => {
    expect(validerFichier("", 1024).accepte).toBe(false);
    expect(validerFichier("", 1024).message).toContain("inconnu");
  });

  it("🔴 REFUSE un RUSH vidéo, et renvoie vers l'emplacement externe — §5", () => {
    // C'est la règle qui « évite le mur » : un épisode pèse 90 Go de rushes.
    const v = validerFichier("video/mp4", 3000 * MO);
    expect(v.accepte).toBe(false);
    expect(v.message).toContain("§5");
    expect(v.message).toContain("emplacement externe");
  });

  it("accepte JUSTE SOUS le plafond et refuse JUSTE AU-DESSUS", () => {
    // C'est la limite qui casse, pas le centre.
    const plafond = PLAFONDS_MO.image as number;
    expect(validerFichier("image/png", plafond * MO).accepte).toBe(true);
    expect(validerFichier("image/png", (plafond + 1) * MO).accepte).toBe(false);
  });

  it("applique un plafond DIFFÉRENT par famille", () => {
    // 200 Mo passe en vidéo, pas en image : le même octet n'a pas le même
    // sens selon ce qu'il transporte.
    expect(validerFichier("video/mp4", 200 * MO).accepte).toBe(true);
    expect(validerFichier("image/png", 200 * MO).accepte).toBe(false);
  });

  it("ne laisse aucune famille sans plafond", () => {
    for (const { famille } of Object.values(TYPES_ACCEPTES)) {
      expect(PLAFONDS_MO[famille], `famille ${famille}`).toBeGreaterThan(0);
    }
  });
});

describe("empreinte — la détection de doublon", () => {
  it("rend la même empreinte pour un contenu identique", () => {
    expect(empreinte(Buffer.from("abc"))).toBe(empreinte(Buffer.from("abc")));
  });

  it("🔴 distingue deux contenus qui ne diffèrent que d'un octet", () => {
    expect(empreinte(Buffer.from("abc"))).not.toBe(empreinte(Buffer.from("abd")));
  });

  it("🔴 empreint le CONTENU, donc deux NOMS différents se rejoignent", () => {
    // « visuel-final.png » et « visuel-final-2.png » identiques au bit près
    // sont le même fichier — c'est tout le sens du critère 5. Un nom ne
    // prouve rien.
    const contenu = Buffer.from("le même visuel, deux noms");
    expect(empreinte(contenu)).toBe(empreinte(Buffer.from(contenu)));
  });

  it("rend 64 caractères hexadécimaux", () => {
    expect(empreinte(Buffer.from("x"))).toMatch(/^[0-9a-f]{64}$/);
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("les chemins", () => {
  const e = "ab34ef".padEnd(64, "0");

  it("range en deux niveaux, pour ne pas faire un dossier plat de 10 000 fichiers", () => {
    expect(cheminRelatif(e, "png")).toBe(`ab/34/${e}.png`);
  });

  it("range la vignette à côté de son original", () => {
    expect(cheminVignette(e)).toBe(`ab/34/${e}-vignette.webp`);
  });

  it("sert l'URL sous le segment public", () => {
    expect(urlPublique(cheminRelatif(e, "png"))).toBe(`${SEGMENT_URL}/ab/34/${e}.png`);
  });

  it("🔴 ne rend JAMAIS une racine vide, même variable définie mais VIDE", () => {
    // Le piège documenté d'`image-bank` : `??` laisse passer la chaîne vide,
    // et tous les fichiers atterrissent à la racine du disque. `vi.stubEnv`
    // plutôt que `Object.defineProperty` : `process.env` refuse une
    // redéfinition non énumérable, et la restauration levait.
    vi.stubEnv("NODE_ENV", "production");

    vi.stubEnv("EDITORIAL_STORAGE_PATH", "");
    expect(racineStockage()).toBe("/var/data/editorial-media");

    vi.stubEnv("EDITORIAL_STORAGE_PATH", "   ");
    expect(racineStockage()).toBe("/var/data/editorial-media");

    vi.stubEnv("EDITORIAL_STORAGE_PATH", "/mnt/edito");
    expect(racineStockage()).toBe("/mnt/edito");
  });
});

describe("nomArchive — critère 3, « nommée LISIBLEMENT »", () => {
  it("préfixe par le numéro d'import et quelques mots du titre", () => {
    expect(nomArchive("linkedin-2026-q4-04", "Trois signaux qu'un processus vous coûte")).toBe(
      "pub-04-trois-signaux-qu-un.zip",
    );
  });

  it("retombe sur un nom générique quand il n'y a pas de référence", () => {
    expect(nomArchive(null, "Une publication")).toBe("publication-une-publication.zip");
  });

  it("🔴 ne produit ni accent, ni espace, ni apostrophe", () => {
    // Un nom de fichier à accents casse au téléchargement sur certains
    // systèmes, et une apostrophe casse les scripts qui le manipulent.
    const nom = nomArchive("ref-12", "Été : l'« intégration » réussie, enfin !");
    expect(nom).toMatch(/^[a-z0-9-]+\.zip$/);
  });

  it("reste court même sur un titre à rallonge", () => {
    const nom = nomArchive("ref-01", "un ".repeat(60));
    expect(nom.length).toBeLessThan(60);
  });
});

describe("nomDansArchive — l'ordre du carrousel survit à la décompression", () => {
  it("🔴 numérote sur deux chiffres, pour que le tri soit le bon", () => {
    // Sans le zéro de tête, « 10 » se range avant « 2 ».
    expect(nomDansArchive(0, "Visuel A", "png")).toBe("01-visuel-a.png");
    expect(nomDansArchive(9, "Visuel J", "png")).toBe("10-visuel-j.png");
  });

  it("retombe sur « media » si le libellé ne donne rien d'utilisable", () => {
    expect(nomDansArchive(0, "!!!", "jpg")).toBe("01-media.jpg");
  });

  it("tronque un libellé interminable", () => {
    expect(nomDansArchive(0, "x".repeat(200), "png").length).toBeLessThan(70);
  });
});
