// @formateurs V2-S12 (vérification n° 2, sécurité) — Donnée personnelle dans une
// réponse, un journal, la sortie du serveur ou un e-mail.
//
// Les deux formulaires publics qui envoient un lien répondent à l'identique pour
// une adresse connue et une inconnue (pas d'énumération) ; un IBAN refusé ne
// revient ni dans le message ni dans l'adresse ; le journal d'activité et la
// sortie du serveur ne portent aucune valeur semée ; l'avis F43 (changement de
// compte) part à l'adresse connue sans porter l'IBAN demandé.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { messagesCaptes, viderPuitsPour } from "../fixtures/formateurs/puits-smtp";
import { corpsCaptes } from "../fixtures/formateurs/securite-puits";
import {
  RESSEMBLE_A_UN_EMAIL,
  RESSEMBLE_A_UN_IBAN,
  RESSEMBLE_A_UN_TELEPHONE,
  scenarioV2,
} from "../fixtures/formateurs/v2s-commun";

interface Observations {
  r: {
    connexion: { connue: unknown; inconnue: unknown };
    retrouver: { connue: unknown; inconnue: unknown };
    dossier: string;
    espaceFaux: string;
    espaceValide: string;
  };
  sortie: string[];
  journal: Array<{ action: string; changes: unknown }>;
  avisF43: number;
  demandes: number;
  semees: Record<string, string>;
}

const ATTENTE = { timeout: 30_000, intervals: [500, 1_000] };

test.describe("@formateurs V2-S12 — aucune donnée personnelle hors de sa place", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  let o: Observations;

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    o = await scenarioV2<Observations>("v2s12-donnees-personnelles");
  });

  test.afterAll(async () => {
    for (const k of ["emailActif", "emailConnu", "emailEnCours", "emailInconnue"]) {
      const a = o?.semees[k];
      if (a) await viderPuitsPour(a);
    }
    await prisma.$disconnect();
  });

  test("pas d'énumération : même réponse pour une adresse connue et une inconnue", () => {
    expect(o.r.connexion.connue).toEqual(o.r.connexion.inconnue);
    expect(o.r.retrouver.connue).toEqual(o.r.retrouver.inconnue);
  });

  test("un IBAN refusé ne revient ni dans le message ni dans l'adresse", () => {
    expect(o.r.dossier).toContain('"ok":false');
    expect(o.r.espaceFaux).toContain("issue=");
    expect(o.r.espaceValide).toContain("issue=demande");
    for (const texte of [o.r.dossier, o.r.espaceFaux, o.r.espaceValide]) {
      expect(texte).not.toContain(o.semees["ibanFaux"]!.slice(4));
      expect(texte).not.toContain(o.semees["ibanValide"]!.slice(4));
      expect(texte).not.toMatch(RESSEMBLE_A_UN_IBAN);
    }
  });

  test("journal d'activité et sortie du serveur : aucune valeur semée", () => {
    expect(o.demandes).toBe(1);
    expect(o.journal.map((l) => l.action)).toContain("qualiopi.formateur.changement_demande");
    const textes = [...o.journal.map((l) => JSON.stringify(l.changes)), ...o.sortie];
    for (const texte of textes) {
      for (const [quoi, valeur] of Object.entries(o.semees)) {
        expect(texte, quoi).not.toContain(valeur);
      }
      expect(texte).not.toMatch(RESSEMBLE_A_UN_EMAIL);
      expect(texte).not.toMatch(RESSEMBLE_A_UN_TELEPHONE);
      expect(texte).not.toMatch(RESSEMBLE_A_UN_IBAN);
    }
  });

  test("l'avis F43 part à l'adresse connue, sans l'IBAN demandé", async () => {
    expect(o.avisF43).toBe(1);
    const a = o.semees["emailActif"]!;
    await expect.poll(async () => (await messagesCaptes(a)).length, ATTENTE).toBe(1);
    for (const c of await corpsCaptes(a)) {
      expect(c).not.toContain(o.semees["ibanValide"]!.slice(4));
      expect(c).not.toMatch(RESSEMBLE_A_UN_IBAN);
    }
  });
});
