// Résolution de la source des vignettes de la console — 2026-08-02.
//
// POURQUOI CE TEST EXISTE
// -----------------------
// Les 288 vignettes de la banque d'images s'affichaient toutes en carré gris.
// Vérifié en production le 2026-08-02, requête à l'appui :
//
//   /images/axion-ia-icone-app-fond-creme-500px-thumb.webp  → 404
//   /images/axion-ia-icone-app-fond-creme-500px.webp        → 200
//
// La base référence, pour les images SEEDÉES sous `public/images/…`, un
// `thumbnailPath` en `-thumb.webp` que le disque ne porte pas : le variant
// n'a jamais été généré pour cette famille. La priorité systématique à
// `thumbnailPath` produisait donc une URL morte, et le composant retombait
// sur son placeholder — sans qu'aucune erreur ne soit levée nulle part.
//
// La famille UUID (upload admin, `/image-bank/…`) garde la priorité à sa
// miniature : son variant Sharp existe, et sert précisément à ne pas charger
// l'original dans une liste.

import { describe, it, expect } from "vitest";
import { resolveAdminThumbSrc } from "./paths";

describe("resolveAdminThumbSrc", () => {
  it("prend l'image principale pour une image seedée (sa miniature n'existe pas sur disque)", () => {
    expect(
      resolveAdminThumbSrc({
        id: "abc",
        thumbnailPath: "images/photo-thumb.webp",
        filePath: "images/photo.webp",
      }),
    ).toBe("/images/photo.webp");
  });

  it("garde la miniature pour un upload admin (variant Sharp réellement généré)", () => {
    expect(
      resolveAdminThumbSrc(
        {
          id: "abc",
          thumbnailPath: "/image-bank/abc/thumb.webp",
          filePath: "/image-bank/abc/original.webp",
        },
        "https://cdn.test",
      ),
    ).toBe("https://cdn.test/image-bank/abc/thumb.webp");
  });

  it("reconstruit l'URL quand la base a stocké un chemin DISQUE du volume", () => {
    expect(
      resolveAdminThumbSrc(
        { id: "u1", thumbnailPath: "//var/data/image-bank/u1/thumb.webp", filePath: null },
        "https://cdn.test",
      ),
    ).toBe("https://cdn.test/image-bank/u1/thumb.webp");
  });

  it("normalise le slash de tête d'un chemin seedé sans miniature", () => {
    expect(
      resolveAdminThumbSrc({ id: "abc", thumbnailPath: null, filePath: "images/x.webp" }),
    ).toBe("/images/x.webp");
  });

  it("rend null quand aucun chemin n'existe — l'appelant garde son placeholder", () => {
    expect(resolveAdminThumbSrc({ id: "abc", thumbnailPath: null, filePath: null })).toBeNull();
  });
});
