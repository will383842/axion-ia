/**
 * Garde — personne n'écrit un statut de revue que personne ne sait lire.
 *
 * ## Ce que cette garde a vu rougir avant d'être écrite
 *
 * `RevueDirection.statut` est une colonne `VarChar(20)` LIBRE : le schéma
 * n'impose rien, et le schéma Zod de l'action ne protège que l'action. Deux
 * écrivains sont passés à côté :
 *
 *   - `prisma/seeds/qualiopi/demo.ts` écrivait `"valide"` ;
 *   - le spec de ce seed AFFIRMAIT `"valide"`, verrouillant la faute.
 *
 * Toute l'application lit `"validee"`. La revue de démonstration existait donc,
 * complète — trois décisions, trois actions, instantané d'indicateurs — et ne
 * couvrait rien : l'indicateur 32 ⭐ restait « à compléter », et l'écran
 * affichait « Validées 0 » au-dessus d'une ligne « valide ».
 *
 * ## Comment la garde décide
 *
 * Elle balaie le code source à la recherche des littéraux collés à un `statut:`
 * dans un voisinage de `revueDirection` / `RevueDirection`, et refuse tout ce
 * qui n'est pas dans `STATUTS_REVUE`. La liste des statuts est IMPORTÉE, jamais
 * recopiée : ajouter un statut à la source suffit, la garde suit.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, it, expect } from "vitest";

import {
  LIBELLES_STATUT_REVUE,
  STATUTS_REVUE,
  STATUT_REVUE_COUVRANTE,
  estStatutRevueConnu,
  libelleStatutRevue,
} from "./statuts-revue";

const RACINES = [join(process.cwd(), "src"), join(process.cwd(), "prisma", "seeds")];
const EXTENSIONS = [".ts", ".tsx"];

function fichiers(dossier: string): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(dossier)) {
    if (entree === "node_modules" || entree === "generated") continue;
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) trouves.push(...fichiers(chemin));
    else if (EXTENSIONS.some((e) => entree.endsWith(e))) trouves.push(chemin);
  }
  return trouves;
}

/**
 * Les littéraux `statut: "…"` écrits DANS un appel Prisma sur `revueDirection`.
 *
 * ⚠️ Le premier jet de cette garde retenait tout littéral `statut:` d'un fichier
 * qui mentionne « revueDirection » quelque part. Elle a rougi sur dix-sept
 * statuts d'AUTRES tables du même seed (« emise », « salarie », « publie »…) :
 * une garde qui crie sur ce qu'elle ne vise pas se fait désarmer, et c'est ainsi
 * qu'on finit par la retirer. On borne donc à l'appel lui-même.
 *
 * 🔑 Cette garde ne travaille pas seule, et c'est délibéré : `RevueDirectionDemo`
 * type désormais son champ `statut` en `StatutRevue`, si bien qu'un littéral
 * fautif ne COMPILE plus. Le type attrape les objets typés, ce balayage attrape
 * les objets écrits à la volée dans un `create` / `update` / `upsert`.
 */
function statutsEcrits(source: string): string[] {
  const trouves: string[] = [];
  const appels = /prisma\.revueDirection\.(?:create|update|upsert|updateMany|createMany)\(/g;
  for (const appel of source.matchAll(appels)) {
    const debut = appel.index ?? 0;
    const fenetre = source.slice(debut, debut + 1500);
    for (const m of fenetre.matchAll(/statut:\s*"([a-z_]+)"/g)) trouves.push(m[1] ?? "");
  }
  return trouves;
}

describe("statuts de revue de direction", () => {
  const tous = RACINES.flatMap((r) => fichiers(r));

  it("balaie réellement le dépôt (témoin de non-vacuité)", () => {
    expect(tous.length).toBeGreaterThan(500);
  });

  it("aucun fichier n'écrit un statut de revue hors de la liste canonique", () => {
    const fautes: string[] = [];
    for (const fichier of tous) {
      // Ce fichier-ci CITE les valeurs fautives pour les documenter.
      if (fichier.endsWith("statuts-revue.spec.ts")) continue;
      for (const statut of statutsEcrits(readFileSync(fichier, "utf8"))) {
        if (statut !== "" && !estStatutRevueConnu(statut)) {
          fautes.push(`${relative(process.cwd(), fichier)} → statut: "${statut}"`);
        }
      }
    }
    expect(fautes).toEqual([]);
  });

  it("le statut qui couvre l'indicateur 32 fait bien partie de la liste", () => {
    expect(STATUTS_REVUE).toContain(STATUT_REVUE_COUVRANTE);
  });

  it("chaque statut porte un libellé, et aucun libellé n'est sa propre valeur", () => {
    for (const statut of STATUTS_REVUE) {
      const libelle = LIBELLES_STATUT_REVUE[statut];
      expect(libelle.trim().length).toBeGreaterThan(0);
      expect(libelle).not.toBe(statut);
    }
  });

  it("un statut inconnu est SIGNALÉ, jamais recopié tel quel", () => {
    // 🔑 C'est le repli silencieux (`LIBELLES[s] ?? s`) qui a permis à
    // « valide » de passer pour un statut légitime à l'écran.
    const rendu = libelleStatutRevue("valide");
    expect(rendu).toContain("inconnu");
    expect(rendu).not.toBe("valide");
    expect(libelleStatutRevue(STATUT_REVUE_COUVRANTE)).toBe("Validée");
  });
});
