/**
 * ⛔ CLIQUET — AUCUN ÉCRIVAIN DE `Client` HORS DE LA PORTE UNIQUE (chantier
 * visio, plan §3.17 point 5, décision B18 ; c'est aussi la porte qu'attend
 * Axion Partners, INT-T03).
 *
 * `creerOuRetrouverClient` (`src/server/qualiopi/crm/porte-client.ts`) est la
 * SEULE fonction qui crée une fiche client : verrou par SIREN, recherche des
 * fiches proches, refus du doublon. Un `prisma.client.create` écrit ailleurs
 * rouvrirait exactement le défaut mesuré le 28/09 (deux portes sur trois ne
 * vérifiaient rien).
 *
 * Balayage DÉRIVÉ de `src/`, `scripts/` et `prisma/` (tests exclus, outil
 * partagé `sources-du-circuit-visio.ts`) :
 *   1. tout `.client.create(`, `.client.upsert(`, `.client.createMany(` et tout
 *      `INSERT INTO clients` en SQL ;
 *   2. toute écriture de `siren` sur une fiche EXISTANTE
 *      (`.client.update|updateMany|upsert(` dont l'argument nomme `siren`) :
 *      donner à une fiche le SIREN d'une autre ferait deux fiches vivantes pour
 *      une entreprise. Un tel écrivain doit appeler `exigerSirenLibre` (même
 *      verrou, même recherche que la création), ou figurer, motivé, dans la
 *      liste nominative.
 * Les exceptions sont NOMINATIVES, motivées, et vérifiées vivantes (une
 * exception qui ne correspond plus à rien rougit : la liste ne pourrit pas en
 * silence).
 *
 * Contre-témoin : le détecteur, appliqué à un source fictif, trouve les
 * formes ; et le balayage trouve bien la porte et `updateClientAction`.
 * Angle mort : un accès dynamique (`prisma["client"]`, un client Prisma passé
 * sous un autre nom de modèle) et un `data` construit ailleurs puis étalé
 * (`data: { ...v }`) ne sont pas vus.
 */

import { describe, expect, it } from "vitest";

import { lire, sourcesExigeesSous, unAppelNomme } from "./sources-du-circuit-visio";

const PORTE = "src/server/qualiopi/crm/porte-client.ts";
const DOSSIERS = ["src", "scripts", "prisma"] as const;

/** Exceptions nominatives : données de démonstration et de test, jamais le produit. */
const EXCEPTIONS: Readonly<Record<string, string>> = {
  "prisma/seeds/qualiopi/demo.ts": "jeu de démonstration local (upsert idempotent)",
  "prisma/seeds/scenarios-console/index.ts": "scénarios de recette de la console",
  "prisma/seeds/volumetrie/fixture-volumetrique.ts": "fixture de volumétrie, jamais en production",
  "scripts/partners/fixtures.ts": "fixtures générées pour le contrat Axion Partners",
  "scripts/qualiopi/e2e-formations-verif.ts": "vérification de bout en bout sur base jetable",
  "scripts/ci/gate-d-visio.ts": "Gate D : fiche fictive de la vérification sur base neuve",
};

/** Écrivains de `siren` sur une fiche existante qui n'appellent pas `exigerSirenLibre`. */
const EXCEPTIONS_SIREN: Readonly<Record<string, string>> = {
  "scripts/visio/deriver-siren.ts":
    "rattrapage unique de la PR 2 (1 fiche sans SIREN en production le 28/09), " +
    "essai à blanc par défaut, n'écrit que sur une fiche SANS SIREN",
};

const MOTIFS: ReadonlyArray<RegExp> = [
  /\.client\.(create|upsert|createMany)\s*\(/,
  /INSERT\s+INTO\s+"?clients"?[\s(]/i,
];

const MISE_A_JOUR = /\.client\.(update|updateMany|upsert)\s*\(/g;
const SIREN = /\bsiren\b/;

function ecritUneFiche(source: string): boolean {
  return MOTIFS.some((m) => m.test(source));
}

function ecritUnSiren(source: string): boolean {
  return unAppelNomme(source, MISE_A_JOUR, SIREN);
}

describe("⛔ aucun écrivain de Client hors de la porte unique", () => {
  const sources = sourcesExigeesSous(DOSSIERS);
  const ecrivains = sources.filter((f) => ecritUneFiche(lire(f))).sort();
  const ecrivainsDeSiren = sources.filter((f) => ecritUnSiren(lire(f))).sort();

  it("le balayage trouve la porte elle-même — sinon il ne garde rien", () => {
    expect(ecrivains).toContain(PORTE);
  });

  it("aucun autre fichier ne crée une fiche client", () => {
    const fautifs = ecrivains.filter((f) => f !== PORTE && !(f in EXCEPTIONS));
    expect(
      fautifs,
      "ces fichiers créent une fiche client sans passer par creerOuRetrouverClient " +
        "(src/server/qualiopi/crm/porte-client.ts) : le doublon de SIREN n'y est pas refusé",
    ).toEqual([]);
  });

  it("chaque exception nominative existe encore et écrit encore une fiche", () => {
    for (const f of Object.keys(EXCEPTIONS)) {
      expect(ecrivains, `exception périmée : ${f} — retire-la de la liste`).toContain(f);
    }
  });

  it("le balayage des SIREN trouve updateClientAction — sinon il ne garde rien", () => {
    expect(ecrivainsDeSiren).toContain("src/server/actions/qualiopi/clients.ts");
  });

  it("tout écrivain de SIREN sur une fiche existante passe par exigerSirenLibre", () => {
    const fautifs = ecrivainsDeSiren.filter(
      (f) => !(f in EXCEPTIONS_SIREN) && !/\bexigerSirenLibre\s*\(/.test(lire(f)),
    );
    expect(
      fautifs,
      "ces fichiers écrivent le SIREN d'une fiche existante sans exigerSirenLibre " +
        "(porte-client.ts) : deux fiches vivantes pourraient porter le même SIREN",
    ).toEqual([]);
  });

  it("chaque exception SIREN existe encore et écrit encore un SIREN", () => {
    for (const f of Object.keys(EXCEPTIONS_SIREN)) {
      expect(ecrivainsDeSiren, `exception périmée : ${f} — retire-la de la liste`).toContain(f);
    }
  });

  it("contre-témoin : le détecteur voit les formes", () => {
    expect(ecritUneFiche("await prisma.client.create({ data })")).toBe(true);
    expect(ecritUneFiche("tx.client.upsert ({ where })")).toBe(true);
    expect(ecritUneFiche('await db.$executeRaw`INSERT INTO "clients" (id) VALUES (1)`')).toBe(true);
    expect(ecritUneFiche("prisma.client.findMany({})")).toBe(false);
    expect(ecritUneFiche("prisma.clientContact.create({})")).toBe(false);
    expect(ecritUnSiren("tx.client.update({ where, data: { siren: s } })")).toBe(true);
    expect(ecritUnSiren("tx.client.update({ data: { statut: f(x) } }); const siren = 1;")).toBe(
      false,
    );
    expect(ecritUnSiren("tx.sousTraitant.update({ data: { siren: s } })")).toBe(false);
  });
});
