/**
 * 🔴 Le hub session chargeait TOUT le registre des stagiaires.
 *
 * `prisma.trainee.findMany({ where: { deletedAt: null } })` — sans `take`, sans
 * recherche — à CHAQUE ouverture d'une fiche session. Toute la table était
 * sérialisée vers le navigateur et rendue dans un `<select>`. Tenable sur une
 * base vierge, insoutenable en volume.
 *
 * ## Pourquoi ce témoin garde DEUX choses, et jamais une seule
 *
 * Un plafond seul aurait été **pire que le défaut** : au-delà de la borne, un
 * stagiaire devient ININSCRIPTIBLE, et rien à l'écran ne le dit. On aurait
 * remplacé une lenteur, visible et supportable, par une impossibilité muette.
 *
 * La règle gardée est donc indivisible : **borne ET recherche serveur ET aveu
 * de troncature**. Retirer l'un des trois doit rougir.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const PAGE = path.join(
  process.cwd(),
  "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/sessions/[id]/page.tsx",
);
const SECTION = path.join(process.cwd(), "src/components/admin/qualiopi/EnrollmentsSection.tsx");

const SOURCE_PAGE = fs.readFileSync(PAGE, "utf-8");
const SOURCE_SECTION = fs.readFileSync(SECTION, "utf-8");

describe("🔴 le sélecteur d'inscription est borné ET cherchable", () => {
  // Témoin positif : sans lui, un chemin faux rendrait une chaîne vide et
  // TOUTES les assertions « ne contient pas » passeraient sans rien mesurer.
  it("les deux fichiers sont bien LUS", () => {
    expect(SOURCE_PAGE.length).toBeGreaterThan(1000);
    expect(SOURCE_SECTION.length).toBeGreaterThan(1000);
    expect(SOURCE_PAGE).toContain("EnrollmentsSection");
  });

  it("ne charge plus le registre entier par un findMany nu", () => {
    expect(SOURCE_PAGE).not.toContain("prisma.trainee.findMany");
  });

  it("borne la liste — et la borne est une CONSTANTE nommée, pas un chiffre perdu", () => {
    expect(SOURCE_PAGE).toMatch(/listTrainees\(\{\s*\n?\s*limit: PLAFOND_STAGIAIRES_INSCRIPTIBLES/);
    expect(SOURCE_PAGE).toMatch(/const PLAFOND_STAGIAIRES_INSCRIPTIBLES = \d+;/);
  });

  it("offre la recherche SERVEUR — la contrepartie sans laquelle la borne exclut", () => {
    expect(SOURCE_PAGE).toContain("qStagiaire");
    expect(SOURCE_PAGE).toMatch(/search: rechercheStagiaire/);
    expect(SOURCE_SECTION).toMatch(/name="qStagiaire"/);
    expect(SOURCE_SECTION).toMatch(/method="get"/);
  });

  it("compte le REGISTRE, pas la page affichée", () => {
    // Sans ce compteur, l'écran ne peut pas dire « 200 sur 1 240 » : il dirait
    // « 200 », et 200 se lit comme « c'est tout ce qu'il y a ».
    expect(SOURCE_PAGE).toContain("countTrainees()");
    expect(SOURCE_SECTION).toContain("totalStagiairesRegistre");
  });

  it("AVOUE la troncature à l'écran", () => {
    expect(SOURCE_SECTION).toMatch(/listeTronquee/);
    expect(SOURCE_SECTION).toMatch(/n'y est peut-être pas/);
  });

  it("ne dit plus « tous déjà inscrits » quand c'est une recherche qui ne rend rien", () => {
    // Les deux situations appellent des gestes OPPOSÉS : dans un cas il n'y a
    // rien à faire, dans l'autre il faut élargir la recherche.
    expect(SOURCE_SECTION).toMatch(/Aucun stagiaire du registre ne correspond/);
  });
});
