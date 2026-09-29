import { describe, expect, it } from "vitest";

import {
  extensionAutorisee,
  formatReel,
  nombreDeMorceaux,
  nomAffichable,
  VIDEO_MORCEAU_OCTETS,
} from "../videos";
import { lireReponseClamd } from "@/server/careers/clamav";

const octets = (...b: number[]) => Uint8Array.from(b);
const ascii = (s: string) => Array.from(s).map((c) => c.charCodeAt(0));

describe("vidéos déposées — le format RÉEL, pas le nom", () => {
  it("reconnaît MP4 et MOV par « ftyp », WebM par la signature EBML", () => {
    expect(formatReel(octets(0, 0, 0, 0x20, ...ascii("ftypisom")))).toBe("video/mp4");
    expect(formatReel(octets(0, 0, 0, 0x14, ...ascii("ftypqt  ")))).toBe("video/quicktime");
    expect(formatReel(octets(0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0))).toBe("video/webm");
  });

  it("🔴 un exécutable renommé en .mp4 est refusé", () => {
    expect(formatReel(octets(0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0))).toBeNull(); // « MZ »
    expect(formatReel(octets(...ascii("%PDF-1.7 xxxx")))).toBeNull();
    expect(formatReel(octets())).toBeNull();
  });

  it("extensions acceptées, casse ignorée", () => {
    expect(extensionAutorisee("Montage FINAL.MP4")).toBe(true);
    expect(extensionAutorisee("clip.mov")).toBe(true);
    expect(extensionAutorisee("clip.avi")).toBe(false);
    expect(extensionAutorisee("clip.mp4.exe")).toBe(false);
  });

  it("découpage en morceaux de 4 Mo, jamais zéro morceau", () => {
    expect(nombreDeMorceaux(1)).toBe(1);
    expect(nombreDeMorceaux(VIDEO_MORCEAU_OCTETS)).toBe(1);
    expect(nombreDeMorceaux(VIDEO_MORCEAU_OCTETS + 1)).toBe(2);
    expect(nombreDeMorceaux(200 * 1024 * 1024)).toBe(50);
  });

  it("un nom de fichier n'emporte ni chemin ni caractère de contrôle", () => {
    expect(nomAffichable("../../etc/passwd\u0000.mp4")).not.toMatch(/[/\\\u0000]/);
    expect(nomAffichable("")).toBe("video");
  });
});

describe("antivirus — trois issues, jamais deux", () => {
  it("OK → sain ; FOUND → infecté avec la signature", () => {
    expect(lireReponseClamd("stream: OK\0")).toEqual({ issue: "sain" });
    expect(lireReponseClamd("stream: Eicar-Test-Signature FOUND\0")).toEqual({
      issue: "infecte",
      signature: "Eicar-Test-Signature",
    });
  });

  it("🔴 une réponse vide ou une erreur n'est JAMAIS lue comme « sain »", () => {
    expect(lireReponseClamd("").issue).toBe("indisponible");
    expect(lireReponseClamd("INSTREAM size limit exceeded. ERROR\0").issue).toBe("indisponible");
  });
});
