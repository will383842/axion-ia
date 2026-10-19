/**
 * QNC NC6, lot présence 1/3 — le calendrier des étapes de confirmation de
 * présence (P-12, étapes 3 et 4). Fonction pure : aucune base, aucune horloge.
 * Les instants sont écrits en UTC ; le commentaire dit l'heure de Paris.
 */

import { describe, expect, it } from "vitest";
import { etapesDues, type FaitsPresence } from "../calendrier";

const AUCUN: FaitsPresence = {
  demandeLe: null,
  relanceLe: null,
  informationEntrepriseLe: null,
  reponse: null,
  contactEmail: true,
};

const J = "2026-10-26"; // lundi ; la nuit du 24 au 25 octobre : passage à l'heure d'hiver

describe("etapesDues : demande de confirmation (B1)", () => {
  it("J-4 : rien", () => {
    expect(etapesDues(new Date("2026-10-22T10:00:00Z"), J, AUCUN)).toEqual([]);
  });

  it("J-3 à 08 h 59 (Paris) : rien", () => {
    expect(etapesDues(new Date("2026-10-23T06:59:00Z"), J, AUCUN)).toEqual([]);
  });

  it("J-3 à 09 h 00 (Paris) : la demande", () => {
    expect(etapesDues(new Date("2026-10-23T07:00:00Z"), J, AUCUN)).toEqual(["demande"]);
  });

  it("J-3 à 10 h (Paris) : la demande", () => {
    expect(etapesDues(new Date("2026-10-23T08:00:00Z"), J, AUCUN)).toEqual(["demande"]);
  });

  it("J-3 à 19 h (Paris) : plus rien, la plage est fermée", () => {
    expect(etapesDues(new Date("2026-10-23T17:00:00Z"), J, AUCUN)).toEqual([]);
  });

  it("une demande déjà partie n'est jamais redemandée", () => {
    const faits = { ...AUCUN, demandeLe: new Date("2026-10-23T08:00:00Z") };
    expect(etapesDues(new Date("2026-10-23T09:00:00Z"), J, faits)).toEqual([]);
  });

  it("J0 : rien, même sans demande", () => {
    expect(etapesDues(new Date("2026-10-26T09:00:00Z"), J, AUCUN)).toEqual([]);
  });

  it("session tardive (créée à J-1) : la demande à 09 h, l'entreprise à 12 h", () => {
    // J-1 = 25/10, heure d'hiver (CET = UTC+1) : 09 h Paris = 08 h UTC.
    expect(etapesDues(new Date("2026-10-25T08:00:00Z"), J, AUCUN)).toEqual(["demande"]);
    const faits = { ...AUCUN, demandeLe: new Date("2026-10-25T08:00:00Z") };
    // 11 h 59 : la demande a 3 h 59, mais l'entreprise n'est pas avant 12 h.
    expect(etapesDues(new Date("2026-10-25T10:59:00Z"), J, faits)).toEqual([]);
    expect(etapesDues(new Date("2026-10-25T11:00:00Z"), J, faits)).toEqual([
      "information_entreprise",
    ]);
  });

  it("la demande doit avoir au moins 3 h avant d'informer l'entreprise", () => {
    // Demande à 10 h 30 Paris (09 h 30 UTC) : l'entreprise n'est pas avant 13 h 30.
    const faits = { ...AUCUN, demandeLe: new Date("2026-10-25T09:30:00Z") };
    expect(etapesDues(new Date("2026-10-25T11:00:00Z"), J, faits)).toEqual([]);
    expect(etapesDues(new Date("2026-10-25T12:30:00Z"), J, faits)).toEqual([
      "information_entreprise",
    ]);
  });
});

describe("etapesDues : relance (B2)", () => {
  const demande = new Date("2026-10-23T08:00:00Z"); // J-3, 10 h Paris

  it("le jour même de la demande : pas de relance", () => {
    const faits = { ...AUCUN, demandeLe: demande };
    expect(etapesDues(new Date("2026-10-23T15:00:00Z"), J, faits)).toEqual([]);
  });

  it("le lendemain de la demande (J-2, 10 h) : une relance", () => {
    const faits = { ...AUCUN, demandeLe: demande };
    expect(etapesDues(new Date("2026-10-24T08:00:00Z"), J, faits)).toEqual(["relance"]);
  });

  it("une seule fois", () => {
    const faits = { ...AUCUN, demandeLe: demande, relanceLe: new Date("2026-10-24T08:00:00Z") };
    expect(etapesDues(new Date("2026-10-24T09:00:00Z"), J, faits)).toEqual([]);
  });

  it("jamais si le stagiaire a répondu, oui ou non", () => {
    for (const reponse of ["oui", "non"] as const) {
      const faits = { ...AUCUN, demandeLe: demande, reponse };
      expect(etapesDues(new Date("2026-10-24T08:00:00Z"), J, faits)).toEqual([]);
    }
  });

  it("jamais avant 09 h Paris", () => {
    const faits = { ...AUCUN, demandeLe: demande };
    expect(etapesDues(new Date("2026-10-24T06:30:00Z"), J, faits)).toEqual([]);
  });
});

describe("etapesDues : information de l'entreprise (B4)", () => {
  const demande = new Date("2026-10-23T08:00:00Z");
  const relance = new Date("2026-10-24T08:00:00Z");
  const base: FaitsPresence = { ...AUCUN, demandeLe: demande, relanceLe: relance };
  // J-1 = 25/10, heure d'hiver : 12 h Paris = 11 h UTC.
  const midi = new Date("2026-10-25T11:00:00Z");

  it("J-1 à 11 h 59 : rien", () => {
    expect(etapesDues(new Date("2026-10-25T10:59:00Z"), J, base)).toEqual([]);
  });

  it("J-1 à 12 h, sans « oui » : l'entreprise", () => {
    expect(etapesDues(midi, J, base)).toEqual(["information_entreprise"]);
    expect(etapesDues(midi, J, { ...base, reponse: "non" })).toEqual(["information_entreprise"]);
  });

  it("jamais si la dernière réponse est « oui »", () => {
    expect(etapesDues(midi, J, { ...base, reponse: "oui" })).toEqual([]);
  });

  it("jamais sans adresse de contact", () => {
    expect(etapesDues(midi, J, { ...base, contactEmail: false })).toEqual([]);
  });

  it("jamais deux fois", () => {
    expect(etapesDues(midi, J, { ...base, informationEntrepriseLe: midi })).toEqual([]);
  });

  it("jamais sans demande préalable : c'est la demande qui est due", () => {
    expect(etapesDues(midi, J, AUCUN)).toEqual(["demande"]);
  });

  it("jamais avant J-1 : à J-2 midi, seule la relance est due", () => {
    const faits = { ...AUCUN, demandeLe: demande };
    expect(etapesDues(new Date("2026-10-24T10:00:00Z"), J, faits)).toEqual(["relance"]);
  });

  it("jamais à 19 h Paris ou après", () => {
    expect(etapesDues(new Date("2026-10-25T18:00:00Z"), J, base)).toEqual([]);
  });

  it("la relance et l'information peuvent tomber le même jour, dans cet ordre", () => {
    const faits = { ...AUCUN, demandeLe: demande };
    expect(etapesDues(midi, J, faits)).toEqual(["relance", "information_entreprise"]);
  });
});

describe("etapesDues : changements d'heure", () => {
  it("session du 26/10/2026 : J-3 = 23/10 (heure d'été), 09 h Paris = 07 h UTC", () => {
    expect(etapesDues(new Date("2026-10-23T06:59:00Z"), "2026-10-26", AUCUN)).toEqual([]);
    expect(etapesDues(new Date("2026-10-23T07:00:00Z"), "2026-10-26", AUCUN)).toEqual(["demande"]);
  });

  it("session du 26/10/2026 : J-1 = 25/10 dure 25 h, midi Paris = 11 h UTC", () => {
    const faits = { ...AUCUN, demandeLe: new Date("2026-10-23T08:00:00Z") };
    expect(etapesDues(new Date("2026-10-25T10:59:00Z"), "2026-10-26", faits)).toEqual(["relance"]);
    expect(etapesDues(new Date("2026-10-25T11:00:00Z"), "2026-10-26", faits)).toEqual([
      "relance",
      "information_entreprise",
    ]);
  });

  it("session du 29/03/2027 : J-3 = 26/03 (heure d'hiver), 09 h Paris = 08 h UTC", () => {
    expect(etapesDues(new Date("2027-03-26T07:59:00Z"), "2027-03-29", AUCUN)).toEqual([]);
    expect(etapesDues(new Date("2027-03-26T08:00:00Z"), "2027-03-29", AUCUN)).toEqual(["demande"]);
  });

  it("session du 29/03/2027 : J-1 = 28/03 dure 23 h, midi Paris = 10 h UTC", () => {
    const faits = {
      ...AUCUN,
      demandeLe: new Date("2027-03-26T08:00:00Z"),
      relanceLe: new Date("2027-03-27T08:00:00Z"),
    };
    expect(etapesDues(new Date("2027-03-28T09:59:00Z"), "2027-03-29", faits)).toEqual([]);
    expect(etapesDues(new Date("2027-03-28T10:00:00Z"), "2027-03-29", faits)).toEqual([
      "information_entreprise",
    ]);
  });
});
