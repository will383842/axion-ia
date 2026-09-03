/**
 * LES DEUX MOITIÉS DE LA RÈGLE DE DÉCISION SONT COUPLÉES.
 *
 * La règle « écarté ⇒ motif obligatoire, en cours ⇒ motif interdit » est écrite
 * DEUX FOIS, et c'est délibéré :
 *   - en SQL, dans `job_applications_motif_coherent_check`, seule juge ;
 *   - en TypeScript, dans `@/content/recrutement/statuts`, pour refuser plus tôt
 *     avec une phrase qu'un recruteur comprend.
 *
 * 🔴 Une règle écrite deux fois dérive au premier changement. Le jour où l'on
 * ajoute un état de sortie à la contrainte SQL sans toucher au miroir, le
 * formulaire cesserait de demander le motif et Postgres refuserait
 * l'enregistrement avec un message illisible : le produit deviendrait impossible
 * à utiliser sans qu'aucun test ne rougisse.
 *
 * Ce fichier LIT la migration et compare. Il ne recopie pas la règle — recopier
 * la règle pour la vérifier ne prouverait que la copie.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, it, expect } from "vitest";

import {
  STATUTS_EXIGEANT_UN_MOTIF,
  STATUTS_INTERDISANT_UN_MOTIF,
  STATUTS_CANDIDATURE,
  LIBELLE_STATUT,
  MOTIFS_REFUS,
  MOTIFS_REFUS_SAISISSABLES,
  LIBELLE_MOTIF_REFUS,
} from "../statuts";

const RACINE = process.cwd();
const MIGRATION = path.join(
  RACINE,
  "prisma/migrations/20260903163000_recrutement_decision/migration.sql",
);
const SCHEMA = path.join(RACINE, "prisma/schema.prisma");

/**
 * Extrait la liste de statuts d'une des trois branches du CHECK.
 *
 * On vise la DERNIÈRE occurrence de la contrainte dans le fichier : la migration
 * la `DROP` d'abord (où son nom apparaît sans corps), puis l'`ADD`.
 */
function branchesDuCheck(): string[][] {
  const sql = readFileSync(MIGRATION, "utf8");
  const debut = sql.lastIndexOf('ADD CONSTRAINT "job_applications_motif_coherent_check"');
  expect(debut, "contrainte introuvable — la migration a-t-elle été renommée ?").toBeGreaterThan(
    -1,
  );
  const corps = sql.slice(debut);
  return [...corps.matchAll(/"status"\s+IN\s+\(([^)]*)\)/g)].map((m) =>
    m[1]!
      .split(",")
      .map((v) => v.trim().replace(/^'|'$/g, ""))
      .filter(Boolean),
  );
}

describe("le miroir TypeScript de la contrainte de décision", () => {
  it("nomme exactement les mêmes états que la première branche du CHECK (motif OBLIGATOIRE)", () => {
    const [exigeant] = branchesDuCheck();
    expect(exigeant, "la migration ne porte plus trois branches IN").toBeDefined();
    expect([...exigeant!].sort()).toEqual([...STATUTS_EXIGEANT_UN_MOTIF].sort());
  });

  it("nomme exactement les mêmes états que la deuxième branche du CHECK (motif INTERDIT)", () => {
    const [, interdisant] = branchesDuCheck();
    expect(interdisant).toBeDefined();
    expect([...interdisant!].sort()).toEqual([...STATUTS_INTERDISANT_UN_MOTIF].sort());
  });

  it("ne laisse AUCUN état hors des trois branches — un oubli passerait inaperçu", () => {
    const couverts = new Set(branchesDuCheck().flat());
    const orphelins = STATUTS_CANDIDATURE.filter((s) => !couverts.has(s));
    expect(
      orphelins,
      "un état absent du CHECK accepte n'importe quoi : ni motif exigé, ni motif interdit",
    ).toEqual([]);
  });

  it("les deux moitiés sont disjointes — un état ne peut pas exiger ET interdire", () => {
    const croisement = STATUTS_EXIGEANT_UN_MOTIF.filter((s) =>
      (STATUTS_INTERDISANT_UN_MOTIF as readonly string[]).includes(s),
    );
    expect(croisement).toEqual([]);
  });
});

describe("le vocabulaire est complet et lisible", () => {
  it("porte exactement les valeurs de l'enum Postgres des statuts", () => {
    const schema = readFileSync(SCHEMA, "utf8");
    const bloc = /enum JobApplicationStatus \{([\s\S]*?)\n\}/.exec(schema);
    expect(bloc, "enum JobApplicationStatus introuvable dans le schéma").not.toBeNull();
    const valeurs = bloc![1]!
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("//") && !l.startsWith("@@"));
    expect([...valeurs].sort()).toEqual([...STATUTS_CANDIDATURE].sort());
  });

  it("porte exactement les valeurs de l'enum Postgres des motifs", () => {
    const schema = readFileSync(SCHEMA, "utf8");
    const bloc = /enum JobRejectionReason \{([\s\S]*?)\n\}/.exec(schema);
    expect(bloc).not.toBeNull();
    const valeurs = bloc![1]!
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("//") && !l.startsWith("@@"));
    expect([...valeurs].sort()).toEqual([...MOTIFS_REFUS].sort());
  });

  it("donne un libellé français à CHAQUE état et à CHAQUE motif", () => {
    // Le type l'exige déjà ; ce test attrape le cas où quelqu'un remplirait la
    // case avec la clé brute pour faire taire le compilateur.
    for (const s of STATUTS_CANDIDATURE) {
      expect(LIBELLE_STATUT[s], `statut ${s}`).not.toBe(s);
      expect(LIBELLE_STATUT[s].length).toBeGreaterThan(2);
    }
    for (const m of MOTIFS_REFUS) {
      expect(LIBELLE_MOTIF_REFUS[m], `motif ${m}`).not.toBe(m);
    }
  });

  it("n'offre JAMAIS `non_renseigne` à la saisie", () => {
    // 🔑 C'est le cœur du lot : `non_renseigne` dit la vérité sur le stock
    // repris, il ne doit pas devenir la case qu'on coche pour ne pas choisir.
    // Sans ce test, il suffirait d'un `MOTIFS_REFUS_SAISISSABLES = MOTIFS_REFUS`
    // de commodité pour rendre la contrainte SQL purement décorative.
    expect(MOTIFS_REFUS_SAISISSABLES).not.toContain("non_renseigne");
    expect(MOTIFS_REFUS_SAISISSABLES.length).toBe(MOTIFS_REFUS.length - 1);
  });
});

describe("plus aucune copie manuelle du vocabulaire", () => {
  it("les trois fichiers qui portaient une liste de statuts la DÉRIVENT désormais", () => {
    const copies: ReadonlyArray<readonly [string, string]> = [
      ["src/features/admin-job-applications/reads.ts", "STATUTS_CANDIDATURE"],
      [
        "src/app/[locale]/(admin)/[adminPrefix]/contacts/candidatures/[id]/ApplicationStatusForm.tsx",
        "STATUTS_CANDIDATURE",
      ],
      [
        "src/app/[locale]/(admin)/[adminPrefix]/contacts/candidatures/_v2/ApplicationsV2.tsx",
        "LIBELLE_STATUT",
      ],
    ];
    for (const [fichier, symbole] of copies) {
      const source = readFileSync(path.join(RACINE, fichier), "utf8");
      expect(source, `${fichier} n'importe plus la table unique`).toContain(symbole);
      // Le marqueur d'une copie : trois valeurs de statut alignées en littéral
      // dans le même fichier, hors import.
      const litteraux = ['"shortlisted"', "'shortlisted'", "shortlisted:"].filter((l) =>
        source.includes(l),
      );
      expect(
        litteraux,
        `${fichier} porte de nouveau une liste de statuts écrite à la main`,
      ).toEqual([]);
    }
  });
});
