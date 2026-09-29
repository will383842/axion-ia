// @vitest-environment node
// @req REQ-INT-032
// @req REQ-CPL-015
// @req REQ-DM-035
// @req REQ-QA-035
/**
 * Le témoin à deux faces de `scripts/gates/cliquet-ecrivains.ts` pour `candidature.recue`
 * (INT-T22, ADR 0051 §c) : la règle `cleJson`, qui suit la CLÉ `details.pretASignerAt` d'un
 * champ Json au lieu d'une colonne.
 *
 * Face ROUGE : des sources synthétiques où la marque est posée sans l'émission unique — par un
 * objet littéral (le tunnel qui la poserait à la réception), par affectation, sur le client
 * global, hors transaction, ou portée par une variable — et la VRAIE transition du dépôt,
 * amputée de son appel d'émission.
 * Face VERTE : les lectures de la clé ne sont pas des écrivains, et le dépôt réel a exactement
 * un écrivain, la transition console « prêt à signer ».
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { REGLES, confronterEcrivains, lireLeDepot } from "../../../scripts/gates/cliquet-ecrivains";

const RACINE = path.resolve(__dirname, "../../..");
const FICHIER = "src/features/commercial-application/nouveau-chemin.ts";
const TRANSITIONS = "src/features/admin-submissions/transitions.ts";

const REGLE = REGLES.filter((r) => r.evenement === "candidature.recue");

function un(texte: string, fichier = FICHIER) {
  return confronterEcrivains(new Map([[fichier, texte]]), REGLE);
}

const regles = (f: { regle: string; ligne: number }) => `${f.ligne}:${f.regle}`;

describe("REQ-INT-032 — la règle existe, et suit une clé Json", () => {
  it("REQ-INT-032 : candidature.recue est gardé sur submission.details.pretASignerAt", () => {
    expect(REGLE).toHaveLength(1);
    expect(REGLE[0]).toMatchObject({
      modele: "submission",
      champ: "details",
      cleJson: "pretASignerAt",
      emission: "emettreCandidatureRecue",
    });
  });
});

describe("REQ-INT-032 — face ROUGE : une marque « prêt à signer » posée sans émission", () => {
  it("REQ-DM-035 : le tunnel qui poserait la marque À LA RÉCEPTION rougit (E1, fichier:ligne)", () => {
    const b = un(
      [
        "export async function recevoirDossier(details: Record<string, unknown>) {",
        "  await prisma.submission.create({",
        '    data: { type: "contact", details: { ...details, pretASignerAt: new Date().toISOString() } },',
        "  });",
        "}",
      ].join("\n"),
    );
    expect(b.fautes).toHaveLength(1);
    expect(b.fautes[0]).toMatchObject({
      regle: "E1",
      fichier: FICHIER,
      ligne: 3,
      fonction: "recevoirDossier",
      evenement: "candidature.recue",
    });
  });

  it("REQ-INT-032 : une marque posée par affectation (`d.pretASignerAt = …`) sans émission rougit", () => {
    const b = un(
      [
        "async function marquer(id: string, d: Record<string, unknown>) {",
        "  await prisma.$transaction(async (tx) => {",
        "    d.pretASignerAt = new Date().toISOString();",
        "    await tx.submission.update({ where: { id }, data: { details: d } });",
        "  });",
        "}",
      ].join("\n"),
    );
    expect(b.fautes.map(regles)).toEqual(["3:E1"]);
  });

  it('REQ-INT-032 : une marque posée par `d["pretASignerAt"] = …` sans émission rougit', () => {
    const b = un(
      [
        "async function marquer(id: string, d: Record<string, unknown>) {",
        '  d["pretASignerAt"] = "2026-09-29T00:00:00.000Z";',
        "  await prisma.submission.update({ where: { id }, data: { details: d } });",
        "}",
      ].join("\n"),
    );
    expect(b.fautes.map(regles)).toEqual(["2:E1"]);
  });

  it("REQ-INT-032 : écriture sur le client global, émission sur tx → E2", () => {
    const b = un(
      [
        "async function marquer(id: string, d: object) {",
        "  await prisma.$transaction(async (tx) => {",
        '    await prisma.submission.update({ where: { id }, data: { details: { ...d, pretASignerAt: "x" } } });',
        "    await emettreCandidatureRecue(tx, id);",
        "  });",
        "}",
      ].join("\n"),
    );
    expect(b.fautes.map(regles)).toEqual(["3:E2"]);
  });

  it("REQ-INT-032 : marque et émission hors de toute transaction → E3", () => {
    const b = un(
      [
        "async function marquer(id: string, d: object) {",
        '  await prisma.submission.update({ where: { id }, data: { details: { ...d, pretASignerAt: "x" } } });',
        "  await emettreCandidatureRecue(prisma, id);",
        "}",
      ].join("\n"),
    );
    expect(b.fautes.map(regles)).toEqual(["2:E3"]);
  });

  it("REQ-INT-032 : une clé portée par une variable est indécidable (E0)", () => {
    const b = un(
      [
        'const MARQUE = "pretASignerAt";',
        "async function marquer(id: string, d: Record<string, unknown>) {",
        "  d[MARQUE] = new Date().toISOString();",
        "  await prisma.submission.update({ where: { id }, data: { details: d } });",
        "}",
      ].join("\n"),
    );
    expect(b.fautes.map(regles)).toEqual(["1:E0"]);
  });

  it("REQ-QA-035 : la VRAIE transition du dépôt, sans son appel d'émission, rougit (E1)", () => {
    const vrai = fs.readFileSync(path.join(RACINE, TRANSITIONS), "utf8");
    const appel = "      await emettreCandidatureRecue(tx, submissionId);\n";
    expect(vrai.split(appel)).toHaveLength(2);
    const ampute = vrai.replace(appel, "");

    const rouge = un(ampute, TRANSITIONS);
    expect(rouge.fautes).toHaveLength(1);
    expect(rouge.fautes[0]).toMatchObject({
      regle: "E1",
      fichier: TRANSITIONS,
      fonction: "marquerPretASigner › travail de prisma.$transaction()",
    });
    // Et, intacte, la même source passe.
    expect(un(vrai, TRANSITIONS).fautes).toEqual([]);
  });
});

describe("REQ-INT-032 — face VERTE", () => {
  it("REQ-INT-032 : les LECTURES de la clé ne sont ni des écrivains ni des fautes", () => {
    const b = un(
      [
        'type Marque = "pretASignerAt" | "sansSuiteAt";',
        "function lire(d: Record<string, unknown>, e: { pretASignerAt?: string }) {",
        '  const a = d["pretASignerAt"];',
        "  const b = e.pretASignerAt;",
        '  const c = "pretASignerAt" in d;',
        "  const { pretASignerAt } = e;",
        '  const filtre = { details: { path: ["pretASignerAt"], not: null } };',
        '  delete d["pretASignerAt"];',
        "  return { a, b, c, pretASignerLe: pretASignerAt, filtre };",
        "}",
      ].join("\n"),
    );
    expect(b.ecrivains).toEqual([]);
    expect(b.fautes).toEqual([]);
  });

  it("REQ-INT-032 : contre-témoin — marque et émission sur tx, dans $transaction, passent", () => {
    const b = un(
      [
        "async function marquer(id: string, d: object) {",
        "  await prisma.$transaction(async (tx) => {",
        '    await tx.submission.update({ where: { id }, data: { details: { ...d, pretASignerAt: "x" } } });',
        "    await emettreCandidatureRecue(tx, id);",
        "  });",
        "}",
      ].join("\n"),
    );
    expect(b.fautes).toEqual([]);
    expect(b.parEvenement["candidature.recue"]).toBe(1);
  });

  it(
    "REQ-INT-032 : le dépôt réel — zéro faute, un seul écrivain, la transition console",
    { timeout: 60_000 },
    () => {
      const b = confronterEcrivains(lireLeDepot(RACINE), REGLE);
      expect(b.fautes).toEqual([]);
      expect(b.ecrivains.map((e) => `${e.fichier} (${e.fonction})`)).toEqual([
        `${TRANSITIONS} (marquerPretASigner › travail de prisma.$transaction())`,
      ]);
    },
  );
});
