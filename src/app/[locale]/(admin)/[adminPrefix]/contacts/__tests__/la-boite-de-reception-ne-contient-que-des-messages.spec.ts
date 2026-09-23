/**
 * La boîte de réception ne contient que des messages, et « À traiter » tient
 * ses promesses.
 *
 * 🔴 MESURÉ EN PRODUCTION LE 2026-09-23 : 12 des 18 lignes actives de
 *    « Messages » étaient des captures du tunnel apporteurs — « Contact
 *    enregistré à l'écran 1 du dossier », c'est-à-dire la trace d'un formulaire
 *    EN COURS de remplissage. Les deux tiers d'une boîte de réception occupés
 *    par une file qui se pilote ailleurs, et qui noyaient les six vrais
 *    messages.
 *
 * Ces gardes LISENT les pages, parce que c'est là que la décision se prend :
 * une prop oubliée au prochain remaniement ne laisserait aucune trace ailleurs,
 * et le seul symptôme serait une boîte qui se remplit à nouveau de bruit — ce
 * que personne ne remarque avant des semaines.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RACINE = "src/app/[locale]/(admin)/[adminPrefix]/contacts";
const lire = (chemin: string) => readFileSync(join(process.cwd(), RACINE, chemin), "utf8");

describe("la boîte de réception ne montre pas les apporteurs", () => {
  const messages = lire("messages/page.tsx");

  it("« Messages » exclut explicitement le périmètre apporteurs", () => {
    expect(messages).toContain('perimetre="hors-apporteurs"');
  });

  it("n'exclut PAS par une négation sur un chemin JSON", () => {
    // `NOT` sur `details.subType` ferait disparaître toutes les lignes où la
    // clé est ABSENTE — c'est-à-dire presque tous les messages. Le périmètre
    // nommé, lui, énumère le cas absent (cf. `FILTRE_HORS_APPORTEUR_PRISMA`).
    expect(messages).not.toMatch(/NOT:\s*FILTRE_APPORTEUR_PRISMA/);
  });
});

describe("la vue « À traiter »", () => {
  const aTraiter = lire("a-traiter/page.tsx");

  it("force ses trois critères au lieu de les proposer", () => {
    // Une vue nommée « À traiter » qu'une URL pourrait élargir en silence ne
    // vaudrait pas mieux qu'un filtre : les trois valeurs sont posées APRÈS
    // l'étalement de `sp`, donc elles gagnent.
    expect(aTraiter).toMatch(/\.\.\.sp,\s*replyStatus:\s*"unanswered",\s*tri:\s*"ancien"/);
    expect(aTraiter).toContain('perimetre="hors-apporteurs"');
  });

  it("se lit du plus ancien au plus récent", () => {
    // Une liste de choses à faire se lit par le haut, et le plus vieux message
    // est celui qui a le plus attendu. C'est l'inverse d'un journal.
    expect(aTraiter).toContain('tri: "ancien"');
  });
});
