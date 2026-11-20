/** Le plafond contrôlé à l'écran est celui du serveur : sinon l'écran accepte ce que l'action refuse. */
import { describe, expect, it } from "vitest";
import { TAILLE_MAX_SCAN_ECRAN } from "../DevisVersementScanPapier";
import { TAILLE_MAX_SCAN_OCTETS } from "@/server/qualiopi/documents/signature/scan-papier-storage";

describe("plafond du scan papier", () => {
  it("écran = serveur", () => {
    expect(TAILLE_MAX_SCAN_ECRAN).toBe(TAILLE_MAX_SCAN_OCTETS);
  });
});
