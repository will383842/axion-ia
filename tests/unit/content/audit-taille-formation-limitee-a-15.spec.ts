// Correction du dirigeant (20/11/2026) : l'AUDIT convient aux entreprises de 2 à 250 salariés ;
// seule la FORMATION de l'après-midi est limitée à 15 personnes. Un texte public qui associe
// « audit » ou « Journée IA » à une limite de 15 personnes, sans dire que la limite concerne la
// formation, laisse croire que l'audit est réservé aux entreprises de 15 personnes.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = resolve(__dirname, "../../..");

// « jusqu'à 15 », « 15 personnes », « 15 participants » — mais pas « 2 à 15 » / « 2-15 » (formation).
const LIMITE_15 =
  /(?<!\d\s?(?:à|-|to)\s?)(?:jusqu.{1,3}(?:à|a)\s?15\b|\b15\s+(?:personnes|participants|pers\b|people)|up to 15\b)/i;
const SUJET_AUDIT_OU_JOURNEE = /\baudit\b|journ[ée]e\s+ia/i;

function fichiersPublics(): string[] {
  const sortie = execFileSync(
    "git",
    [
      "ls-files",
      "src/app",
      "src/components",
      "src/content",
      "src/lib",
      "messages",
      "public/llms.txt",
    ],
    { cwd: RACINE, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return sortie
    .split("\n")
    .filter((f) => /\.(tsx?|json|txt)$/.test(f))
    .filter(
      (f) => !/\.(spec|test)\.|__tests__|\(admin\)|\/admin|server\/|catalog|\/formations\//.test(f),
    );
}

/** Phrases : on coupe sur « . » et « ; » suivis d'une espace (les deux-points restent dans la phrase). */
function phrasesFautives(texte: string): string[] {
  return texte
    .split(/[.;!?](?:\s|$)|["`\n]/)
    .filter((p) => LIMITE_15.test(p) && SUJET_AUDIT_OU_JOURNEE.test(p) && !/formation/i.test(p))
    .map((p) => p.trim().slice(0, 160));
}

describe("la limite de 15 personnes ne qualifie que la formation", () => {
  it("détecte la formulation fautive et accepte la formulation corrigée", () => {
    expect(
      phrasesFautives("La Journée IA coûte 1 490 €, pour une équipe jusqu’à 15 personnes."),
    ).toHaveLength(1);
    expect(phrasesFautives("L’audit est compris, équipe de 15 personnes maximum.")).toHaveLength(1);
    expect(phrasesFautives("L’audit : jusqu’à 15 participants.")).toHaveLength(1);
    expect(
      phrasesFautives(
        "L’audit convient aux entreprises de 2 à 250 salariés ; la formation de l’après-midi accueille jusqu’à 15 personnes.",
      ),
    ).toHaveLength(0);
    // « 2 à 15 personnes » décrit une formation : jamais signalé.
    expect(phrasesFautives("Audit et formation : groupe de 2 à 15 personnes.")).toHaveLength(0);
  });

  it("aucun texte public n'associe « audit » ou « Journée IA » à 15 personnes sans « formation »", () => {
    const fautes: string[] = [];
    for (const f of fichiersPublics()) {
      for (const p of phrasesFautives(readFileSync(resolve(RACINE, f), "utf8")))
        fautes.push(`${f} : ${p}`);
    }
    expect(fautes).toEqual([]);
  });

  it("l'audit annonce 2 à 250 salariés sur la page Journée IA et la FAQ des prix", () => {
    for (const f of [
      "src/app/[locale]/journee-ia/contenu.ts",
      "src/app/[locale]/prix-audit-ia/contenu.ts",
    ]) {
      expect(readFileSync(resolve(RACINE, f), "utf8")).toMatch(
        /entreprises de 2 à 250 salariés|2 à 250 salariés/,
      );
    }
  });
});
