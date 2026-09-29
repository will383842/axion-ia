// @vitest-environment node
// @req REQ-INT-007
// @req REQ-INT-032
/**
 * Le témoin à deux faces de `scripts/gates/cliquet-ecrivains.ts` pour les faits de facturation
 * (INT-T05) : `facture.emise`, `avoir.emis`, `facture.annulee`, `paiement.recu`,
 * `paiement.rembourse`.
 *
 * Face ROUGE : des textes sources synthétiques où une pièce ou un encaissement est écrit sans
 * passer par l'émission unique — le cliquet doit le refuser en nommant le fichier et la ligne,
 * y compris pour les deux faits qui n'ont AUCUN écrivain aujourd'hui (la règle garde demain).
 * Face VERTE : le dépôt réel, zéro faute, chaque écrivain connu nommé, l'import d'historique
 * classé hors fait par son marqueur.
 */
import path from "node:path";

import { describe, expect, it } from "vitest";

import { REGLES, confronterEcrivains, lireLeDepot } from "../../../scripts/gates/cliquet-ecrivains";

const RACINE = path.resolve(__dirname, "../../..");

const FICHIER = "src/server/qualiopi/financements/nouveau-chemin.ts";

function un(texte: string) {
  return confronterEcrivains(new Map([[FICHIER, texte]]));
}

const regles = (f: { regle: string; ligne: number; evenement: string }) =>
  `${f.evenement}:${f.ligne}:${f.regle}`;

describe("REQ-INT-007 — face ROUGE : un écrivain de facturation qui n'émet pas", () => {
  it("REQ-INT-007 : une facture créée `emise` hors émission rougit et nomme fichier:ligne", () => {
    const b = un(
      [
        "export async function facturerEnDouce(numero: string) {",
        "  await prisma.factureFormation.create({",
        '    data: { numero, statut: "emise", emiseAt: new Date() },',
        "  });",
        "}",
      ].join("\n"),
    );
    expect(b.fautes).toHaveLength(1);
    expect(b.fautes[0]).toMatchObject({
      regle: "E1",
      fichier: FICHIER,
      ligne: 2,
      fonction: "facturerEnDouce",
      evenement: "facture.emise|avoir.emis",
    });
  });

  it("REQ-INT-007 : un brouillon émis par updateMany hors émission rougit", () => {
    const b = un(
      [
        "async function emettre(id: string) {",
        "  await transactionFaitFacturation(prisma, async (tx) => {",
        '    await tx.factureFormation.updateMany({ where: { id }, data: { statut: "emise" } });',
        "  });",
        "}",
      ].join("\n"),
    );
    expect(b.fautes.map(regles)).toEqual(["facture.emise|avoir.emis:3:E1"]);
  });

  it("REQ-INT-005 : un encaissement `succeeded` hors émission rougit", () => {
    const b = un(
      [
        "async function encaisser(factureFormationId: string) {",
        "  await prisma.$transaction(async (tx) => {",
        "    await tx.payment.create({",
        '      data: { factureFormationId, amountCents: 1, status: "succeeded", type: "balance" },',
        "    });",
        "  });",
        "}",
      ].join("\n"),
    );
    expect(b.fautes.map(regles)).toEqual(["paiement.recu:3:E1"]);
  });

  it("REQ-INT-032 : le PREMIER écrivain de demain d'un remboursement rougit (règle sans écrivain aujourd'hui)", () => {
    const b = un(
      [
        "async function rembourser(id: string) {",
        '  await prisma.payment.update({ where: { id }, data: { status: "refunded" } });',
        "}",
      ].join("\n"),
    );
    expect(b.fautes.map(regles)).toEqual(["paiement.rembourse:2:E1"]);
  });

  it("REQ-INT-032 : le PREMIER écrivain de demain d'une annulation rougit", () => {
    const b = un(
      [
        "async function annuler(id: string) {",
        '  await prisma.factureFormation.update({ where: { id }, data: { statut: "annulee" } });',
        "}",
      ].join("\n"),
    );
    expect(b.fautes.map(regles)).toEqual(["facture.annulee:2:E1"]);
  });

  it("REQ-INT-032 : une échéance de financeur posée hors émission rougit, QUELLE QUE SOIT la date", () => {
    const b = un(
      [
        "export async function decalerEcheance(id: string, echeance: Date) {",
        "  await prisma.dossierFinancement.update({",
        "    where: { id },",
        "    data: { echeanceFinanceurAt: echeance },",
        "  });",
        "}",
      ].join("\n"),
    );
    expect(b.fautes.map(regles)).toEqual(["financement.mis_a_jour:2:E1"]);
  });

  it("REQ-INT-032 : contre-témoin — dans une transaction qui émet, l'échéance passe", () => {
    const b = un(
      [
        "export async function decalerEcheance(id: string, factureId: string, echeance: Date) {",
        "  await transactionFaitFacturation(prisma, async (tx) => {",
        "    await tx.dossierFinancement.update({ where: { id }, data: { echeanceFinanceurAt: echeance } });",
        "    await emettreFinancementMisAJour(tx, factureId);",
        "  });",
        "}",
      ].join("\n"),
    );
    expect(b.fautes).toEqual([]);
    expect(b.parEvenement["financement.mis_a_jour"]).toBe(1);
  });

  it("REQ-INT-007 : écriture sur le client global, émission sur tx → E2", () => {
    const b = un(
      [
        "async function f(id: string) {",
        "  await transactionFaitFacturation(prisma, async (tx) => {",
        '    await prisma.factureFormation.update({ where: { id }, data: { statut: "emise" } });',
        "    await emettreFaitFacture(tx, id);",
        "  });",
        "}",
      ].join("\n"),
    );
    expect(b.fautes.map(regles)).toEqual(["facture.emise|avoir.emis:3:E2"]);
  });

  it("REQ-INT-007 : un statut de facture non littéral est indécidable (E0), pour chaque règle", () => {
    const b = un(
      [
        "async function f(id: string, statut: S) {",
        "  await prisma.factureFormation.update({ where: { id }, data: { statut } });",
        "}",
      ].join("\n"),
    );
    expect(b.fautes.map(regles)).toEqual(["facture.emise|avoir.emis:2:E0", "facture.annulee:2:E0"]);
  });

  it("REQ-INT-007 : le marqueur hors fait n'est admis qu'EN LITTÉRAL (`estImportee: importee` rougit)", () => {
    const b = un(
      [
        "async function f(numero: string, importee: boolean) {",
        '  await prisma.factureFormation.create({ data: { numero, estImportee: importee, statut: "emise" } });',
        "}",
      ].join("\n"),
    );
    expect(b.fautes.map(regles)).toEqual(["facture.emise|avoir.emis:2:E1"]);
    expect(b.horsFait).toEqual([]);
  });

  it("REQ-INT-007 : `estImportee: true` en littéral classe l'écriture hors fait, imprimée", () => {
    const b = un(
      [
        "async function f(numero: string, statut: S) {",
        "  await prisma.factureFormation.create({ data: { numero, estImportee: true, statut } });",
        "}",
      ].join("\n"),
    );
    expect(b.fautes).toEqual([]);
    expect(b.horsFait.map((e) => `${e.evenement}:${e.ligne}`)).toEqual([
      "facture.emise|avoir.emis:2",
      "facture.annulee:2",
    ]);
  });

  it("REQ-INT-007 : les états qui ne sont pas des faits ne sont pas des écrivains", () => {
    const b = un(
      [
        "async function f(id: string) {",
        '  await prisma.factureFormation.create({ data: { statut: "brouillon" } });',
        '  await prisma.factureFormation.updateMany({ where: { id }, data: { statut: "en_retard" } });',
        "  await prisma.factureFormation.update({ where: { id }, data: { documentId: id } });",
        '  await prisma.payment.create({ data: { status: "pending" } });',
        "}",
      ].join("\n"),
    );
    expect(b.ecrivains).toEqual([]);
    expect(b.fautes).toEqual([]);
  });
});

describe("REQ-INT-007 — face VERTE : le dépôt réel", () => {
  it(
    "REQ-INT-007 : zéro faute, et chaque écrivain de facturation confronté par identité",
    { timeout: 60_000 },
    () => {
      const b = confronterEcrivains(lireLeDepot(RACINE));
      expect(b.fautes).toEqual([]);
      const nommes = (evenement: string) =>
        b.ecrivains
          .filter((e) => e.evenement === evenement)
          .map((e) => `${e.fichier} (${e.fonction})`)
          .sort();

      expect(nommes("facture.emise|avoir.emis")).toEqual([
        "src/server/actions/qualiopi/factures-inter.ts (genererFactureParInscriptionAction › travail de withNumberRetry() › travail de transactionFaitFacturation())",
        "src/server/qualiopi/coaching-1to1/facturation-1to1.ts (genererFactureCoaching › travail de transactionFaitFacturation())",
        "src/server/qualiopi/financements/facturation-service.ts (genererFactureFormation › travail de transactionFaitFacturation())",
        "src/server/qualiopi/financements/facture-formation-emission.ts (emettreSansVerrou › travail de withNumberRetry() › travail de transactionFaitFacturation())",
        "src/server/qualiopi/financements/facture-libre.ts (genererAvoirFacture › travail de transactionFaitFacturation())",
        "src/server/qualiopi/financements/facture-libre.ts (genererFactureLibre › travail de transactionFaitFacturation())",
        "src/server/qualiopi/financements/plan-recurrent.ts (emettreFactureBrouillon › travail de transactionFaitFacturation())",
      ]);
      expect(nommes("financement.mis_a_jour")).toEqual([
        "src/server/qualiopi/financements/dossier-financement.ts (transitionnerDossier › travail de transactionFaitFacturation())",
      ]);
      expect(nommes("paiement.recu")).toEqual([
        "src/server/qualiopi/financements/facture-libre.ts (enregistrerPaiementFacture › travail de prisma.$transaction())",
      ]);
      expect(b.horsFait.map((e) => `${e.evenement} ${e.fichier} (${e.fonction})`)).toEqual([
        "facture.emise|avoir.emis src/server/actions/qualiopi/facturation-hub.ts (importerFacturesHistoriqueAction)",
        "facture.annulee src/server/actions/qualiopi/facturation-hub.ts (importerFacturesHistoriqueAction)",
      ]);
    },
  );

  it("REQ-INT-032 : les deux faits sans écrivain le sont PAR MESURE écrite, pas par panne", () => {
    const b = confronterEcrivains(lireLeDepot(RACINE));
    for (const evenement of ["facture.annulee", "paiement.rembourse"]) {
      expect(b.parEvenement[evenement]).toBe(0);
      expect(REGLES.find((r) => r.evenement === evenement)?.sansEcrivainMesure).toMatch(
        /^2026-09-29 : aucune écriture de src\//,
      );
    }
    // Les autres règles n'ont PAS ce passe-droit : zéro y reste une panne.
    for (const r of REGLES.filter((x) => x.sansEcrivainMesure === undefined)) {
      expect(b.parEvenement[r.evenement]).toBeGreaterThan(0);
    }
  });
});
