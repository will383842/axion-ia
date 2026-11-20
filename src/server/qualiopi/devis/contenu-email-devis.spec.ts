import { describe, expect, it } from "vitest";

import { contenuEmailDevis, type EntreeContenuEmailDevis } from "./contenu-email-devis";
import { payloadDevisEnvoi, nomPourSalutationDevis } from "./email-devis-envoi";
import { salutationPourPayload } from "@/server/qualiopi/crm/salutation-payload";

const BASE: EntreeContenuEmailDevis = {
  devis: {
    numero: "AXI-DEV-2026-001",
    montantTotalHtCents: 150000,
    dateValidite: new Date("2026-12-31T00:00:00Z"),
  },
  client: {
    raisonSociale: "Client SA",
    contactNom: "Camille",
    contactCivilite: "monsieur",
    contactPrenom: "Paul",
    contactNomFamille: "Dupont",
  },
};

function payloadDe(e: EntreeContenuEmailDevis): Record<string, unknown> {
  const r = contenuEmailDevis(e);
  if (!r.ok) throw new Error(r.error);
  return r.payload;
}

describe("contenuEmailDevis", () => {
  it("sans message ni objet, reprend exactement le contenu d'aujourd'hui", () => {
    const attendu = payloadDevisEnvoi({
      clientNom: nomPourSalutationDevis(BASE.client),
      salutation: salutationPourPayload({
        clientNom: nomPourSalutationDevis(BASE.client),
        contactCivilite: "monsieur",
        contactPrenom: "Paul",
        contactNomFamille: "Dupont",
      }),
      numero: "AXI-DEV-2026-001",
      montantTotalHtCents: 150000,
      montantLabel: new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })
        .format(1500)
        .concat(" HT"),
      dateValiditeLabel: new Date("2026-12-31T00:00:00Z").toLocaleDateString("fr-FR"),
    });
    expect(payloadDe(BASE)).toEqual(attendu);
    expect(payloadDe(BASE)).not.toHaveProperty("messagePersonnalise");
  });

  it("porte le message personnel (nettoyé) dans le contenu", () => {
    const p = payloadDe({ ...BASE, message: "  Merci de votre confiance.  " });
    expect(p["messagePersonnalise"]).toBe("Merci de votre confiance.");
  });

  it("un message blanc n'ajoute rien", () => {
    expect(payloadDe({ ...BASE, message: "   " })).not.toHaveProperty("messagePersonnalise");
  });

  it("porte le lien de signature quand il est donné", () => {
    expect(payloadDe({ ...BASE, signatureUrl: "https://x.test/s/1" })["signatureUrl"]).toBe(
      "https://x.test/s/1",
    );
  });

  it("valide l'objet : 1 à 300 caractères, sans saut de ligne", () => {
    const ok = contenuEmailDevis({ ...BASE, sujet: "  Votre devis  " });
    expect(ok.ok && ok.sujet).toBe("Votre devis");
    expect(contenuEmailDevis({ ...BASE, sujet: "a".repeat(300) }).ok).toBe(true);
    expect(contenuEmailDevis({ ...BASE, sujet: "a".repeat(301) }).ok).toBe(false);
    expect(contenuEmailDevis({ ...BASE, sujet: "Ligne 1\nLigne 2" }).ok).toBe(false);
    expect(contenuEmailDevis({ ...BASE, sujet: "Ligne 1\r" + "x" }).ok).toBe(false);
    const vide = contenuEmailDevis({ ...BASE, sujet: "   " });
    expect(vide.ok && vide.sujet).toBeUndefined();
  });

  it("valide le message : 4 000 caractères au plus", () => {
    expect(contenuEmailDevis({ ...BASE, message: "a".repeat(4000) }).ok).toBe(true);
    expect(contenuEmailDevis({ ...BASE, message: "a".repeat(4001) }).ok).toBe(false);
  });

  it.each([
    "Votre financement est prêt",
    "FINANCEMENT",
    "une prise  en charge",
    "Prise en charge",
    "Votre dossier OPCO",
    "opco",
    "Qualiopi",
    "paiement par CPF",
    "FINANCÉ",
  ])("refuse le mot interdit dans l'objet comme dans le message : %s", (texte) => {
    expect(contenuEmailDevis({ ...BASE, sujet: texte }).ok).toBe(false);
    expect(contenuEmailDevis({ ...BASE, message: texte }).ok).toBe(false);
  });

  it("n'écarte pas un texte ordinaire", () => {
    expect(contenuEmailDevis({ ...BASE, sujet: "Votre devis AXI-DEV-2026-001" }).ok).toBe(true);
  });

  it("salue « Monsieur Dupont » avec civilité et nom, « Bonjour, » sinon", () => {
    const avec = payloadDe(BASE);
    expect(avec["clientNom"]).toBe("Monsieur Dupont");
    expect(avec["salutation"]).toEqual({ civilite: "monsieur", nomFamille: "Dupont" });
    const sans = payloadDe({
      ...BASE,
      client: { raisonSociale: "Client SA", contactNom: "Camille" },
    });
    expect(sans["clientNom"]).toBe("");
    expect(sans).not.toHaveProperty("salutation");
  });
});

describe("contenuEmailDevis — objet et mots interdits", () => {
  it("refuse tout caractère de contrôle dans l'objet (tabulation, NUL, U+2028…)", () => {
    for (const c of ["\t", "\u0000", "\u0007", "\u007f", "\u2028", "\u2029", "\r", "\n"]) {
      expect(contenuEmailDevis({ ...BASE, sujet: `Votre${c}devis` }).ok).toBe(false);
    }
  });

  it("« directeur financier » est accepté, « financement » et « financé » refusés", () => {
    expect(contenuEmailDevis({ ...BASE, sujet: "Pour le directeur financier" }).ok).toBe(true);
    expect(contenuEmailDevis({ ...BASE, message: "Service financier et finances" }).ok).toBe(true);
    for (const t of [
      "Plan de financement",
      "Formation financée",
      "Stage FINANCÉ",
      "Dossiers financés",
      "Finance par un tiers",
      "Prise en charge",
      "Qualiopi",
      "OPCO",
      "CPF",
    ]) {
      expect(contenuEmailDevis({ ...BASE, sujet: t }).ok, t).toBe(false);
    }
  });

  it("refuse « financee(s) » sans accent et « pris(e)(s) en charge », sans toucher « finances »", () => {
    for (const t of [
      "Formation financee",
      "Stages financees",
      "Dossiers financees",
      "FINANCEE",
      "Pris en charge",
      "Prise en charge",
      "Prises en charge",
      "Frais pris  en charge",
    ]) {
      expect(contenuEmailDevis({ ...BASE, sujet: t }).ok, t).toBe(false);
      expect(contenuEmailDevis({ ...BASE, message: t }).ok, t).toBe(false);
    }
    expect(contenuEmailDevis({ ...BASE, sujet: "Les finances du directeur financier" }).ok).toBe(
      true,
    );
    expect(contenuEmailDevis({ ...BASE, sujet: "Un devis pris en main" }).ok).toBe(true);
  });

  it("refuse un caractère de format (\\p{Cf}) dans l'objet : U+202E, U+200B, U+FEFF, U+00AD", () => {
    for (const c of ["\u202e", "\u200b", "\ufeff", "\u00ad", "\u200d"]) {
      expect(contenuEmailDevis({ ...BASE, sujet: `Votre${c}devis` }).ok, c).toBe(false);
    }
  });
});
