// E-mails apporteurs (2026-10-07, décision de Will) : le bouton dit « et signer mon
// contrat », l'e-mail annonce ce qu'il faut préparer (les pièces RÉELLEMENT demandées à
// l'étape 3), le barème est le même partout (1-to-1 et conférence compris), et l'apporteur
// reçoit « Dossier bien reçu » à sa signature, sans délai promis.

import { describe, expect, it } from "vitest";

import { COMMISSION_CONFERENCE_EUR } from "@/content/pricing";
import {
  LIBELLE_PIECE,
  PIECES_FACULTATIVES,
  PIECES_POUR_SIGNER,
} from "@/features/apporteurs-reseau/regles-dossier";
import { TEXTES } from "@/app/apporteur/dossier/[id]/[jeton]/textes";
import { lignesBareme } from "../_bareme-apporteur";
import { COPY_DEMARRAGE } from "../apporteur-demarrage";
import { renderEmailTemplate } from "../index";

const URL_DOSSIER = "https://axion-ia.com/apporteur/dossier/x/y";
const texte = async (g: string, payload: Record<string, unknown>) =>
  (await renderEmailTemplate(g as never, "fr", payload)).text.replace(/\s+/g, " ");

describe("bouton et liste « à préparer »", () => {
  it.each([
    ["apporteur-issue-retenu", { contactName: "Claire Martin", dossierUrl: URL_DOSSIER }],
    ["apporteur-dossier-lien", { contactName: "Claire Martin", dossierUrl: URL_DOSSIER }],
    [
      "apporteur-dossier-lien",
      { contactName: "Claire Martin", dossierUrl: URL_DOSSIER, rappel: 1 },
    ],
    [
      "apporteur-dossier-lien",
      { contactName: "Claire Martin", dossierUrl: URL_DOSSIER, rappel: 2 },
    ],
  ])(
    "%s : bouton « Compléter mon dossier et signer mon contrat » et pièces exactes",
    async (g, p) => {
      const t = await texte(g, p);
      expect(t).toContain("Compléter mon dossier et signer mon contrat");
      expect(t).toContain("numéro SIREN");
      expect(t).toContain("IBAN");
      for (const piece of [...PIECES_POUR_SIGNER, ...PIECES_FACULTATIVES]) {
        expect(t.toLowerCase()).toContain(LIBELLE_PIECE[piece].toLowerCase());
      }
      expect(t).toContain("Environ 10 minutes, vous pouvez reprendre plus tard");
    },
  );
});

describe("barème identique partout, tiré des constantes du contrat", () => {
  it("« Retenu » et « contrat signé » citent les mêmes lignes, 1-to-1 et conférence compris", async () => {
    const retenu = await texte("apporteur-issue-retenu", {
      contactName: "Claire Martin",
      dossierUrl: URL_DOSSIER,
    });
    const signe = await texte("apporteur-contrat-signe", { contactName: "Claire Martin" });
    for (const ligne of lignesBareme()) {
      expect(retenu).toContain(ligne);
      expect(signe).toContain(ligne);
    }
    expect(lignesBareme().join(" ")).toContain("1-to-1");
    expect(lignesBareme().join(" ")).toContain(`${COMMISSION_CONFERENCE_EUR} € HT par conférence`);
    // Le parrainage reste dans « contrat signé » (c'est le contrat), et la mention prudente aussi.
    expect(signe).toContain("Parrainage");
    expect(retenu).toContain("à titre indicatif");
  });
});

describe("« Dossier bien reçu »", () => {
  it("vouvoiement, contrat contresigné par e-mail, aucun délai promis, bouton vers le dossier", async () => {
    const r = await renderEmailTemplate("apporteur-dossier-recu" as never, "fr", {
      contactName: "Claire Martin",
      dossierUrl: URL_DOSSIER,
    });
    const t = r.text.replace(/\s+/g, " ");
    expect(r.subject).toContain("bien reçu");
    expect(t).toContain("Bonjour Claire");
    expect(t).toContain("vous recevrez votre contrat contresigné par e-mail");
    // Aucun délai chiffré dans le texte propre à cet e-mail (le châssis commun est hors sujet).
    expect(Object.values(COPY_DEMARRAGE.dossierRecu).join(" ")).not.toMatch(/\d/);
    expect(r.html).toContain(URL_DOSSIER);
  });
});

describe("étape 2 : « Pas encore de numéro SIREN ? »", () => {
  it("dit comment obtenir un SIREN, lien officiel, sans autre délai que « quelques jours »", () => {
    expect(TEXTES.sansSirenTitre).toBe("Pas encore de numéro SIREN ?");
    expect(TEXTES.sansSirenUrl).toBe("https://formalites.entreprises.gouv.fr");
    expect(TEXTES.sansSirenTexte).toContain("micro-entreprise");
    expect(TEXTES.sansSirenSuite).toContain("quelques jours");
    expect(TEXTES.sansSirenSuite).toContain("Votre dossier reste enregistré");
  });
});

describe("13) « contrat signé » réécrit par Will", () => {
  it("garde le lien vers la fiche « Comment ça marche »", async () => {
    const r = await renderEmailTemplate("apporteur-contrat-signe" as never, "fr", {
      contactName: "Claire Martin",
      texteLibre: "Bienvenue dans le réseau.",
    });
    expect(r.html).toContain("comment-ca-marche.pdf");
  });
});
