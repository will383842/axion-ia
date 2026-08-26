/**
 * Verrou de la SSOT du dossier société.
 *
 * La table `societe_documents` ne porte PAS de colonne « rubrique » : le
 * classement vit dans `rubriques.ts`. Ce choix n'est tenable que si rien ne
 * peut tomber entre les mailles — un type ajouté au schéma Prisma et oublié
 * ici serait déposable par personne et visible nulle part, sans qu'aucune
 * erreur ne se produise.
 *
 * Ces tests itèrent donc l'enum Prisma RUNTIME, jamais une liste recopiée : une
 * liste en dur vieillirait exactement comme celle qu'elle est censée surveiller.
 */

import { describe, it, expect } from "vitest";

import { SocieteDocumentType } from "../../../prisma/generated/client";
import {
  SOCIETE_RUBRIQUES,
  SOCIETE_DOC_TYPES,
  getRubriqueForType,
  getRubriqueBySegment,
  labelSocieteDocType,
  proposerDateExpiration,
  typesDeRubrique,
} from "./rubriques";

const VALEURS_ENUM = Object.values(SocieteDocumentType) as string[];

describe("SSOT des rubriques société", () => {
  it("l'enum Prisma n'est pas vide (contre-témoin de l'import)", () => {
    // Sans ce témoin, un import cassé rendrait tous les tests suivants
    // vacuously true : « aucun type manquant » sur une liste de zéro type.
    expect(VALEURS_ENUM.length).toBeGreaterThan(30);
  });

  it("chaque type de l'enum Prisma est classé dans exactement une rubrique", () => {
    const orphelins = VALEURS_ENUM.filter(
      (v) => !SOCIETE_DOC_TYPES.some((t) => (t.key as string) === v),
    );
    expect(orphelins).toEqual([]);
  });

  it("aucun type n'apparaît dans deux rubriques", () => {
    const vus = new Map<string, string[]>();
    for (const r of SOCIETE_RUBRIQUES) {
      for (const t of r.types) {
        const cle = t.key as string;
        vus.set(cle, [...(vus.get(cle) ?? []), r.key]);
      }
    }
    const doublons = [...vus.entries()].filter(([, rubriques]) => rubriques.length > 1);
    expect(doublons).toEqual([]);
  });

  it("la SSOT ne déclare aucun type absent de l'enum Prisma", () => {
    const fantomes = SOCIETE_DOC_TYPES.map((t) => t.key as string).filter(
      (k) => !VALEURS_ENUM.includes(k),
    );
    expect(fantomes).toEqual([]);
  });

  it("chaque type porte un libellé FR lisible, jamais la clé technique", () => {
    for (const v of VALEURS_ENUM) {
      const label = labelSocieteDocType(v as SocieteDocumentType);
      expect(label, `type ${v}`).not.toBe(v);
      expect(label, `type ${v}`).not.toMatch(/_/);
      expect(label.length, `type ${v}`).toBeGreaterThan(2);
    }
  });

  it("les segments d'URL des rubriques sont uniques et résolvables", () => {
    const segments = SOCIETE_RUBRIQUES.map((r) => r.segment);
    expect(new Set(segments).size).toBe(segments.length);
    for (const s of segments) {
      expect(getRubriqueBySegment(s)?.segment).toBe(s);
    }
  });

  it("chaque rubrique déclare au moins un type", () => {
    for (const r of SOCIETE_RUBRIQUES) {
      expect(typesDeRubrique(r.key).length, `rubrique ${r.key}`).toBeGreaterThan(0);
    }
  });

  it("remonte la rubrique d'un type donné", () => {
    expect(getRubriqueForType("kbis")?.key).toBe("pieces_legales");
    expect(getRubriqueForType("note_securite")?.key).toBe("rgpd_securite");
  });
});

describe("date de péremption proposée", () => {
  it("un Kbis vaut trois mois", () => {
    const emission = new Date("2026-07-30T00:00:00.000Z");
    expect(proposerDateExpiration("kbis", emission)?.toISOString()).toBe(
      "2026-10-30T00:00:00.000Z",
    );
  });

  it("une attestation de vigilance vaut six mois", () => {
    const emission = new Date("2026-09-15T00:00:00.000Z");
    expect(proposerDateExpiration("attestation_vigilance_urssaf", emission)?.toISOString()).toBe(
      "2027-03-15T00:00:00.000Z",
    );
  });

  it("une pièce sans échéance ne propose aucune date, plutôt qu'une date inventée", () => {
    expect(proposerDateExpiration("statuts", new Date("2026-07-30T00:00:00.000Z"))).toBeNull();
    expect(proposerDateExpiration("rib", new Date("2026-07-30T00:00:00.000Z"))).toBeNull();
  });

  it("un 31 ne déborde pas sur le mois suivant", () => {
    // 31 janvier + 1 mois donnerait le 3 mars en arithmétique naïve.
    const emission = new Date("2026-01-31T00:00:00.000Z");
    const attendu = proposerDateExpiration("attestation_vigilance_urssaf", emission);
    expect(attendu?.toISOString()).toBe("2026-07-31T00:00:00.000Z");

    const trimestre = proposerDateExpiration("kbis", new Date("2026-11-30T00:00:00.000Z"));
    expect(trimestre?.toISOString()).toBe("2027-02-28T00:00:00.000Z");
  });
});
