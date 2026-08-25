/**
 * Kit média public — règle de FUSION fixtures ↔ assets console.
 *
 * Ce qu'on verrouille, et pourquoi : `getPublishedPressMedia` retombait sur les
 * fixtures UNIQUEMENT quand la table était vide (« tout ou rien »). Or les vrais
 * logos, le boilerplate et le portrait du fondateur n'existent QUE dans les
 * fixtures. Publier un seul asset depuis la console (un brand book, par exemple)
 * les faisait donc tous disparaître d'un coup de la salle de presse — sans
 * message, sans écran d'aperçu, et sans qu'aucun test ne rougisse.
 *
 * Le test central est donc : « un asset publié ne doit pas emporter les logos ».
 * Les autres bornent les deux cas de remplacement légitimes.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect, vi, beforeEach } from "vitest";

const findManyMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pressMediaAsset: { findMany: (...a: unknown[]) => findManyMock(...a) },
  },
}));

import { getPublishedPressMedia } from "./queries";
import { PRESS_KIT_ASSETS } from "@/content/press";

/** Ligne Prisma minimale, telle que la lit `getPublishedPressMedia`. */
function dbAsset(over: {
  id: string;
  kind: string;
  title: string;
  storagePath?: string | null;
  fileFormat?: string;
}) {
  return {
    id: over.id,
    kind: over.kind,
    storagePath: over.storagePath === undefined ? "/vol/x.pdf" : over.storagePath,
    fileFormat: over.fileFormat ?? "pdf",
    translations: [{ title: over.title, description: "" }],
  };
}

/** Même normalisation que la production, pour comparer sans dépendre des accents. */
function normalizeForTest(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

beforeEach(() => {
  findManyMock.mockReset();
});

describe("getPublishedPressMedia · fusion fixtures ↔ console", () => {
  it("sans aucun asset console, sert les fixtures (contre-témoin : la liste n'est pas vide)", async () => {
    findManyMock.mockResolvedValue([]);
    const items = await getPublishedPressMedia("fr");

    // Contre-témoin de non-vacuité : si les fixtures venaient à disparaître, les
    // assertions « le logo survit » ci-dessous passeraient à vide.
    expect(PRESS_KIT_ASSETS.length).toBeGreaterThanOrEqual(5);
    expect(items).toHaveLength(PRESS_KIT_ASSETS.length);
    expect(items.some((i) => i.title === "Logo principal")).toBe(true);
  });

  it("🔴 un asset console publié n'emporte PAS les logos ni le boilerplate", async () => {
    findManyMock.mockResolvedValue([
      dbAsset({ id: "a1", kind: "brand_book", title: "Brand book Axion-IA 2026" }),
    ]);
    const items = await getPublishedPressMedia("fr");

    // L'asset console est là…
    expect(items.some((i) => i.title === "Brand book Axion-IA 2026")).toBe(true);
    // …ET les fixtures aussi. C'est exactement ce que l'ancien code perdait.
    expect(items.some((i) => i.title === "Logo principal")).toBe(true);
    expect(items.some((i) => i.title === "Photo fondateur")).toBe(true);
    expect(items.some((i) => i.title === "Boilerplate FR + EN")).toBe(true);
    expect(items.length).toBe(PRESS_KIT_ASSETS.length + 1);
  });

  it("un asset console de même titre REMPLACE la fixture (pas de doublon)", async () => {
    findManyMock.mockResolvedValue([
      // Casse et accents différents : le rapprochement est normalisé.
      dbAsset({ id: "a2", kind: "logo", title: "LOGO PRINCIPAL", fileFormat: "svg" }),
    ]);
    const items = await getPublishedPressMedia("fr");

    const logos = items.filter((i) => i.title.toLowerCase() === "logo principal");
    expect(logos).toHaveLength(1);
    expect(logos[0]!.format).toBe("SVG"); // c'est bien la version console qui reste
    expect(items).toHaveLength(PRESS_KIT_ASSETS.length);
  });

  it("le rapprochement ignore les accents (« Logo carré » saisi « logo carre »)", async () => {
    findManyMock.mockResolvedValue([
      dbAsset({ id: "a5", kind: "logo", title: "Logo carre", fileFormat: "svg" }),
    ]);
    const items = await getPublishedPressMedia("fr");

    // Une seule tuile « logo carré » — sinon le kit en afficherait deux, la
    // console et la fixture, pour le même visuel.
    const squares = items.filter((i) => normalizeForTest(i.title) === "logo carre");
    expect(squares).toHaveLength(1);
    expect(squares[0]!.format).toBe("SVG");
  });

  it("les assets console passent AVANT les fixtures (l'ordre admin fait autorité)", async () => {
    findManyMock.mockResolvedValue([
      dbAsset({ id: "a3", kind: "graphic_charter", title: "Charte graphique" }),
    ]);
    const items = await getPublishedPressMedia("fr");
    expect(items[0]!.title).toBe("Charte graphique");
  });

  it("table absente (throw Prisma) → fixtures seules, jamais une page cassée", async () => {
    findManyMock.mockRejectedValue(new Error("relation does not exist"));
    const items = await getPublishedPressMedia("fr");
    expect(items).toHaveLength(PRESS_KIT_ASSETS.length);
  });

  it("une traduction manquante dans la locale demandée ne fabrique pas d'entrée vide", async () => {
    findManyMock.mockResolvedValue([
      { id: "a4", kind: "logo", storagePath: "/vol/x.png", fileFormat: "png", translations: [] },
    ]);
    const items = await getPublishedPressMedia("fr");
    expect(items).toHaveLength(PRESS_KIT_ASSETS.length);
    expect(items.every((i) => i.title.length > 0)).toBe(true);
  });
});

describe("fixtures du kit — aucune promesse non tenue", () => {
  it("🔴 aucune fixture ne s'affiche en « bientôt disponible »", () => {
    // Deux tuiles (« Wordmark dark », « Brand book synthétique ») ont été servies
    // aux journalistes avec un bouton désactivé depuis l'ouverture de la salle de
    // presse. Un kit presse n'annonce pas un fichier qu'il n'a pas : le suivi de
    // ce qui reste à produire appartient à la console, pas à la page publique.
    const placeholders = PRESS_KIT_ASSETS.filter((a) => a.fileUrl === null);
    expect(placeholders.map((a) => a.id)).toEqual([]);
  });

  it("🔴 tout fichier de fixture existe VRAIMENT (chemin /public vérifié sur disque)", () => {
    // Un chemin en dur ne vaut que s'il a un témoin d'existence : une tuile du
    // kit qui renvoie un 404 est pire qu'une tuile absente — le journaliste a
    // déjà écrit « kit disponible ici » avant de cliquer.
    const staticAssets = PRESS_KIT_ASSETS.filter((a) => a.fileUrl?.startsWith("/images/"));
    expect(staticAssets.length).toBeGreaterThanOrEqual(3); // contre-témoin de non-vacuité

    for (const asset of staticAssets) {
      const onDisk = join(process.cwd(), "public", asset.fileUrl!);
      expect(existsSync(onDisk), `${asset.id} → ${asset.fileUrl} introuvable dans /public`).toBe(
        true,
      );
    }

    // Les autres passent par une route interne (générée), pas par un fichier figé.
    for (const asset of PRESS_KIT_ASSETS) {
      expect(asset.fileUrl).toMatch(/^\/(images|api)\//);
    }
  });
});
