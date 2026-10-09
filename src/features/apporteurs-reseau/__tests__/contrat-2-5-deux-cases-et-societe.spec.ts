import { describe, expect, it, vi } from "vitest";

// Contrat 2.5 (09/10/2026, décision de Will) : la signature tient en deux cases, et un
// Apporteur société est désigné par sa dénomination, « représentée par » la personne qui signe.
// La preuve, elle, ne perd rien : le serveur exige toujours les 4 déclarations et les 6
// acceptations une par une, et le certificat de signature les liste toutes.

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { CONTRAT_V2_MARKDOWN, CONTRAT_VERSION } from "../contrat-v2";
import { texteDuContrat } from "../contrat-pdf";
import { ACCEPTATIONS, DECLARATIONS } from "../regles-dossier";
import {
  CLES_ACCEPTATIONS,
  CLES_DECLARATIONS,
  casesCompletes,
  valeursDuContrat,
} from "../signature-regles";

const LE = new Date("2026-10-09T10:00:00Z");
const base = {
  prenom: "Éloïse",
  nom: "Lefèvre",
  siren: "732829320",
  siret: "73282932000074",
  adresse: "8 rue du Domicile 69003 Lyon",
  denomination: "ACME",
};
const net = (t: string) => t.replace(/\s+/g, " ");

describe("contrat 2.5", () => {
  it("version 2.5 ; plus aucune mention « case d'acceptation distincte »", () => {
    expect(CONTRAT_VERSION).toBe("2.5");
    expect(CONTRAT_V2_MARKDOWN).not.toMatch(/case d'acceptation distincte/);
  });

  it("société : dénomination, « immatriculée », « représentée par » la personne qui signe", () => {
    const t = net(texteDuContrat(valeursDuContrat({ ...base, statutJuridique: "sas" }, LE)));
    expect(t).toContain(
      "ACME**, SAS, immatriculée sous le numéro SIREN 732829320, SIRET de l'établissement 73282932000074, dont l'établissement est situé 8 rue du Domicile 69003 Lyon, représentée par Éloïse LEFÈVRE, ci-après",
    );
    expect(t).toContain("**L'Apporteur** — ACME, représentée par Éloïse LEFÈVRE");
  });

  it("entrepreneur individuel : inchangé (son nom, « immatriculé », pas de « représentée par »)", () => {
    const t = net(
      texteDuContrat(valeursDuContrat({ ...base, statutJuridique: "micro_entrepreneur" }, LE)),
    );
    expect(t).toContain(
      "Éloïse LEFÈVRE**, Micro-entrepreneur (auto-entrepreneur), immatriculé sous le numéro SIREN",
    );
    expect(t).not.toContain("représentée par Éloïse");
    expect(t).toContain("**L'Apporteur** — Éloïse LEFÈVRE");
  });

  it("société sans dénomination connue : repli sur le nom, jamais un trou", () => {
    const t = net(
      texteDuContrat(
        valeursDuContrat({ ...base, statutJuridique: "sarl", denomination: null }, LE),
      ),
    );
    expect(t).toContain("Éloïse LEFÈVRE**, SARL, immatriculé sous le numéro SIREN");
    expect(t).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it("la preuve ne perd rien : 4 déclarations et 6 acceptations, toutes exigées", () => {
    expect(DECLARATIONS).toHaveLength(4);
    expect(ACCEPTATIONS).toHaveLength(6);
    expect(casesCompletes(CLES_DECLARATIONS, CLES_ACCEPTATIONS)).toBe(true);
    expect(casesCompletes(CLES_DECLARATIONS, CLES_ACCEPTATIONS.slice(1))).toBe(false);
    // Le mandat de facturation reste une acceptation expresse (art. 289 CGI).
    expect(ACCEPTATIONS.find((a) => a.cle === "art_5_2")!.texte).toContain(
      "Je donne mandat à Axion-IA d'établir mes factures",
    );
  });
});
