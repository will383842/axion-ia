import { describe, expect, it } from "vitest";

import { urlPhotoPublique } from "../photo-publique";

const base = {
  status: "publie",
  photoKind: "reelle",
  photoConsentAt: new Date("2026-11-01"),
  erasureRequestedAt: null,
  photoUrl256: "/api/equipe/photo/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/256",
  photoUrl1024: "/api/equipe/photo/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/1024",
};

describe("urlPhotoPublique", () => {
  it("rend l'URL quand publiée + réelle + consentement", () => {
    expect(urlPhotoPublique(base, 256)).toBe(base.photoUrl256);
    expect(urlPhotoPublique(base, 1024)).toBe(base.photoUrl1024);
  });
  it.each([
    ["non publiée", { status: "brouillon" }],
    ["retirée", { status: "retire" }],
    ["avatar", { photoKind: "avatar" }],
    ["sans consentement", { photoConsentAt: null }],
    ["effacement demandé", { erasureRequestedAt: new Date() }],
    ["sans variante", { photoUrl256: null }],
  ])("rend null : %s", (_n, over) => {
    expect(urlPhotoPublique({ ...base, ...over }, 256)).toBeNull();
  });
});
