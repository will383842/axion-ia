/**
 * Registre unique des critères (§ 3, règle 3). L'écran de console et les tests
 * sont générés depuis lui. La colonne `classe` est celle du tableau du § 5.
 */

import { evaluerB08, evaluerB11 } from "./criteres/completude";
import { evaluerB01, evaluerB03 } from "./criteres/doctrine";
import { evaluerB13 } from "./criteres/maillage";
import { evaluerB14 } from "./criteres/metadonnees";
import { evaluerB11a, evaluerB11b, evaluerB11c } from "./criteres/structure";
import type { ClasseBloquant, Critere } from "./types";

/**
 * Classement unique des bloquants (§ 5), y compris ceux pas encore codés.
 * B11a, B11b, B11c sont les sous-règles de structure de B11 (corrigeables).
 * B17 n'y figure pas : c'est un report, pas un refus.
 */
export const CLASSES_PAR_ID: Readonly<Record<string, ClasseBloquant>> = Object.freeze({
  B01: "dur",
  B02: "dur",
  B03: "dur",
  B04: "dur",
  B09: "dur",
  B12: "dur",
  B14: "dur",
  B15: "dur",
  B08: "corrigeable",
  B10: "corrigeable",
  B11: "corrigeable",
  B11a: "corrigeable",
  B11b: "corrigeable",
  B11c: "corrigeable",
  B13: "corrigeable",
  B16: "corrigeable",
  B05: "derogeable",
  B06: "derogeable",
  B07: "derogeable",
});

/** Bloquants prévus au § 4.1 (hors B17, branché en Q10). */
export const IDS_BLOQUANTS_PREVUS: ReadonlyArray<string> = Object.freeze(
  Array.from({ length: 16 }, (_, i) => `B${String(i + 1).padStart(2, "0")}`),
);

function critere(c: Omit<Critere, "gravite" | "classe" | "derogation">): Critere {
  const classe = CLASSES_PAR_ID[c.id];
  if (!classe) throw new Error(`Critère ${c.id} absent du classement du § 5`);
  return { ...c, gravite: "bloquant", classe, derogation: classe === "derogeable" };
}

export const CRITERES: ReadonlyArray<Critere> = Object.freeze([
  critere({
    id: "B01",
    libelle: "Doctrine et communication",
    famille: "doctrine",
    seuil: () => "0 faute (liste de interdits-publication.ts)",
    evaluer: (c, x) => evaluerB01(c, x),
  }),
  critere({
    id: "B03",
    libelle: "Faits canoniques cohérents (prix)",
    famille: "faits",
    seuil: () => "0 écart avec pricing.ts",
    evaluer: (c) => evaluerB03(c),
  }),
  critere({
    id: "B08",
    libelle: "Réponse directe en tête",
    famille: "completude",
    seuil: (r) => `${r.motsMinReponseDirecte} à ${r.motsMaxReponseDirecte} mots`,
    evaluer: (c, _x, r) => evaluerB08(c, r),
  }),
  critere({
    id: "B11",
    libelle: "Complétude de la page",
    famille: "completude",
    seuil: (r) =>
      `${r.motsMinArticleLong} mots (articles), ${r.h2Min} à ${r.h2Max} H2, ${r.citationsMin} sources externes, point clé`,
    evaluer: (c, x, r) => evaluerB11(c, x, r),
  }),
  critere({
    id: "B11a",
    libelle: "Un seul titre principal (H1)",
    famille: "structure",
    seuil: () => "exactement 1 H1",
    evaluer: (c) => evaluerB11a(c),
  }),
  critere({
    id: "B11b",
    libelle: "Aucun saut de niveau de titre",
    famille: "structure",
    seuil: () => "0 saut",
    evaluer: (c) => evaluerB11b(c),
  }),
  critere({
    id: "B11c",
    libelle: "Réponse directe sous le H1",
    famille: "structure",
    seuil: (r) =>
      `paragraphe de ${r.motsMinReponseSousH1} mots au moins, dans les ${r.fenetreReponseMots} premiers mots`,
    evaluer: (c, _x, r) => evaluerB11c(c, r),
  }),
  critere({
    id: "B13",
    libelle: "Maillage interne sortant",
    famille: "maillage",
    seuil: (r) => `${r.liensInternesMin} liens internes sains, dont la page propriétaire`,
    evaluer: (c, x, r) => evaluerB13(c, x, r),
  }),
  critere({
    id: "B14",
    libelle: "Auteur et dates honnêtes",
    famille: "metadonnees",
    seuil: () => "conforme",
    evaluer: (c, x) => evaluerB14(c, x),
  }),
]);
