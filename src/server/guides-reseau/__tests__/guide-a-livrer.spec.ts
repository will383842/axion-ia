// @vitest-environment node
//
// PR-S2b — `resoudreGuide` : quel guide livrer pour cet aimant ? (scénarios 1 à 7)
//
// 🔴 BLOQUANT : le chemin guide-ia ne lit JAMAIS `cibles_reseau` (la route signée peut upserter la fiche
// guide-ia ; son texte ne doit pas pour autant décider de ce que reçoivent les 100 % de demandes actuelles).
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string | null | undefined) =>
    e && e.trim() ? `h:${e.trim().toLowerCase()}` : null,
}));

import {
  RACINE_GUIDES,
  cheminGuideAutorise,
  resoudreGuide,
  titreGuideSur,
  type CibleLue,
} from "../guide-a-livrer";

const CODE = "gde-essai-01";
const CIBLE: CibleLue = {
  code: CODE,
  type: "guide",
  titre: "Le plan en 90 jours",
  cheminPdf: "guides-reseau/plan-90-jours.pdf",
  actif: true,
  test: false,
};
const lecteur = (c: CibleLue | null) => vi.fn(async () => c);
const ENV = {};

describe("resoudreGuide", () => {
  it("1. guide-ia : réponse immédiate, AUCUNE lecture (ni cible, ni env d'essai)", async () => {
    const lire = vi.fn(async () => {
      throw new Error("lecture interdite");
    });
    await expect(resoudreGuide("guide-ia", "a@example.test", { lire, env: ENV })).resolves.toEqual({
      kind: "guide-ia",
    });
    expect(lire).not.toHaveBeenCalled();
  });

  it("2. un guide du catalogue actif, de type guide, au chemin sûr : livré avec code, titre et chemin", async () => {
    const lire = lecteur(CIBLE);
    await expect(resoudreGuide(CODE, "a@example.test", { lire, env: ENV })).resolves.toEqual({
      kind: "catalogue",
      code: CODE,
      titre: "Le plan en 90 jours",
      chemin: "guides-reseau/plan-90-jours.pdf",
    });
    expect(lire).toHaveBeenCalledWith(CODE);
  });

  it("3. inconnue, mauvaise forme de code, type adresse, inactive : indisponible (raison courte)", async () => {
    const r = (c: CibleLue | null, code = CODE) =>
      resoudreGuide(code, "a@example.test", { lire: lecteur(c), env: ENV });
    await expect(r(null)).resolves.toEqual({ kind: "indisponible", raison: "inconnue" });
    // Un code qui n'a pas la forme `gde-…` n'est même pas lu.
    const lire = lecteur(CIBLE);
    await expect(
      resoudreGuide("adr-essai-01", "a@example.test", { lire, env: ENV }),
    ).resolves.toEqual({ kind: "indisponible", raison: "inconnue" });
    expect(lire).not.toHaveBeenCalled();
    await expect(r({ ...CIBLE, type: "adresse" })).resolves.toEqual({
      kind: "indisponible",
      raison: "type",
    });
    await expect(r({ ...CIBLE, actif: false })).resolves.toEqual({
      kind: "indisponible",
      raison: "inactive",
    });
  });

  it("4. chemins refusés : hors guides-reseau/, remontée, absolu, URL, double barre, extension truquée", async () => {
    const mauvais = [
      "imprimes/dossier-intervenant-williams-jullin-axion-ia.pdf",
      "guides-reseau/../imprimes/a.pdf",
      "/etc/x.pdf",
      "https://evil.tld/a.pdf",
      "guides-reseau//a.pdf",
      "guides-reseau/a.PDF.exe",
      "guides-reseau/a.PDF",
      "guides-reseau/.pdf",
      "guides-reseau/",
      null,
    ];
    for (const chemin of mauvais) {
      expect(cheminGuideAutorise(chemin)).toBeNull();
      await expect(
        resoudreGuide(CODE, "a@example.test", {
          lire: lecteur({ ...CIBLE, cheminPdf: chemin }),
          env: ENV,
        }),
      ).resolves.toEqual({ kind: "indisponible", raison: "chemin" });
    }
    expect(RACINE_GUIDES).toBe("guides-reseau/");
    expect(cheminGuideAutorise("guides-reseau/sous-dossier/a-b_c.pdf")).toBe(
      "guides-reseau/sous-dossier/a-b_c.pdf",
    );
  });

  it("5. titre : un retour à la ligne ou un caractère de contrôle (injection d'en-tête) est refusé", async () => {
    for (const t of ["Abc\r\nBcc: x", "Abc\nx", "A\u0000bc", "Abc\u0085d", "Abc d", "ab"]) {
      expect(titreGuideSur(t)).toBeNull();
      await expect(
        resoudreGuide(CODE, "a@example.test", { lire: lecteur({ ...CIBLE, titre: t }), env: ENV }),
      ).resolves.toEqual({ kind: "indisponible", raison: "titre" });
    }
    expect(titreGuideSur("  Le plan en 90 jours  ")).toBe("Le plan en 90 jours");
  });

  it("6. cible d'essai : livrée SEULEMENT aux adresses de GUIDES_RESEAU_ESSAI_ADRESSES (casse ignorée) ; sans effet sur une cible non-test", async () => {
    const essai = { ...CIBLE, test: true };
    const env = { GUIDES_RESEAU_ESSAI_ADRESSES: " Essai@Example.test , autre@example.test" };
    await expect(
      resoudreGuide(CODE, "inconnue@example.test", { lire: lecteur(essai), env }),
    ).resolves.toEqual({ kind: "indisponible", raison: "essai_hors_liste" });
    await expect(
      resoudreGuide(CODE, "inconnue@example.test", { lire: lecteur(essai), env: ENV }),
    ).resolves.toEqual({ kind: "indisponible", raison: "essai_hors_liste" });
    await expect(
      resoudreGuide(CODE, "ESSAI@example.TEST", { lire: lecteur(essai), env }),
    ).resolves.toMatchObject({ kind: "catalogue", code: CODE });
    // Une cible non-test se livre à tout le monde, liste ou pas.
    await expect(
      resoudreGuide(CODE, "inconnue@example.test", { lire: lecteur(CIBLE), env }),
    ).resolves.toMatchObject({ kind: "catalogue" });
  });

  it("7. lecture en échec : fermé (indisponible), l'erreur ne remonte pas", async () => {
    const lire = vi.fn(async () => {
      throw new Error("base illisible");
    });
    await expect(resoudreGuide(CODE, "a@example.test", { lire, env: ENV })).resolves.toEqual({
      kind: "indisponible",
      raison: "lecture_echec",
    });
  });
});
