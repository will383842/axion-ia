/**
 * 🛑 GARDE — les écrans du parcours réservation lisent leurs droits AU MÊME ENDROIT.
 *
 * ## Le défaut que cette garde ferme
 *
 * Mesuré le 2026-08-27. Le SSOT `@/server/auth/habilitations` décrivait qui
 * ÉCRIT et qui ENGAGE, jamais qui REGARDE. Chaque page tranchait donc seule :
 *
 * | | |
 * |---|---|
 * | pages `(admin)` | **305** |
 * | fermées par une liste de rôles ÉCRITE EN DUR | **64** |
 * | passant par le SSOT | **0** |
 *
 * Et le résultat n'était pas un périmètre, c'était une dérive :
 * `/qualiopi/facturation` autorisait `["admin","super_admin","editor","reader"]`.
 * **`reader` voyait le hub de facturation ; `secretaire` non** — alors que le
 * SSOT écrit, en toutes lettres, qu'elle « gère le système ».
 *
 * C'est exactement le défaut du 2026-08-17 (`requireAdminWrite` testait une
 * liste en dur d'où `responsable_qualite` et `secretaire` étaient absents,
 * rendant les deux rôles inertes). La liste avait déménagé dans le SSOT « parce
 * qu'une liste de rôles écrite dans la garde est invisible depuis la matrice ».
 * **Le déménagement n'avait jamais été propagé aux pages.**
 *
 * ## Ce que cette garde vérifie
 *
 * Que plus aucune page des quatre routes du parcours ne porte de liste de rôles
 * à elle. Elle ne dit rien du PÉRIMÈTRE (qui a droit à quoi) : ça, c'est le SSOT
 * qui le porte, et c'est le sujet de ses propres tests.
 *
 * ## Ce que cette garde ne couvre PAS
 *
 * Les **285 autres pages** de la console, dont ~45 portent encore une liste en
 * dur. Elles ne sont pas dans le périmètre décidé (devis, sessions, facturation,
 * clients) et cette garde ne prétend pas le contraire : elle rougirait à tort
 * sur un travail que personne n'a demandé.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = "src/app/[locale]/(admin)/[adminPrefix]/qualiopi";
const ROUTES = ["devis", "sessions", "facturation", "clients"] as const;

/** Les formes de liste de rôles écrite à la main, vues dans le dépôt. */
const EN_DUR = [
  /role !== "admin" && role !== "super_admin"/,
  /const rolesAutorises = \[/,
  /role === "admin" \|\| role === "super_admin"/,
];

function pages(racine: string): string[] {
  const sortie: string[] = [];
  const marche = (d: string): void => {
    for (const nom of readdirSync(d)) {
      const p = join(d, nom);
      if (statSync(p).isDirectory()) {
        marche(p);
        continue;
      }
      if (nom === "page.tsx") sortie.push(p);
    }
  };
  marche(join(process.cwd(), racine));
  return sortie;
}

describe("🛑 le parcours réservation lit ses droits dans le SSOT", () => {
  it("aucune page ne porte sa propre liste de rôles", () => {
    const fautives: string[] = [];
    let scannees = 0;

    for (const route of ROUTES) {
      const fichiers = pages(join(RACINE, route));
      // 🔑 CONTRE-TÉMOIN. Le mode d'échec le plus fréquent d'une garde qui
      // parcourt des dossiers, c'est de ne rien parcourir — et de rester verte.
      // (Ce dépôt l'a payé avec un glob dont les crochets étaient lus comme une
      // classe de caractères : la garde scannait presque rien, en silence.)
      expect(
        fichiers.length,
        `Aucune page scannée sous « ${route} » : cette garde ne mesure plus rien. ` +
          `La route a-t-elle été déplacée ?`,
      ).toBeGreaterThan(1);
      scannees += fichiers.length;

      for (const chemin of fichiers) {
        const source = readFileSync(chemin, "utf8");
        if (EN_DUR.some((motif) => motif.test(source))) {
          fautives.push(chemin.replace(process.cwd(), "").replace(/\\/g, "/"));
        }
      }
    }

    expect(scannees, "le parcours porte une vingtaine d'écrans").toBeGreaterThan(15);
    expect(
      fautives,
      `Ces pages décident des droits toutes seules :\n  ${fautives.join("\n  ")}\n\n` +
        `Une liste de rôles écrite dans la page est invisible depuis la matrice : ` +
        `on peut donner à un rôle le droit d'attester sans voir qu'il ne peut même ` +
        `pas ouvrir l'écran. Passer par \`gardePage()\` et \`peutEngager()\`.`,
    ).toEqual([]);
  });

  it("🔑 …et elles passent TOUTES par la garde partagée", () => {
    // Sans ce second témoin, supprimer purement et simplement le test de rôle
    // ferait passer le premier au vert — en ouvrant les écrans à tout le monde,
    // y compris à qui n'a aucun rôle. « Plus de liste en dur » n'est un progrès
    // que si quelque chose a pris le relais.
    const sansGarde: string[] = [];
    for (const route of ROUTES) {
      for (const chemin of pages(join(RACINE, route))) {
        const source = readFileSync(chemin, "utf8");
        if (!source.includes("gardePage(")) {
          sansGarde.push(chemin.replace(process.cwd(), "").replace(/\\/g, "/"));
        }
      }
    }
    expect(
      sansGarde,
      `Ces pages n'ont plus AUCUNE garde de rôle :\n  ${sansGarde.join("\n  ")}`,
    ).toEqual([]);
  });

  it("🔑 les écrans de CRÉATION restent fermés au lecteur", () => {
    // `reader` est le seul rôle absent de `ROLES_ECRITURE`. Un écran `/new` ou
    // `/edit` ouvert en « consultation » lui promettrait un formulaire dont
    // toutes les actions échoueraient — la promesse non tenue que P7 cherchait.
    const malGardees: string[] = [];
    let ecransDeCreation = 0;
    for (const route of ROUTES) {
      for (const chemin of pages(join(RACINE, route))) {
        const normalise = chemin.replace(/\\/g, "/");
        if (!/\/(new|edit)\/page\.tsx$/.test(normalise)) continue;
        ecransDeCreation++;
        const source = readFileSync(chemin, "utf8");
        if (!source.includes('gardePage("ecriture"')) {
          malGardees.push(normalise.replace(process.cwd().replace(/\\/g, "/"), ""));
        }
      }
    }
    // 🔑 Ce compteur est le contre-témoin, et mon premier jet l'avait écrit À
    // L'ENVERS : il assertait que la liste des MAL gardées était non vide — donc
    // il exigeait un défaut pour passer au vert. Ce qu'il faut prouver, c'est que
    // le balayage a bien VU des écrans de création.
    expect(
      ecransDeCreation,
      "aucun écran de création trouvé : le balayage ne voit rien",
    ).toBeGreaterThan(3);
    expect(
      malGardees,
      `Ces écrans créent ou modifient et ne sont pas gardés en écriture :\n  ${malGardees.join("\n  ")}`,
    ).toEqual([]);
  });
});
