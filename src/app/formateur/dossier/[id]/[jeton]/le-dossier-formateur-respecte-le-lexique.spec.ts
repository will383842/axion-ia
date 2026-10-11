/**
 * L5 — Le dossier en ligne du formateur respecte le lexique du chantier : aucun mot qui
 * ferait lire une relation de travail salariée, ni « obligatoire », ni « vous devez »,
 * ni « Grenoble ». Balaye les TEXTES de l'écran, les déclarations de l'étape 4, les
 * messages des actions et du composant.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DECLARATIONS_FORMATEUR,
  LIBELLE_PIECE,
} from "@/server/qualiopi/formateurs-independants/dossier-regles";

import { TEXTES } from "./textes";

const INTERDITS =
  /\b(poste|entretien|recrutement|salaire|rémunération|bienvenue|vous devez|obligatoire|agent commercial|grenoble|embauche)\b/i;

function chaines(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (typeof v === "function") return [String((v as (s: string) => string)("x"))];
  if (v && typeof v === "object") return Object.values(v).flatMap(chaines);
  return [];
}

const DOSSIER = join(process.cwd(), "src/app/formateur/dossier/[id]/[jeton]");
const SERVEUR = join(process.cwd(), "src/server/qualiopi/formateurs-independants");

describe("le dossier du formateur respecte le lexique", () => {
  it("textes de l'écran, déclarations et libellés des pièces", () => {
    const tout = [
      ...chaines(TEXTES),
      ...DECLARATIONS_FORMATEUR.map((d) => d.texte),
      ...Object.values(LIBELLE_PIECE),
    ];
    expect(tout.filter((t) => INTERDITS.test(t))).toEqual([]);
  });

  it("messages écrits en dur dans les actions, le composant et la couche données", () => {
    for (const f of [
      join(DOSSIER, "actions.ts"),
      join(DOSSIER, "DossierFormateur.tsx"),
      join(SERVEUR, "dossier.ts"),
      join(SERVEUR, "dossier-regles.ts"),
    ]) {
      const litteraux = [...readFileSync(f, "utf8").matchAll(/"([^"\n]{12,})"/g)].map((m) => m[1]!);
      expect(
        litteraux.filter((t) => INTERDITS.test(t)),
        f,
      ).toEqual([]);
    }
  });
});
