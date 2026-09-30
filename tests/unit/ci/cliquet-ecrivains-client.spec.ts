// @vitest-environment node
// @req REQ-INT-007
// @req REQ-INT-015
// @req REQ-DM-021
/**
 * Le témoin à deux faces de `scripts/gates/cliquet-ecrivains.ts` pour `client.cree` et
 * `client.mis_a_jour` (INT-T03).
 *
 * La règle : toute CRÉATION de fiche, et toute mise à jour qui pose un champ transmis (ou des
 * données illisibles), appelle `emettreFaitClient` sur le client même qui écrit, dans le travail
 * d'une `$transaction`. Une mise à jour lue qui ne pose aucun champ transmis est classée, et
 * imprimée — jamais tue.
 *
 * Face ROUGE : des sources synthétiques, puis le VRAI fichier `clients.ts` auquel on ajoute un
 * écrivain : le cliquet rend le code 1 et nomme le fichier et la ligne (identité, pas compte).
 * Face VERTE : le dépôt réel, chaque écrivain nommé, et le code 0.
 */
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  confronterEcrivains,
  lireLeDepot,
  rendu,
  type Bilan,
} from "../../../scripts/gates/cliquet-ecrivains";

const RACINE = path.resolve(__dirname, "../../..");
const FICHIER = "src/server/qualiopi/crm/nouveau-chemin.ts";
const EVENEMENT = "client.cree|client.mis_a_jour";

const du = (b: Bilan) => ({
  fautes: b.fautes.filter((f) => f.evenement === EVENEMENT),
  ecrivains: b.ecrivains.filter((e) => e.evenement === EVENEMENT),
  horsChampsTransmis: b.horsChampsTransmis,
});
const un = (lignes: string[]) => du(confronterEcrivains(new Map([[FICHIER, lignes.join("\n")]])));
const regles = (f: { regle: string; ligne: number }) => `${f.ligne}:${f.regle}`;

describe("REQ-INT-007 — face ROUGE : un écrivain de Client qui n'émet pas", () => {
  it("REQ-INT-007 : une fiche créée hors émission rougit et nomme fichier:ligne", () => {
    const b = un([
      "export async function creerEnDouce(numero: string) {",
      '  await prisma.client.create({ data: { numero, statut: "prospect" } });',
      "}",
    ]);
    expect(b.fautes).toHaveLength(1);
    expect(b.fautes[0]).toMatchObject({
      regle: "E1",
      fichier: FICHIER,
      ligne: 2,
      fonction: "creerEnDouce",
    });
    expect(b.fautes[0]?.detail).toMatch(/crée une fiche sans appeler emettreFaitClient/);
  });

  it("REQ-INT-015 : un SIREN posé hors émission rougit, quelle que soit la valeur", () => {
    const b = un([
      "async function rattraper(id: string, siren: string) {",
      "  await prisma.$transaction(async (tx) => {",
      "    await tx.client.updateMany({ where: { id }, data: { siren } });",
      "  });",
      "}",
    ]);
    expect(b.fautes.map(regles)).toEqual(["3:E1"]);
  });

  it("REQ-INT-007 : des données illisibles sont PRÉSUMÉES toucher la charge (variable, étalement)", () => {
    const b = un([
      "async function f(id: string, data: D, extra: E) {",
      "  await prisma.client.update({ where: { id }, data });",
      '  await prisma.client.update({ where: { id }, data: { statut: "perdu", ...extra } });',
      "}",
    ]);
    expect(b.fautes.map(regles)).toEqual(["2:E1", "3:E1"]);
  });

  it("REQ-INT-007 : une constante littérale est LUE — un champ transmis dedans rougit", () => {
    const b = un([
      "async function f(id: string, s: string) {",
      "  const copie = { contactNom: null, ...(s ? { raisonSociale: s } : {}) };",
      "  await prisma.client.update({ where: { id }, data: copie });",
      "}",
    ]);
    expect(b.fautes.map(regles)).toEqual(["3:E1"]);
  });

  it("REQ-INT-007 : écriture sur le client global, émission sur tx → E2", () => {
    const b = un([
      "async function f(id: string) {",
      "  await prisma.$transaction(async (tx) => {",
      '    await prisma.client.update({ where: { id }, data: { taille: "PME" } });',
      "    await emettreFaitClient(tx, id, { avant });",
      "  });",
      "}",
    ]);
    expect(b.fautes.map(regles)).toEqual(["3:E2"]);
  });

  it("REQ-INT-007 : écriture et émission hors du travail d'une transaction → E3", () => {
    const b = un([
      "async function f(tx: Tx, id: string) {",
      '  await tx.client.update({ where: { id }, data: { nafCode: "6201Z" } });',
      "  await emettreFaitClient(tx, id, { avant: null });",
      "}",
    ]);
    expect(b.fautes.map(regles)).toEqual(["2:E3"]);
  });

  it("REQ-INT-007 : une écriture SQL brute sur la table clients est indécidable (E0)", () => {
    const b = un([
      "async function f(id: string) {",
      '  await prisma.$executeRaw`UPDATE "clients" SET siren = NULL WHERE id = ${id}`;',
      '  await prisma.$executeRawUnsafe("INSERT INTO clients (id) VALUES ($1)", id);',
      "  await prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;",
      "  await prisma.$executeRaw`UPDATE clients_contacts SET nom = NULL`;",
      "}",
    ]);
    expect(b.fautes.map(regles)).toEqual(["2:E0", "3:E0"]);
  });

  it("REQ-INT-007 : un écrivain AJOUTÉ au vrai clients.ts (fichier déjà déclaré) rougit, code 1, fichier:ligne", () => {
    const sources = lireLeDepot(RACINE);
    const fichier = "src/server/actions/qualiopi/clients.ts";
    const vrai = sources.get(fichier);
    if (vrai === undefined) throw new Error(`${fichier} absent du dépôt`);
    const ajout = [
      "",
      "export async function corrigerSirenEnDouce(id: string, siren: string) {",
      "  await prisma.client.update({ where: { id }, data: { siren } });",
      "}",
    ].join("\n");
    const mute = new Map(sources);
    mute.set(fichier, vrai + ajout);
    const ligne = vrai.split("\n").length + 2;

    const b = confronterEcrivains(mute);
    const { code, lignes } = rendu(b);
    expect(code).toBe(1);
    expect(
      du(b)
        .fautes.filter((f) => f.fichier === fichier)
        .map(regles),
    ).toEqual([`${ligne}:E1`]);
    expect(lignes.join("\n")).toContain(`E1  ${fichier}:${ligne} (corrigerSirenEnDouce)`);
  });

  it("REQ-INT-007 : contre-témoin — création et émission sur tx, dans $transaction, passent", () => {
    const b = un([
      "async function f(numero: string) {",
      "  await prisma.$transaction(async (tx) => {",
      "    const c = await tx.client.create({ data: { numero } });",
      "    await emettreFaitClient(tx, c.id, CREATION_CLIENT);",
      "  });",
      "}",
    ]);
    expect(b.fautes).toEqual([]);
    expect(b.ecrivains.map((e) => e.ligne)).toEqual([3]);
  });

  it("REQ-INT-007 : une mise à jour qui ne pose aucun champ transmis est CLASSÉE, imprimée", () => {
    const b = un([
      "async function f(id: string) {",
      '  await prisma.client.update({ where: { id }, data: { statut: "devis_envoye" } });',
      '  await prisma.clientContact.update({ where: { id }, data: { nom: "x" } });',
      "}",
    ]);
    expect(b.fautes).toEqual([]);
    expect(b.ecrivains).toEqual([]);
    expect(b.horsChampsTransmis.map((e) => `${e.fichier}:${e.ligne}`)).toEqual([`${FICHIER}:2`]);
  });
});

describe("REQ-INT-007 — face VERTE : le dépôt réel", () => {
  it(
    "REQ-INT-007 : zéro faute, code 0, chaque écrivain de Client confronté par identité",
    { timeout: 60_000 },
    () => {
      const b = confronterEcrivains(lireLeDepot(RACINE));
      const client = du(b);
      expect(client.fautes).toEqual([]);
      expect(client.ecrivains.map((e) => `${e.fichier} (${e.fonction})`).sort()).toEqual([
        "src/features/dossier-client/defaire-fusion.ts (defaireFusion › travail de db.$transaction())",
        "src/features/dossier-client/fusionner.ts (fusionnerFiches › travail de db.$transaction())",
        "src/lib/rgpd-erase.ts (eraseClientsForEmail › travail de prisma.$transaction())",
        "src/server/actions/qualiopi/clients.ts (updateClientAction › travail de prisma.$transaction())",
        "src/server/qualiopi/crm/porte-client.ts (creerOuRetrouverClient › travail de withNumberRetry() › travail de db.$transaction())",
      ]);
      expect(client.horsChampsTransmis.map((e) => `${e.fichier} (${e.fonction})`)).toEqual([
        "src/server/actions/qualiopi/devis.ts (sendDevisAction)",
        "src/server/qualiopi/crm/contact-facturation.ts (definirContactFacturation)",
        "src/server/qualiopi/crm/contact-facturation.ts (definirContactFacturation)",
      ]);
      const { code, lignes } = rendu(b);
      expect(lignes.at(-1)).toMatch(/5 écrivain\(s\) de client\.cree\|client\.mis_a_jour/);
      expect(code).toBe(0);
    },
  );
});
