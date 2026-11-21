// L4e — dans les e-mails aux apporteurs : le numéro demandé est le SIRET (celui des formulaires),
// et le relevé de commission ne promet aucun délai de versement (l'échéance est rendue à part).

import { describe, expect, it } from "vitest";

import { COPY_DEMARRAGE } from "../apporteur-demarrage";
import { renderEmailTemplate } from "../index";
import { ligneAPreparer } from "../_bareme-apporteur";

// « Grenoble » figure dans le pied légal commun à tous les e-mails (hors fiche) : on le contrôle
// donc sur les textes de la fiche eux-mêmes (voir le dernier test), pas sur le rendu entier.
const MOTS_INTERDITS = /Qualiopi|OPCO|prise en charge|financeur/i;

async function rendu(nom: string, payload: Record<string, unknown>): Promise<string> {
  const r = await renderEmailTemplate(nom as never, "fr", payload);
  return `${r.subject}\n${r.text}`.replace(/\s+/g, " ");
}

describe("relevé de commission : aucun délai de versement promis", () => {
  it("avec montant et échéance : l'échéance est rendue à part, le montant tel quel", async () => {
    const t = await rendu("apporteur-releve", {
      contactName: "Claire Martin",
      montant: "1 234,56 €",
      echeance: "30 novembre 2026",
      numeroAutofacture: "AF-2026-001",
    });
    expect(t).not.toMatch(/jours? ouvrés/i);
    expect(t).toContain("Échéance de paiement : 30 novembre 2026.");
    expect(t).toContain("1 234,56 €");
    expect(t.match(MOTS_INTERDITS)?.[0] ?? null).toBeNull();
  });

  it("variante « compensation » : aucun délai non plus, montant présent", async () => {
    const t = await rendu("apporteur-releve", {
      contactName: "Claire Martin",
      montant: "1 234,56 €",
      compense: true,
    });
    expect(t).not.toMatch(/jours? ouvrés/i);
    expect(t).toContain("1 234,56 €");
    expect(t.match(MOTS_INTERDITS)?.[0] ?? null).toBeNull();
  });
});

describe("SIRET, jamais SIREN, dans ce qu'on demande à l'apporteur", () => {
  it("« contrat signé » : le numéro SIRET de l'établissement visité", async () => {
    const t = await rendu("apporteur-contrat-signe", { contactName: "Claire Martin" });
    expect(t).toContain("numéro SIRET de l'établissement visité");
    expect(t).not.toContain("numéro SIREN");
    expect(t.match(MOTS_INTERDITS)?.[0] ?? null).toBeNull();
  });

  it("la ligne « à préparer » anglaise dit SIRET ; la française est inchangée", () => {
    const en = ligneAPreparer("en");
    expect(en).toContain("SIRET");
    expect(en).not.toContain("SIREN");
    const fr = ligneAPreparer("fr");
    expect(fr).toContain("À préparer : votre numéro SIRET, votre IBAN");
    expect(fr).not.toContain("SIREN");
  });
});

describe("les textes de cette fiche ne portent aucun mot interdit", () => {
  it("relevé et champs du formulaire de déclaration", () => {
    const textes = [
      COPY_DEMARRAGE.releve.texte("1 000 €"),
      COPY_DEMARRAGE.releve.compense("1 000 €"),
      ...COPY_DEMARRAGE.contratSigne.champs,
      ligneAPreparer("en"),
    ].join(" ");
    expect(
      textes.match(/Qualiopi|OPCO|prise en charge|financeur|Grenoble/i)?.[0] ?? null,
    ).toBeNull();
  });
});
