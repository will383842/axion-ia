// @vitest-environment node
// @req REQ-INT-007
/**
 * Le témoin à deux faces de `scripts/gates/cliquet-ecrivains.ts` pour `devis.signe` (INT-T04).
 *
 * Face ROUGE : un texte source synthétique où un chemin d'acceptation de devis pose
 * `statut: "accepte"` sans passer par `emettreDevisSigne` — le cliquet doit le refuser en nommant
 * le fichier et la ligne. Face VERTE : le dépôt réel, zéro faute, et les trois écrivains connus (le webhook DocuSeal n'en est plus un : CGV 6.2),
 * nommés un par un.
 */
import path from "node:path";

import { describe, expect, it } from "vitest";

import { confronterEcrivains, lireLeDepot } from "../../../scripts/gates/cliquet-ecrivains";

const RACINE = path.resolve(__dirname, "../../..");

const FICHIER = "src/server/actions/qualiopi/nouveau-chemin.ts";

function un(texte: string, fichier = FICHIER) {
  return confronterEcrivains(new Map([[fichier, texte]]));
}

describe("REQ-INT-007 — face ROUGE : un écrivain de « accepte » qui n'émet pas", () => {
  it("REQ-INT-007 : une écriture hors émission rougit et nomme fichier:ligne", () => {
    const b = un(
      [
        'import { prisma } from "@/lib/prisma";',
        "export async function accepterEnDouce(id: string) {",
        "  await prisma.devis.update({",
        '    where: { id }, data: { statut: "accepte", acceptedAt: new Date() },',
        "  });",
        "}",
      ].join("\n"),
    );
    expect(b.fautes).toHaveLength(1);
    expect(b.fautes[0]).toMatchObject({ regle: "E1", fichier: FICHIER, ligne: 3 });
    expect(b.fautes[0]?.fonction).toBe("accepterEnDouce");
  });

  it("REQ-INT-007 : un SECOND écrivain dans un fichier déjà conforme rougit (jamais un compte)", () => {
    const b = un(
      [
        "export async function a(id: string) {",
        "  await transactionDevisSigne(prisma, async (tx) => {",
        '    await tx.devis.update({ where: { id }, data: { statut: "accepte" } });',
        "    await emettreDevisSigne(tx, id);",
        "  });",
        "}",
        "export async function b(documentGenereId: string) {",
        "  await prisma.devis.updateMany({",
        '    where: { documentGenereId }, data: { statut: "accepte" as const },',
        "  });",
        "}",
      ].join("\n"),
    );
    expect(b.ecrivains).toHaveLength(2);
    expect(b.fautes.map((f) => `${f.fichier}:${f.ligne}:${f.regle}`)).toEqual([`${FICHIER}:8:E1`]);
  });

  it("REQ-INT-007 : l'émission sur un autre client que celui qui écrit rougit (E2)", () => {
    const b = un(
      [
        "async function f(id: string) {",
        "  await prisma.$transaction(async (tx) => {",
        '    await prisma.devis.update({ where: { id }, data: { statut: "accepte" } });',
        "    await emettreDevisSigne(tx, id);",
        "  });",
        "}",
      ].join("\n"),
    );
    expect(b.fautes.map((f) => [f.regle, f.ligne])).toEqual([["E2", 3]]);
  });

  it("REQ-INT-007 : écriture et émission hors du travail d'une transaction rougit (E3)", () => {
    const b = un(
      [
        "async function f(tx: T, id: string) {",
        '  await tx.devis.upsert({ where: { id }, create: { statut: "accepte" }, update: {} });',
        "  await emettreDevisSigne(tx, id);",
        "}",
      ].join("\n"),
    );
    expect(b.fautes.map((f) => [f.regle, f.ligne])).toEqual([["E3", 2]]);
  });

  it("REQ-INT-007 : un statut non littéral est indécidable, donc refusé (E0), pour chaque règle", () => {
    const b = un(
      [
        "async function f(id: string, statut: S) {",
        "  await prisma.devis.update({ where: { id }, data: { statut } });",
        "}",
      ].join("\n"),
    );
    // `devis.statut` est gardé par deux règles depuis la v3 : `devis.signe` (accepte) et
    // `devis.emis` (envoye) ; chacune juge l'écriture, comme les règles de la facturation.
    expect(b.fautes.map((f) => [f.evenement, f.regle, f.ligne])).toEqual([
      ["devis.signe", "E0", 2],
      ["devis.emis", "E0", 2],
    ]);
  });

  it("REQ-INT-007 : les formes détournées sont vues ({ set }, ternaire, étalement)", () => {
    const b = un(
      [
        "async function f(id: string, ok: boolean) {",
        '  await prisma.devis.update({ where: { id }, data: { statut: { set: "accepte" } } });',
        '  await prisma.devis.update({ where: { id }, data: ok ? { statut: "accepte" } : {} });',
        '  await prisma.devis.update({ where: { id }, data: { ...{ statut: "accepte" } } });',
        "}",
      ].join("\n"),
    );
    expect(b.fautes.map((f) => f.ligne)).toEqual([2, 3, 4]);
  });

  it("REQ-INT-007 : les autres états et les autres modèles ne sont pas des écrivains", () => {
    const b = un(
      [
        "async function f(id: string) {",
        '  await prisma.devis.update({ where: { id }, data: { statut: "refuse" } });',
        '  await prisma.facture.update({ where: { id }, data: { statut: "accepte" } });',
        '  await prisma.devis.findMany({ where: { statut: "accepte" } });',
        "}",
      ].join("\n"),
    );
    expect(b.ecrivains).toHaveLength(0);
    expect(b.fautes).toHaveLength(0);
  });
});

const FICHIER_LISTE = "src/server/qualiopi/devis/marquer-devis-envoye.ts";
const CORPS_MARQUER = (premier: string) =>
  [
    `export async function marquerDevisEnvoye(${premier}: T, id: string) {`,
    `  await ${premier}.devis.updateMany({ where: { id }, data: { statut: "envoye" } });`,
    `  await emettreDevisEmis(${premier}, id);`,
    "}",
  ].join("\n");

describe("REQ-INT-007 — fonctions sur le tx de l'appelant : liste NOMMÉE (fichier + fonction) et appels contrôlés (E4)", () => {
  it("REQ-INT-007 : face VERTE — la fonction listée, dans son fichier, avec `tx` ; un appel avec le tx du travail", () => {
    const b = confronterEcrivains(
      new Map([
        [FICHIER_LISTE, CORPS_MARQUER("tx")],
        [
          "src/server/qualiopi/appelant.ts",
          [
            "export async function envoyer(e: E) {",
            "  await prisma.$transaction(async (tx) => {",
            "    await marquerDevisEnvoye(tx, e);",
            "  });",
            "}",
          ].join("\n"),
        ],
      ]),
    );
    expect(b.fautes).toEqual([]);
    expect(b.ecrivains).toHaveLength(1);
  });

  it("REQ-INT-007 : un appel avec `prisma` (pas le tx du travail) rougit (E4)", () => {
    const b = un(
      [
        "export async function envoyer(e: E) {",
        "  await prisma.$transaction(async (tx) => {",
        "    await marquerDevisEnvoye(prisma, e);",
        "  });",
        "}",
      ].join("\n"),
    );
    expect(b.fautes.map((f) => [f.regle, f.ligne])).toEqual([["E4", 3]]);
  });

  it("REQ-INT-007 : un appel hors du travail d'une transaction rougit (E4)", () => {
    const b = un(
      [
        "export async function envoyer(tx: T, e: E) {",
        "  await marquerDevisEnvoye(tx, e);",
        "}",
      ].join("\n"),
    );
    expect(b.fautes.map((f) => [f.regle, f.ligne])).toEqual([["E4", 2]]);
  });

  it("REQ-INT-007 : un appel dans une fonction imbriquée du travail rougit (E4)", () => {
    const b = un(
      [
        "export async function envoyer(es: E[]) {",
        "  await prisma.$transaction(async (tx) => {",
        "    await Promise.all(es.map(async (e) => marquerDevisEnvoye(tx, e)));",
        "  });",
        "}",
      ].join("\n"),
    );
    expect(b.fautes.map((f) => f.regle)).toEqual(["E4"]);
  });

  it("REQ-INT-007 : une référence qui n'est pas un appel (alias) rougit (E4)", () => {
    const b = un(
      [
        "export async function envoyer(e: E) {",
        "  const f = marquerDevisEnvoye;",
        "  await prisma.$transaction(async (tx) => f(tx, e));",
        "}",
      ].join("\n"),
    );
    expect(b.fautes.map((f) => [f.regle, f.ligne])).toEqual([["E4", 2]]);
  });

  it("REQ-INT-007 : un import RENOMMÉ puis un appel avec `prisma` rougit (E4)", () => {
    const b = un(
      [
        'import { marquerDevisEnvoye as m } from "./devis/marquer-devis-envoye";',
        "export async function envoyer(e: E) {",
        "  await m(prisma, e);",
        "}",
      ].join("\n"),
    );
    expect(b.fautes.map((f) => [f.regle, f.ligne])).toEqual([["E4", 1]]);
  });

  it("REQ-INT-007 : un réexport RENOMMÉ rougit (E4)", () => {
    const b = un('export { marquerDevisEnvoye as x } from "./devis/marquer-devis-envoye";');
    expect(b.fautes.map((f) => [f.regle, f.ligne])).toEqual([["E4", 1]]);
  });

  it('REQ-INT-007 : un accès par crochets `M["…"](…)` rougit (E4)', () => {
    const b = un(
      [
        'import * as M from "./devis/marquer-devis-envoye";',
        "export async function envoyer(e: E) {",
        '  await M["marquerDevisEnvoye"](prisma, e);',
        "}",
      ].join("\n"),
    );
    expect(b.fautes.map((f) => [f.regle, f.ligne])).toEqual([["E4", 3]]);
  });

  it("REQ-INT-007 : le MÊME nom de fonction dans un AUTRE fichier ne passe pas (E3)", () => {
    const b = un(CORPS_MARQUER("tx"), "src/server/qualiopi/devis/autre-fichier.ts");
    expect(b.fautes.map((f) => [f.regle, f.ligne])).toEqual([["E3", 2]]);
  });

  it("REQ-INT-007 : une fonction listée dont le premier paramètre ne s'appelle pas `tx` rougit (E3)", () => {
    const b = un(CORPS_MARQUER("client"), FICHIER_LISTE);
    expect(b.fautes.map((f) => [f.regle, f.ligne])).toEqual([["E3", 2]]);
  });
});

describe("REQ-INT-007 — face VERTE : le dépôt réel", () => {
  it(
    "REQ-INT-007 : zéro faute, et les trois écrivains connus (le webhook DocuSeal n'en est plus un : CGV 6.2) confrontés par identité",
    { timeout: 60_000 },
    () => {
      const b = confronterEcrivains(lireLeDepot(RACINE));
      expect(b.fautes).toEqual([]);
      expect(b.parEvenement["devis.signe"]).toBe(3);
      expect(
        b.ecrivains
          .filter((e) => e.evenement === "devis.signe")
          .map((e) => `${e.fichier} (${e.fonction})`)
          .sort(),
      ).toEqual([
        "src/server/actions/qualiopi/devis.ts (acceptDevisAction › travail de transactionDevisSigne())",
        // Devis à formules (lot 4) : recopie du choix + acceptation + `devis.signe` + fait
        // `commande.signee` dans UNE vraie transaction, même canal Partners fermé.
        "src/server/qualiopi/devis/acceptation-formules.ts (accepterDevisAFormules › travail de client.$transaction())",
        // Lot S6a : l'écrivain du canal maison a quitté `piece-signature.ts`
        // (`consequenceSignatureComplete`) pour l'après-signature commun — même
        // transaction, même garde, un fichier hors « use server ».
        "src/server/qualiopi/documents/signature/apres-signature.ts (accepterDevis › travail de transactionDevisSigne())",
      ]);
    },
  );
});
