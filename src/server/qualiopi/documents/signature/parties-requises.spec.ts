/**
 * Tests — parties-requises.ts
 *
 * Ce fichier porte un **test de propriété sur la source**, et c'est lui qui
 * compte le plus. Les tests de comportement ne verraient pas la divergence qu'il
 * interdit : un circuit qui déclarerait sa propre liste de parties passerait
 * tous ses tests, et ne casserait rien — jusqu'au jour où une pièce afficherait
 * « signée » alors que l'organisme ne l'a jamais contresignée.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  circuitPour,
  partiesRequisesPour,
  pieceSignable,
  TYPES_SIGNABLES,
} from "./parties-requises";

describe("matrice des circuits", () => {
  it("rend `null` — et pas une liste vide — pour une pièce qui ne se signe pas", () => {
    // Une liste vide ferait refuser `signerDocument` avec
    // « parties_requises_absentes », message incompréhensible pour une facture.
    // `null` dit la bonne chose : cette pièce n'est pas un engagement négocié.
    expect(partiesRequisesPour("facture")).toBeNull();
    expect(partiesRequisesPour("attestation")).toBeNull();
    expect(partiesRequisesPour("certificat_realisation")).toBeNull();
    expect(pieceSignable("facture")).toBe(false);
  });

  it("ne se laisse pas berner par une clé héritée d'Object.prototype", () => {
    // `CIRCUITS["constructor"]` rendrait une fonction sans le `hasOwnProperty`.
    expect(circuitPour("constructor")).toBeNull();
    expect(circuitPour("toString")).toBeNull();
    expect(partiesRequisesPour("__proto__")).toBeNull();
  });

  it("couvre les circuits du plan, ni plus ni moins", () => {
    // Liste EXHAUSTIVE et volontairement fastidieuse : ajouter un circuit sans
    // toucher ce test est impossible, et c'est le but — un circuit declare sans
    // site de generation est inatteignable (cf. refs-circuits.spec.ts).
    expect([...TYPES_SIGNABLES].sort()).toStrictEqual(
      [
        "autorisation_captation",
        "releve_connexion",
        "lettre_mission",
        "devis",
        "convention",
        "convention_tripartite",
        "contrat",
        "contrat_sous_traitance",
        "protocole_afest",
      ].sort(),
    );
  });

  it("🔴 l'organisme CONTRESIGNE — il signe en dernier, sauf exception nommée", () => {
    // Il conclut ce que les autres ont accepté. L'ordre est celui de la séquence
    // contractuelle, et sur le canal fournisseur il devient l'ordre `preserved`
    // de la submission. Le trier « pour faire propre » inverserait la séquence.
    //
    // ⚠️ L'exception est LISTÉE, pas devinée : un test qui dirait « sauf quand
    // ça ne marche pas » ne garderait plus rien. Ajouter une entrée ici doit
    // rester un geste délibéré.
    const SIGNE_EN_PREMIER = new Set(["protocole_afest"]);
    for (const type of TYPES_SIGNABLES) {
      const parties = partiesRequisesPour(type);
      expect(parties).not.toBeNull();
      const i = parties!.indexOf("axionia");
      if (i === -1) continue;
      if (SIGNE_EN_PREMIER.has(type)) expect(i).toBe(0);
      else expect(i).toBe(parties!.length - 1);
    }
  });

  it("🔴 le protocole AFEST fait exception, et c'est voulu", () => {
    // Ici l'organisme signe EN PREMIER : c'est lui qui propose le cadrage
    // D.6313-3-1 à l'entreprise, puis au bénéficiaire. C'est l'ordre du plan
    // §II.2 (« Organisme + Entreprise + Bénéficiaire »), pas un accident de
    // saisie — d'où l'exception explicite du test précédent.
    expect(partiesRequisesPour("protocole_afest")).toStrictEqual([
      "axionia",
      "client",
      "beneficiaire",
    ]);
  });

  it("aucun circuit ne déclare deux fois la même partie", () => {
    // Un doublon rendrait `signee` inatteignable ou trivial selon le sens du
    // recoupement — dans les deux cas, un statut qui ne veut rien dire.
    for (const type of TYPES_SIGNABLES) {
      const parties = partiesRequisesPour(type)!;
      expect(new Set(parties).size).toBe(parties.length);
    }
  });

  it("aucun circuit n'est vide", () => {
    for (const type of TYPES_SIGNABLES) {
      expect(partiesRequisesPour(type)!.length).toBeGreaterThan(0);
    }
  });
});

/** Fichiers `.ts`/`.tsx` de `src/`, hors tests et hors ce module. */
function sourcesApplicatives(): string[] {
  const racine = join(process.cwd(), "src");
  const trouves: string[] = [];
  const parcourir = (dossier: string): void => {
    for (const entree of readdirSync(dossier)) {
      const chemin = join(dossier, entree);
      if (statSync(chemin).isDirectory()) {
        if (entree !== "node_modules") parcourir(chemin);
        continue;
      }
      if (!/\.tsx?$/.test(entree)) continue;
      if (/\.spec\.tsx?$/.test(entree)) continue;
      if (entree === "parties-requises.ts") continue;
      trouves.push(chemin);
    }
  };
  parcourir(racine);
  return trouves;
}

describe("🔴 test de propriété sur la SOURCE", () => {
  it("aucun appelant ne construit sa propre liste de parties requises", () => {
    // C'est LA garde de ce module. Un circuit qui écrirait
    // `partiesRequises: ["client", "axionia"]` en dur passerait tous ses propres
    // tests et divergerait en silence du SSOT le jour où la matrice change.
    //
    // ⚠️ Si ce test échoue, la bonne réaction est de faire passer l'appelant par
    // `partiesRequisesPour()`, JAMAIS d'assouplir la détection.
    const fautifs: string[] = [];
    for (const fichier of sourcesApplicatives()) {
      const source = readFileSync(fichier, "utf8");
      if (!source.includes("partiesRequises")) continue;
      // Une affectation de `partiesRequises` par un littéral de tableau.
      if (/partiesRequises\s*:\s*\[/.test(source)) {
        fautifs.push(fichier.replace(process.cwd(), "").replace(/\\/g, "/"));
      }
    }
    expect(fautifs).toStrictEqual([]);
  });
});

describe("🔴 canal du devis — épinglé", () => {
  // Ce test ne vérifie pas un comportement : il rend DÉLIBÉRÉ un changement qui
  // serait autrement invisible. Le devis a basculé `fournisseur` → `maison` le
  // 2026-07-30, après le constat que `POST /api/templates/pdf` n'existe pas sur
  // l'instance DocuSeal de production (endpoint Pro, 404 vérifié contre le
  // conteneur réel). Le repasser sur le canal fournisseur sans rétablir un
  // moyen de faire signer LA PIÈCE ELLE-MÊME ramènerait le défaut d'origine :
  // le client lisait un document détaillé et en signait un autre, à trois
  // champs, qui ne désignait pas son objet.
  it("le devis se signe sur le canal MAISON, sur la pièce elle-même", () => {
    expect(circuitPour("devis")?.canal).toBe("maison");
  });

  it("le devis reste à deux parties, l'organisme concluant en dernier", () => {
    // La bascule de canal ne change PAS qui signe. Si elle l'avait fait, un
    // devis passerait `signee` sur la seule signature du client.
    expect(partiesRequisesPour("devis")).toStrictEqual(["client", "axionia"]);
  });
});
