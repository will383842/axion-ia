// @vitest-environment node
// « entreprise-information-coordonnees » (lot 7a, NON BRANCHÉ) : le court message
// d'INFORMATION à la personne dont un apporteur a transmis les coordonnées. Il informe, il ne
// demande rien : aucune réponse attendue, aucun bouton, aucune relance annoncée. Le rendu est
// fait à la main (le gabarit n'est inscrit dans aucun registre : un autre lot le branchera).
import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";

import { EMAIL_LEGAL } from "@/lib/email/legal-footer";

import { avecDonneesRendu } from "../_layout";
import {
  EntrepriseInformationCoordonneesEmail,
  entrepriseInformationCoordonneesSubject,
  LIEN_CONFIDENTIALITE_PERSONNES_PRESENTEES,
} from "../entreprise-information-coordonnees";

const OPPOSITION = "https://axion-ia.com/fr/opposition?jeton=exemple";
const EXEMPLE = {
  contactName: "Claire Durand",
  civilite: "Madame",
  nomFamille: "Durand",
  nomApporteur: "Camille Martin",
};

async function rendre(payload: Record<string, unknown>) {
  const element = <EntrepriseInformationCoordonneesEmail locale="fr" payload={payload} />;
  // Comme le worker : le destinataire est connu, le pied porte donc son lien d'opposition.
  return avecDonneesRendu({ oppositionHref: OPPOSITION, lienEspace: null }, async () => ({
    html: await render(element, { pretty: false }),
    text: await render(element, { plainText: true }),
  }));
}

/** Le texte lu, sans l'adresse du siège (pied de page légal du châssis, LCEN art. 1-1). */
const sansAdresseLegale = (texte: string): string => texte.replaceAll(EMAIL_LEGAL.address, "");

describe("entreprise-information-coordonnees", () => {
  it("se rend avec des données d'exemple : objet, salutation, nom de l'apporteur", async () => {
    const { html, text } = await rendre(EXEMPLE);
    expect(entrepriseInformationCoordonneesSubject("fr", EXEMPLE)).toBe(
      "Camille Martin nous a transmis vos coordonnées",
    );
    expect(text).toContain("Bonjour Madame Durand,");
    expect(text).toContain("de la part de Camille Martin");
    expect(html).toContain('data-famille="B"');
  });

  it("se rend sans payload (aucune exception)", async () => {
    const { text } = await rendre({});
    expect(entrepriseInformationCoordonneesSubject("fr", {})).toBe(
      "Vos coordonnées professionnelles chez Axion-IA",
    );
    expect(text).toContain("Bonjour,");
    expect(text).not.toMatch(/undefined|null/);
    // Sans nom d'apporteur : l'élision est faite (« d'une personne », pas « de une personne »).
    const lu = text.replace(/\s+/g, " ");
    expect(lu).toContain("de la part d'une personne de notre réseau");
    expect(lu).not.toContain("de une");
  });

  it("dit qui traite, les quatre droits, comment les exercer, et porte le lien de confidentialité", async () => {
    const { html, text } = await rendre(EXEMPLE);
    expect(text).toContain(EMAIL_LEGAL.legalName);
    for (const droit of ["accéder", "rectifier", "effacer", "opposer"])
      expect(text).toContain(droit);
    expect(text).toContain(EMAIL_LEGAL.contactEmail);
    expect(LIEN_CONFIDENTIALITE_PERSONNES_PRESENTEES).toMatch(
      /\/fr\/politique-confidentialite#personnes-presentees-par-un-apporteur$/,
    );
    expect(html).toContain(`href="${LIEN_CONFIDENTIALITE_PERSONNES_PRESENTEES}"`);
  });

  it("ne demande rien : ni « vérif », ni « contrôl », ni « confirm », ni « rendez-vous »", async () => {
    const { text } = await rendre(EXEMPLE);
    const lu = text.toLowerCase();
    for (const interdit of ["vérif", "verif", "contrôl", "control", "confirm", "rendez-vous"]) {
      expect(lu).not.toContain(interdit);
    }
    expect(lu).not.toMatch(/merci de (nous )?répondre|dites-nous|faites-nous savoir/);
  });

  it("« relanc » n'apparaît que pour dire qu'il n'y en aura aucune", async () => {
    const { text } = await rendre(EXEMPLE);
    const lu = text.toLowerCase();
    expect(lu).toContain("aucune relance");
    expect(lu.replaceAll("aucune relance", "")).not.toContain("relanc");
  });

  it("aucun bouton ni lien d'action : jamais la prise de rendez-vous", async () => {
    const { html } = await rendre(EXEMPLE);
    const liens = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1] ?? "");
    expect(liens.length).toBeGreaterThan(0);
    for (const l of liens) expect(l).not.toMatch(/\/appel|calendly/i);
    expect(html).not.toContain("Le bouton ne fonctionne pas");
  });

  it("ni « Grenoble » (hors adresse légale du pied), ni « gain garanti », ni prix, commission, conférence", async () => {
    const { text } = await rendre(EXEMPLE);
    const lu = sansAdresseLegale(text).toLowerCase();
    for (const interdit of [
      "grenoble",
      "gain garanti",
      "commission",
      "conférence",
      "€",
      "prix",
      "tarif",
    ]) {
      expect(lu).not.toContain(interdit);
    }
  });

  it("vouvoiement, et seuls le prénom et le nom de l'apporteur sont dits", async () => {
    const { text } = await rendre({ ...EXEMPLE, emailApporteur: "camille.martin@example.com" });
    expect(text).not.toMatch(/\btu\b|\bton\b|\btes\b/i);
    expect(text).not.toContain("example.com");
  });
});
