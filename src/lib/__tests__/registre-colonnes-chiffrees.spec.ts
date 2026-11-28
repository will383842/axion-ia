// PR P (#2464 pt 27) : le registre des colonnes chiffrées couvre tout ce que le module apporteurs chiffre.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { COLONNES_CHIFFREES } from "../pii-colonnes-chiffrees";

function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === "__tests__" ? [] : fichiers(p);
    return p.endsWith(".ts") ? [p] : [];
  });
}

const RACINE = join(process.cwd(), "src/features/apporteurs-reseau");

/** Champs écrits à côté d'un `encryptPii(` ou `chiffrerContenuPiece(` : « champ: encryptPii(… ». */
function champsChiffres(): Array<{ fichier: string; champ: string }> {
  const trouves: Array<{ fichier: string; champ: string }> = [];
  for (const f of fichiers(RACINE)) {
    const src = readFileSync(f, "utf8");
    const re = /(?:^|[\s{,(?])(\w+)\s*:\s*(?:[^,\n]*\?\s*)?(?:encryptPii|chiffrerContenuPiece)\(/gm;
    for (const m of src.matchAll(re))
      trouves.push({ fichier: f.replace(RACINE, ""), champ: m[1] as string });
  }
  return trouves;
}

/**
 * Attribution explicite « fichier:champ » -> modèles écrits. Un champ chiffré nouveau, ou un fichier nouveau, fait échouer
 * le test tant qu'il n'est pas attribué ICI et inscrit au registre pour CE modèle (pas seulement un champ homonyme).
 */
const ATTRIBUTION: Record<string, readonly string[]> = {
  "/changement-iban.ts:iban": [
    "apporteurChangementIban",
    "apporteurIbanHistorique",
    "apporteurReseau",
  ],
  "/changement-iban.ts:octets": ["apporteurChangementIbanRib"],
  "/correction-nom.ts:nom": ["apporteurReseau"],
  "/correction-nom.ts:prenom": ["apporteurReseau"],
  "/donnees.ts:prenom": ["apporteurReseau"],
  "/donnees.ts:nom": ["apporteurReseau"],
  "/donnees.ts:email": ["apporteurReseau"],
  "/donnees.ts:telephone": ["apporteurReseau"],
  "/messages-recus.ts:excerpt": ["apporteurMessageRecu"],
  "/verification.ts:telephone": ["apporteurReseau"],
  "/donnees.ts:iban": ["apporteurReseau"],
  "/donnees.ts:octets": ["pieceApporteurContenu"],
  "/presentations.ts:personneNom": ["presentationEntreprise"],
  "/presentations.ts:personneEmail": ["presentationEntreprise"],
  "/reprise-historique-iban.ts:iban": ["apporteurIbanHistorique"],
  "/verification.ts:prenom": ["apporteurReseau"],
  "/verification.ts:nom": ["apporteurReseau"],
  "/verification.ts:email": ["apporteurReseau"],
};

describe("registre des colonnes chiffrées", () => {
  const connus = new Set(COLONNES_CHIFFREES.map((c) => c.champ));
  const couples = new Set(COLONNES_CHIFFREES.map((c) => `${c.modele}.${c.champ}`));

  it("chaque couple (fichier, champ) chiffré est attribué à un modèle, et (modèle, champ) figure au registre", () => {
    const sansAttribution: string[] = [];
    const absents: string[] = [];
    for (const t of champsChiffres()) {
      const modeles = ATTRIBUTION[`${t.fichier}:${t.champ}`];
      if (!modeles) {
        sansAttribution.push(`${t.fichier}:${t.champ}`);
        continue;
      }
      for (const m of modeles) if (!couples.has(`${m}.${t.champ}`)) absents.push(`${m}.${t.champ}`);
    }
    expect(sansAttribution).toEqual([]);
    expect(absents).toEqual([]);
  });

  it("chaque champ chiffré par le module apporteurs figure au registre", () => {
    const trouves = champsChiffres();
    expect(trouves.length).toBeGreaterThan(10); // la regex voit bien les écritures
    const manquants = trouves.filter((t) => !connus.has(t.champ));
    expect(manquants).toEqual([]);
  });

  it("chaque entrée est cohérente : v2 et octets-liés portent leur AAD, formats connus", () => {
    for (const c of COLONNES_CHIFFREES) {
      expect(["v1", "v2", "octets"]).toContain(c.format);
      if (c.format === "v2" && c.champ === "iban" && c.modele !== "apporteurReseau") {
        expect(c.aad?.({ id: "x" })).toMatch(/^(changement-iban|iban-historique):x$/);
      }
    }
  });

  it("les tables à déclencheur de rotation sont marquées", () => {
    const marques = COLONNES_CHIFFREES.filter((c) => c.declencheur)
      .map((c) => c.modele)
      .sort();
    expect(marques).toEqual([
      "apporteurChangementIban",
      "apporteurChangementIbanRib",
      "apporteurIbanHistorique",
    ]);
  });
});
