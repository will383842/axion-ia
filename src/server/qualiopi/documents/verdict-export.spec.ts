/**
 * 🔴 LES DEUX MESSAGES LES PLUS IMPORTANTS DE LA CONSOLE PARTAIENT DANS UN
 * `window.alert`.
 *
 *   · « N chaînes de signatures présentent une ANOMALIE D'INTÉGRITÉ » ;
 *   · « dossier INCOMPLET », suivi de la liste des manques.
 *
 * Non copiables, non relisibles, effacés au premier clic — alors que le ZIP,
 * lui, est **déjà téléchargé**. Le dossier partait chez l'auditeur avec son
 * anomalie, et l'avertissement n'existait plus nulle part.
 */

import { describe, expect, it } from "vitest";
import { verdictExport, type EtatDossier } from "./verdict-export";

const sain = (patch: Partial<EtatDossier> = {}): EtatDossier => ({
  incomplet: false,
  nbChainesAnormales: 0,
  nbChainesContresignAnormales: 0,
  avertissements: [],
  nomFichier: "dossier-AXI-SESS-2026-003.zip",
  ...patch,
});

describe("🔴 l'anomalie d'intégrité prime sur tout le reste", () => {
  it("elle l'emporte même sur un dossier incomplet", () => {
    // Les deux peuvent être vrais en même temps. Annoncer « incomplet »
    // masquerait la seule information qui signifie « une signature a été
    // modifiée après avoir été apposée ».
    const v = verdictExport(sain({ incomplet: true, nbChainesAnormales: 1 }));
    expect(v.ton).toBe("danger");
    expect(v.titre).toContain("ANOMALIE");
  });

  it("une contresignature falsifiée compte autant qu'une signature", () => {
    // Elle est exigée (CAA Nantes 20/04/2021) : la traiter comme secondaire
    // rendrait le contrôle asymétrique et donc contournable.
    const v = verdictExport(sain({ nbChainesContresignAnormales: 1 }));
    expect(v.ton).toBe("danger");
  });

  it("les deux compteurs s'ADDITIONNENT", () => {
    const v = verdictExport(sain({ nbChainesAnormales: 2, nbChainesContresignAnormales: 3 }));
    expect(v.titre).toContain("5");
  });

  it("elle nomme le fichier à ouvrir dans le ZIP", () => {
    // C'est l'information qu'un `alert` rendait non copiable.
    expect(verdictExport(sain({ nbChainesAnormales: 1 })).fichierAConsulter).toBe(
      "verification-integrite.json",
    );
  });

  it("l'accord en nombre suit le compte", () => {
    expect(verdictExport(sain({ nbChainesAnormales: 1 })).titre).toContain("chaîne de");
    expect(verdictExport(sain({ nbChainesAnormales: 2 })).titre).toContain("chaînes de");
  });
});

describe("🔴 le dossier incomplet relaie les manques TELS QUELS", () => {
  it("chaque avertissement devient une ligne", () => {
    // Les résumer en « des pièces manquent » ferait perdre CE QUI manque — la
    // seule information utile.
    const v = verdictExport(
      sain({ incomplet: true, avertissements: ["Émargement absent", "Attestation non générée"] }),
    );
    expect(v.details).toEqual(["Émargement absent", "Attestation non générée"]);
    expect(v.ton).toBe("attention");
  });

  it("sans avertissement, il renvoie quand même vers le fichier", () => {
    // Le repli ne doit pas être muet : c'est le cas où l'on sait le moins.
    const v = verdictExport(sain({ incomplet: true }));
    expect(v.details.length).toBeGreaterThan(0);
    expect(v.fichierAConsulter).toBe("index.txt");
  });
});

describe("le cas nominal reste un succès lisible", () => {
  it("ton de succès, nom du fichier téléchargé", () => {
    // ⚠️ Le contre-test : si tout export devenait un avertissement, on
    // apprendrait à ignorer le bandeau — et l'anomalie d'intégrité avec.
    const v = verdictExport(sain());
    expect(v.ton).toBe("succes");
    expect(v.titre).toContain("dossier-AXI-SESS-2026-003.zip");
    expect(v.details).toEqual([]);
    expect(v.fichierAConsulter).toBeNull();
  });
});

describe("🔴 aucun écran d'export ne rappelle window.alert", () => {
  // Il gèle tout événement navigateur : aucun test Playwright ne peut
  // traverser l'écran. C'est aussi pour cela que le parcours d'audit n'a
  // jamais pu être rejoué de bout en bout.
  it.each([
    ["src/components/admin/qualiopi/DossierSessionButton.tsx"],
    ["src/components/admin/qualiopi/ExportManifesteButton.tsx"],
  ])("%s", async (chemin) => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const code = readFileSync(join(process.cwd(), chemin), "utf8")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");
    expect(code).not.toContain("window.alert");
    expect(code).toContain("VerdictExportBloc");
  });
});
