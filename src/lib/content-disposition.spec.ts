/**
 * 🔴 Une pièce Qualiopi s'OUVRE — c'est ce que l'audit blanc a demandé.
 *
 * Constat : « aucune pièce du critère 1 n'a pu être ouverte ». Toutes les
 * routes forçaient `attachment`, jusque dans `r2-storage.ts` dont l'option
 * s'appelait `downloadFilename` et imposait l'enregistrement **sans le dire**.
 *
 * Deux gardes ici :
 *   1. la règle elle-même (`?dl=1` et rien d'autre) ;
 *   2. 🔴 **un test statique qui interdit `attachment` écrit en dur** dans une
 *      route qui sert une pièce. Sans lui, la sixième route referait le défaut,
 *      et personne ne le verrait avant le prochain audit.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  dispositionDemandee,
  enTeteContentDisposition,
  lienTelechargement,
  nomFichierSurEnTete,
  PARAM_TELECHARGEMENT,
} from "./content-disposition";

const U = (q: string): string => `https://axion-ia.com/api/qualiopi/documents/abc${q}`;

describe("🔴 le défaut est OUVRIR, l'enregistrement se demande", () => {
  it("sans paramètre, la pièce s'ouvre", () => {
    expect(dispositionDemandee(U(""))).toBe("inline");
  });

  it("`?dl=1` demande l'enregistrement", () => {
    expect(dispositionDemandee(U("?dl=1"))).toBe("attachment");
  });

  it("🔴 `?dl=0` NE télécharge PAS", () => {
    // Traiter « le paramètre est présent » comme « télécharger » ferait de
    // `?dl=0` un téléchargement — le genre d'inversion qui se relit sans qu'on
    // la voie, et qui ne se constate qu'en production.
    expect(dispositionDemandee(U("?dl=0"))).toBe("inline");
    expect(dispositionDemandee(U("?dl="))).toBe("inline");
    expect(dispositionDemandee(U("?dl=true"))).toBe("inline");
  });

  it("le paramètre cohabite avec d'autres", () => {
    expect(dispositionDemandee(U("?v=2&dl=1"))).toBe("attachment");
  });

  it("accepte une URL déjà construite", () => {
    expect(dispositionDemandee(new URL(U("?dl=1")))).toBe("attachment");
  });
});

describe("🔴 le lien de téléchargement s'ajoute sans casser l'existant", () => {
  it("sur un lien nu", () => {
    expect(lienTelechargement("/api/qualiopi/documents/abc")).toBe(
      "/api/qualiopi/documents/abc?dl=1",
    );
  });

  it("sur un lien qui a déjà des paramètres", () => {
    // Écrire `?` en dur écraserait la requête existante : le lien mènerait
    // ailleurs, et le bouton « Enregistrer » servirait autre chose.
    expect(lienTelechargement("/x?v=2")).toBe("/x?v=2&dl=1");
  });
});

describe("🔴 un nom de fichier ne peut pas injecter d'en-tête", () => {
  it("guillemets et antislash sont retirés", () => {
    // Le nom vient de la donnée — la raison sociale d'un client. Un guillemet
    // terminerait la valeur et laisserait injecter d'autres paramètres.
    expect(nomFichierSurEnTete('Conv"ention\\.pdf')).toBe("Convention.pdf");
  });

  it("l'en-tête complet porte la disposition ET le nom", () => {
    expect(enTeteContentDisposition("inline", "Convention.pdf")).toBe(
      'inline; filename="Convention.pdf"',
    );
    expect(enTeteContentDisposition("attachment", "Convention.pdf")).toBe(
      'attachment; filename="Convention.pdf"',
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 LA GARDE STATIQUE — celle qui empêche la sixième route de refaire le défaut
// ─────────────────────────────────────────────────────────────────────────────

const RACINE_SRC = resolve(process.cwd(), "src");

/**
 * Fichiers qui ont le DROIT d'écrire `attachment` en dur, avec leur raison.
 *
 * 🔴 Une entrée ici est une exception à une règle payée par un audit. Elle se
 * justifie, elle ne se range pas. Et un test compte les entrées : une liste
 * d'exceptions qui s'allonge sans qu'on la regarde finit par désarmer la garde
 * qu'elle sert.
 */
const EXCEPTIONS: ReadonlyArray<{ chemin: string; raison: string }> = [
  {
    chemin: "lib/content-disposition.ts",
    raison: "C'est le module qui PRODUIT la valeur — il doit pouvoir l'écrire.",
  },
  {
    chemin: "lib/content-disposition.spec.ts",
    raison: "Ce test lui-même : il vérifie la valeur produite, donc il la cite.",
  },
  {
    chemin: "app/[locale]/(admin)/[adminPrefix]/contacts/candidatures/[id]/cv/route.ts",
    raison:
      "Le CV d'un candidat n'est pas une pièce du dossier de formation : il ne se " +
      "consulte pas dans un parcours d'audit, il s'archive au dossier de recrutement. " +
      "À rebasculer si un écran de lecture de candidature voit le jour.",
  },
];

function fichiersSource(dossier: string, acc: string[] = []): string[] {
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      if (entree === "node_modules") continue;
      fichiersSource(chemin, acc);
      continue;
    }
    if (/\.tsx?$/.test(entree)) acc.push(chemin);
  }
  return acc;
}

/**
 * ⚠️ COMMENTAIRES DÉPOUILLÉS avant la recherche.
 *
 * 🔴 Le piège du dépôt, payé le 17/08 sur une autre garde : un test statique
 * qui lit les commentaires trouve **sa propre citation** et reste vert alors
 * que la garde est désarmée. Ici, les commentaires ci-dessus parlent
 * abondamment d'`attachment` — sans dépouillement, ce test s'accuserait
 * lui-même.
 */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/**
 * 🔴 La garde vise les routes qui servent un PDF, PAS tout `attachment`.
 *
 * Première version : elle listait **14 fichiers** — dont sept exports CSV, un
 * calendrier ICS et une route littéralement nommée `telecharger`. **Un tableur
 * s'enregistre**, c'est son usage ; le lire dans un onglet n'a aucun sens.
 *
 * Une garde qui accuse des cas légitimes se transforme en liste d'exceptions
 * longue comme le bras — et une liste d'exceptions longue ne se relit plus.
 *
 * Le défaut de l'audit blanc porte sur une chose précise : **une pièce qu'on
 * doit pouvoir LIRE à l'écran**. Le critère est donc « ce fichier sert-il un
 * PDF ? », pas « écrit-il `attachment` ? ».
 */
const FAUTIFS = fichiersSource(RACINE_SRC)
  .map((f) => ({
    rel: relative(RACINE_SRC, f).replace(/\\/g, "/"),
    code: sansCommentaires(readFileSync(f, "utf-8")),
  }))
  .filter(({ rel }) => !EXCEPTIONS.some((e) => e.chemin === rel))
  .filter(({ code }) => code.includes("application/pdf"))
  .filter(({ code }) => /["'`]attachment[;"'`\s]/.test(code))
  .map(({ rel }) => rel);

describe("🔴 aucune route n'écrit « attachment » en dur", () => {
  it("le balayage lit vraiment des fichiers", () => {
    // Sans ceci, un chemin cassé viderait la liste et le test suivant passerait
    // au vert en ne vérifiant plus rien. Une garde qui ne garde rien rassure.
    expect(fichiersSource(RACINE_SRC).length).toBeGreaterThan(200);
  });

  it("la liste des fautifs est vide", () => {
    expect(
      FAUTIFS,
      `Ces fichiers imposent « attachment » sans passer par le SSOT ` +
        `(lib/content-disposition.ts). Une pièce qu'on ne peut pas OUVRIR n'est ` +
        `pas une preuve consultable — c'est le constat de l'audit blanc. Utilise ` +
        `\`dispositionDemandee(req.url)\`, ou justifie l'exception.`,
    ).toEqual([]);
  });

  it("la liste d'exceptions reste courte, et chacune porte sa raison", () => {
    expect(EXCEPTIONS.length).toBeLessThanOrEqual(4);
    for (const e of EXCEPTIONS) {
      expect(e.raison.length, `L'exception « ${e.chemin} » ne dit pas pourquoi.`).toBeGreaterThan(
        30,
      );
    }
  });

  it("le paramètre de téléchargement est le MÊME que celui déjà en place", () => {
    // La route `documents-interventions/fichiers/[id]` utilise déjà `?dl=1`.
    // Deux conventions dans le même dépôt, c'est une de trop à retenir.
    expect(PARAM_TELECHARGEMENT).toBe("dl");
  });
});
