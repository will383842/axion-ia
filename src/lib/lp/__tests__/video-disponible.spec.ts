/**
 * Le bloc vidéo n'apparaît QUE si les fichiers existent : la page VSL
 * apporteurs doit être livrable sans film.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  fichierPublicExiste,
  lireTranscription,
  transcriptionDepuisVtt,
  videoDisponible,
} from "../video-disponible";

const FICHIERS = { src: "/videos/film-v1.mp4", poster: "/videos/film-v1-poster.avif" } as const;

describe("videoDisponible", () => {
  let racine: string;
  beforeEach(() => {
    racine = mkdtempSync(join(tmpdir(), "vsl-"));
    mkdirSync(join(racine, "public", "videos"), { recursive: true });
  });
  afterEach(() => rmSync(racine, { recursive: true, force: true }));

  it("faux tant que les fichiers manquent (dossier public/videos absent compris)", () => {
    expect(videoDisponible(FICHIERS, racine)).toBe(false);
    expect(videoDisponible(FICHIERS, join(racine, "inexistant"))).toBe(false);
  });

  it("faux si le film existe sans son affiche, et inversement", () => {
    writeFileSync(join(racine, "public", "videos", "film-v1.mp4"), "x");
    expect(videoDisponible(FICHIERS, racine)).toBe(false);
    rmSync(join(racine, "public", "videos", "film-v1.mp4"));
    writeFileSync(join(racine, "public", "videos", "film-v1-poster.avif"), "x");
    expect(videoDisponible(FICHIERS, racine)).toBe(false);
  });

  it("vrai quand le film ET l'affiche existent", () => {
    writeFileSync(join(racine, "public", "videos", "film-v1.mp4"), "x");
    writeFileSync(join(racine, "public", "videos", "film-v1-poster.avif"), "x");
    expect(videoDisponible(FICHIERS, racine)).toBe(true);
  });

  it("refuse tout chemin hors de /videos/ (pas de sortie du dossier public)", () => {
    expect(fichierPublicExiste("/../package.json", racine)).toBe(false);
    expect(fichierPublicExiste("/videos/../../package.json", racine)).toBe(false);
    expect(fichierPublicExiste("/imprimes/x.pdf", racine)).toBe(false);
  });

  it("la transcription est lue dans le .vtt, sans horodatage ; vide si le fichier manque", () => {
    expect(lireTranscription("/videos/film-v1.fr.vtt", racine)).toEqual([]);
    writeFileSync(
      join(racine, "public", "videos", "film-v1.fr.vtt"),
      "WEBVTT\n\n1\n00:00:00.000 --> 00:00:03.000\nBonjour, je suis Williams.\n\n2\n00:00:03.000 --> 00:00:06.000\n<v Will>Vous connaissez des dirigeants ?</v>\nSuite.\n",
    );
    expect(lireTranscription("/videos/film-v1.fr.vtt", racine)).toEqual([
      "Bonjour, je suis Williams.",
      "Vous connaissez des dirigeants ?",
      "Suite.",
    ]);
  });
});

describe("transcriptionDepuisVtt", () => {
  it("ignore l'en-tête, les notes et les identifiants", () => {
    const t = transcriptionDepuisVtt(
      "WEBVTT\n\nNOTE un commentaire\n\nintro\n00:00:00.000 --> 00:00:02.000\nUne ligne\n",
    );
    expect(t).toEqual(["Une ligne"]);
  });
});
