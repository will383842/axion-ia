/**
 * 🔴 LE MÊME FAIT N'A PAS LES MÊMES SUITES SELON QUI IL VISE.
 *
 * Le registre des incidents s'est ouvert aux SALARIÉS (recette du 2026-09-03 :
 * « Déclarer une absence » créait déjà des incidents à leur nom). Or consigner
 * un désistement sur un salarié, c'est écrire à son dossier RH ; sur un
 * prestataire, cela nourrit la reconduction (art. 7 et 8 de la procédure de
 * sous-traitance). Rien ne les distinguait à l'écran hormis un « (salarié) »
 * collé au bout du nom.
 *
 * Deux invariants, et ils tombent tous les deux si on ne les écrit pas ici.
 *
 * ## 1. La nature ne se relit JAMAIS dans le libellé
 *
 * Le libellé affiche déjà « (salarié) » / « (sous-traitant) ». La tentation est
 * de le parser. Ce serait laisser un texte d'AFFICHAGE décider du sens d'un
 * champ : la première retouche de vocabulaire (« salariée », « CDI », une
 * majuscule) casserait la règle sans qu'aucun test ne rougisse, et l'écran
 * annoncerait un dossier RH à un prestataire. Elle se dérive du `statut` en
 * base, elle voyage typée, et `dirigeant` compte comme INTERNE.
 *
 * ## 2. La phrase se dérive du CHOIX, elle ne récite pas les deux cas
 *
 * La première correction affichait les deux cas en permanence. Une phrase qui
 * sert les deux ne dit plus rien de celui qu'on a sous les yeux — c'est le
 * défaut exact trouvé le même jour sur l'alerte de convocation, où un message
 * commun aux deux modalités promettait une porte à une visioconférence.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const FORMULAIRE = readFileSync(
  join(process.cwd(), "src/components/admin/qualiopi/IncidentForm.tsx"),
  "utf8",
);
const PAGE = readFileSync(
  join(process.cwd(), "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/incidents/page.tsx"),
  "utf8",
);

describe("🔴 la nature de l'intervenant se dérive du statut, jamais du libellé", () => {
  it("la page construit la nature depuis `statut`", () => {
    expect(PAGE).toContain("NATURE_PAR_STATUT");
    expect(PAGE).toMatch(/NATURE_PAR_STATUT\[t\.statut\]/);
  });

  it("le dirigeant-formateur est un INTERNE, pas un prestataire", () => {
    // Sa reconduction ne se pose pas : il ne se sous-traite pas à lui-même.
    const bloc = PAGE.slice(PAGE.indexOf("NATURE_PAR_STATUT"), PAGE.indexOf("const intervenants"));
    expect(bloc).toMatch(/salarie:\s*"interne"/);
    expect(bloc).toMatch(/dirigeant:\s*"interne"/);
    expect(bloc).toMatch(/sous_traitant:\s*"externe"/);
  });

  it("un organisme sous-traitant est externe sans avoir de statut à lire", () => {
    const bloc = PAGE.slice(PAGE.indexOf("...organismes.map"));
    expect(bloc.slice(0, 400)).toContain('nature: "externe" as const');
  });

  it("🔴 le formulaire ne parse PAS le libellé pour retrouver la nature", () => {
    // Aucune inspection de chaîne sur `libelle` : ni includes, ni regex, ni
    // découpage sur la parenthèse. La nature arrive typée ou pas du tout.
    expect(FORMULAIRE).not.toMatch(/libelle.*\.(includes|match|indexOf|split|startsWith)/);
    expect(FORMULAIRE).not.toMatch(/\(salari[ée]\)/);
  });

  it("la prop rend `nature` OBLIGATOIRE — un appelant qui l'oublie ne compile pas", () => {
    expect(FORMULAIRE).toContain(
      'intervenants?: Array<{ valeur: string; libelle: string; nature: "interne" | "externe" }>;',
    );
  });
});

describe("🔴 la phrase de conséquence se dérive du choix", () => {
  /** Le paragraphe qui annonce les suites, isolé de ses voisins. */
  function paragrapheDesSuites(): string {
    const debut = FORMULAIRE.indexOf("intervenantChoisi === undefined");
    expect(debut, "la phrase ne se dérive plus du choix").toBeGreaterThan(-1);
    return FORMULAIRE.slice(debut, FORMULAIRE.indexOf("</p>", debut));
  }

  it("elle lit l'entrée choisie, pas seulement sa valeur", () => {
    expect(FORMULAIRE).toContain(
      "const intervenantChoisi = intervenants.find((i) => i.valeur === intervenant);",
    );
  });

  it("elle branche sur `nature`, et NOMME la personne dans les deux cas", () => {
    const bloc = paragrapheDesSuites();
    expect(bloc).toContain('intervenantChoisi.nature === "externe"');
    // Nommer la personne : « ce fait nourrira la reconduction » sans dire de
    // qui laisse l'agent supposer qu'il s'agit de celui qu'il vient de choisir.
    expect((bloc.match(/intervenantChoisi\.libelle/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("🔴 la branche INTERNE ne parle jamais de reconduction", () => {
    // C'est l'erreur que l'écran commettait : annoncer à un salarié une suite
    // qui n'existe que pour un prestataire.
    const bloc = paragrapheDesSuites();
    const interne = bloc.slice(bloc.lastIndexOf(") : ("));
    expect(interne).toContain("dossier RH");
    expect(interne).toMatch(/ne joue sur aucune reconduction|aucune reconduction/);
    expect(interne).not.toMatch(/art\. 7/);
  });

  it("les deux branches redisent d'écrire un FAIT, jamais un jugement", () => {
    // C'est ce qui rend le registre opposable à la reconduction (art. 8) et
    // soutenable dans un dossier RH. La consigne ne peut pas dépendre du cas.
    //
    // 🔴 On compte sur le texte NORMALISÉ, jamais sur la source telle quelle :
    // Prettier reformate librement le JSX et coupe « jamais un jugement » au
    // milieu, sur trois lignes et un `{" "}`. Une assertion posée sur la forme
    // du fichier rougirait au prochain passage du formateur sans qu'un seul mot
    // ait changé à l'écran — et c'est bien l'écran qu'on juge ici.
    const lisible = paragrapheDesSuites()
      .replace(/\{" "\}/g, " ")
      .replace(/\s+/g, " ");
    expect((lisible.match(/jamais un jugement/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("le changement de texte est ANNONCÉ aux lecteurs d'écran", () => {
    // Le paragraphe change sous un <select> déjà quitté au clavier.
    expect(FORMULAIRE).toContain('aria-live="polite"');
  });
});
