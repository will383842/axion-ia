/**
 * La garde du barème de rôles — et le contre-témoin qui prouve qu'elle garde.
 *
 * Ces tests ont été **vus rougir** avant d'être verts : en rétablissant l'ancienne
 * comparaison (`RANG[role] < RANG[min]`, sans refus par défaut), « refuse tout
 * rôle hors barème » échoue sur `secretaire` et `responsable_qualite`. C'est la
 * seule preuve qui compte — une garde qu'on n'a jamais vue échouer n'est qu'une
 * intention.
 */

import { describe, it, expect } from "vitest";

import { RANG_DE_ROLE, roleAtteintLeRang, rolesHorsBareme } from "./rangs-de-role";

describe("barème de rôles du module Réservation", () => {
  it("laisse passer les rôles qui atteignent le rang", () => {
    expect(roleAtteintLeRang("admin", "admin")).toBe(true);
    expect(roleAtteintLeRang("super_admin", "admin")).toBe(true);
    expect(roleAtteintLeRang("super_admin", "super_admin")).toBe(true);
    expect(roleAtteintLeRang("editor", "editor")).toBe(true);
  });

  it("refuse les rôles trop faibles", () => {
    expect(roleAtteintLeRang("reader", "editor")).toBe(false);
    expect(roleAtteintLeRang("editor", "admin")).toBe(false);
    expect(roleAtteintLeRang("admin", "super_admin")).toBe(false);
  });

  it("refuse l'absence de rôle", () => {
    expect(roleAtteintLeRang(undefined, "admin")).toBe(false);
    expect(roleAtteintLeRang("", "admin")).toBe(false);
  });

  // 🔴 LE TEST QUI COMPTE — celui qui rougissait avant le correctif.
  //
  // L'ancienne garde rendait `undefined` pour ces deux rôles, et `undefined < 2`
  // vaut `false` : elle les laissait donc PASSER, y compris sur les actions
  // réservées `super_admin` qui décident du remboursement.
  it("refuse TOUT rôle hors barème — c'est le refus par défaut qui manquait", () => {
    for (const role of ["secretaire", "responsable_qualite", "invente", "ADMIN"]) {
      expect(roleAtteintLeRang(role, "editor"), `${role} vs editor`).toBe(false);
      expect(roleAtteintLeRang(role, "admin"), `${role} vs admin`).toBe(false);
      expect(roleAtteintLeRang(role, "super_admin"), `${role} vs super_admin`).toBe(false);
    }
  });

  // 🔑 Dérivé de l'enum Prisma, jamais recopié : une liste en dur porterait
  // exactement le défaut qu'on vient de corriger.
  //
  // Ce test n'exige PAS que le barème couvre les six rôles — il exige que les
  // absents soient CONNUS. Le jour où un septième rôle apparaît, il rougit et
  // force une décision consciente au lieu d'un silence qui autorise.
  it("les rôles hors barème sont exactement ceux qu'on a décidé d'exclure", () => {
    expect(rolesHorsBareme().sort()).toEqual(["responsable_qualite", "secretaire"]);
  });

  it("le barème couvre les quatre rôles engageants, dans l'ordre", () => {
    expect(Object.keys(RANG_DE_ROLE)).toEqual(["reader", "editor", "admin", "super_admin"]);
    expect(RANG_DE_ROLE.reader).toBeLessThan(RANG_DE_ROLE.editor);
    expect(RANG_DE_ROLE.editor).toBeLessThan(RANG_DE_ROLE.admin);
    expect(RANG_DE_ROLE.admin).toBeLessThan(RANG_DE_ROLE.super_admin);
  });
});
